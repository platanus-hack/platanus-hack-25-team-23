// @ts-nocheck
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseVFS {
  private userId: string;
  private client?: SupabaseClient;

  constructor(userId: string, client?: SupabaseClient) {
    this.userId = userId;
    this.client = client;
  }

  private async getSupabase() {
    if (this.client) return this.client;
    return await createClient();
  }

  /**
   * Resolves a path string (e.g., "/notes/react.md") to a Node ID.
   * Returns null if not found.
   */
  private async resolvePath(path: string): Promise<{ id: string; type: 'file' | 'directory' } | null> {
    const supabase = await this.getSupabase();
    const parts = path.split('/').filter(p => p.length > 0);
    
    if (parts.length === 0) return null; // Root is not a node, but we handle it in list

    let currentParentId: string | null = null;
    let currentNode: { id: string; type: 'file' | 'directory' } | null = null;

    for (const part of parts) {
      const query = supabase
        .from('vfs_nodes')
        .select('id, type')
        .eq('user_id', this.userId)
        .eq('name', part);

      if (currentParentId) {
        query.eq('parent_id', currentParentId);
      } else {
        query.is('parent_id', null);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return null;
      }

      currentParentId = data.id;
      currentNode = { id: data.id, type: data.type as 'file' | 'directory' };
    }

    return currentNode;
  }

  async listFiles(path: string = '/'): Promise<string[]> {
    // Use getAllFilePaths to ensure consistency with AI context
    const allPaths = await this.getAllFilePaths();
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    
    const items = new Set<string>();
    
    for (const filePath of allPaths) {
        if (filePath.startsWith(normalizedPath)) {
            const relative = filePath.slice(normalizedPath.length);
            const parts = relative.split('/');
            
            if (parts.length > 0) {
                const item = parts[0];
                // If there are more parts, it's a directory
                if (parts.length > 1) {
                    items.add(`${item}/`);
                } else {
                    items.add(item);
                }
            }
        }
    }
    
    const result = Array.from(items).sort();
    console.log(`VFS: listFiles('${path}') -> found ${result.length} items (via getAllFilePaths)`);
    return result;
  }

  async readFile(path: string): Promise<string> {
    const node = await this.resolvePath(path);
    if (!node || node.type !== 'file') {
      throw new Error(`File not found: ${path}`);
    }

    const supabase = await this.getSupabase();
    const { data } = await supabase
      .from('vfs_nodes')
      .select('content')
      .eq('id', node.id)
      .single();

    return data?.content || '';
  }

  async writeFile(path: string, content: string): Promise<void> {
    // Sanitize content: remove null bytes which cause Postgres errors
    content = content.replace(/\u0000/g, '');

    const supabase = await this.getSupabase();
    const parts = path.split('/').filter(p => p.length > 0);
    const fileName = parts.pop();
    
    if (!fileName) throw new Error('Invalid path');

    // Resolve parent directory
    let parentId: string | null = null;
    if (parts.length > 0) {
      // Ensure parent directories exist (mkdir -p)
      // For simplicity, we assume they exist or fail. 
      // Let's implement a quick "ensure dir" logic or just resolve.
      // For now, let's assume flat or existing structure for simplicity, 
      // or recursively create.
      
      // Recursive resolve/create for parents
      let currentParent: string | null = null;
      for (const part of parts) {
        // Check if exists
        const q = supabase.from('vfs_nodes').select('id').eq('user_id', this.userId).eq('name', part);
        if (currentParent) q.eq('parent_id', currentParent);
        else q.is('parent_id', null);
        
        const { data } = await q.single();
        
        if (data) {
          currentParent = data.id;
        } else {
          // Create directory
          const { data: newDir, error } = await supabase
            .from('vfs_nodes')
            .insert({
              user_id: this.userId,
              parent_id: currentParent,
              name: part,
              type: 'directory'
            })
            .select('id')
            .single();
            
          if (error) throw error;
          currentParent = newDir.id;
        }
      }
      parentId = currentParent;
    }

    // Upsert file
    // Check if exists
    const query = supabase
      .from('vfs_nodes')
      .select('id')
      .eq('user_id', this.userId)
      .eq('name', fileName)
      .eq('type', 'file');
      
    if (parentId) query.eq('parent_id', parentId);
    else query.is('parent_id', null);

    // Use maybeSingle() to avoid error if 0 rows, but it still errors if >1 rows.
    // So we use limit(1) to be safe against duplicates, then single() or maybeSingle().
    const { data: existing } = await query.limit(1).maybeSingle();

    if (existing) {
      await supabase
        .from('vfs_nodes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('vfs_nodes')
        .insert({
          user_id: this.userId,
          parent_id: parentId,
          name: fileName,
          type: 'file',
          content
        });
    }

    // Sync to Graph
    // We assume the file is a markdown file and we want to sync it.
    if (fileName.endsWith('.md')) {
        const { syncFileToGraph } = await import('@/lib/graph/sync');
        await syncFileToGraph(this.userId, fileName, content, this.client);
    }
  }

  async createDirectory(path: string): Promise<void> {
    const supabase = await this.getSupabase();
    const parts = path.split('/').filter(p => p.length > 0);
    
    let currentParent: string | null = null;
    for (const part of parts) {
      const q = supabase.from('vfs_nodes').select('id').eq('user_id', this.userId).eq('name', part);
      if (currentParent) q.eq('parent_id', currentParent);
      else q.is('parent_id', null);
      
      const { data } = await q.single();
      
      if (data) {
        currentParent = data.id;
      } else {
        const { data: newDir, error } = await supabase
          .from('vfs_nodes')
          .insert({
            user_id: this.userId,
            parent_id: currentParent,
            name: part,
            type: 'directory'
          })
          .select('id')
          .single();
          
        if (error) throw error;
        currentParent = newDir.id;
      }
    }
  }

  /**
   * Returns a flat list of all file paths in the VFS.
   * Used for AI context injection.
   */
  async getAllFilePaths(): Promise<string[]> {
      const supabase = await this.getSupabase();
      
      // Fetch all nodes
      const { data: nodes } = await supabase
          .from('vfs_nodes')
          .select('id, parent_id, name, type')
          .eq('user_id', this.userId);

      if (!nodes) return [];

      // Build map for quick lookup
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const files = nodes.filter(n => n.type === 'file');
      const paths: string[] = [];

      for (const file of files) {
          let current = file;
          const parts = [current.name];
          
          while (current.parent_id) {
              const parent = nodeMap.get(current.parent_id);
              if (parent) {
                  parts.unshift(parent.name);
                  current = parent;
              } else {
                  break; // Orphaned or error
              }
          }
          paths.push('/' + parts.join('/'));
      }

      return paths;
  }


  /**
   * Searches for files matching the query in name or content.
   */
  async searchFiles(query: string): Promise<string[]> {
    const supabase = await this.getSupabase();
    
    const { data } = await supabase
      .from('vfs_nodes')
      .select('id, name, type, content')
      .eq('user_id', this.userId)
      .eq('type', 'file')
      .or(`name.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(20);

    if (!data) return [];
    return data.map(f => f.name);
  }

  /**
   * Moves or renames a file/directory.
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    const supabase = await this.getSupabase();
    
    // 1. Resolve source
    const sourceNode = await this.resolvePath(sourcePath);
    if (!sourceNode) {
      throw new Error(`Source path not found: ${sourcePath}`);
    }

    // 2. Resolve destination parent and name
    const parts = destinationPath.split('/').filter(p => p.length > 0);
    const newName = parts.pop();
    if (!newName) throw new Error('Invalid destination path');

    let newParentId: string | null = null;
    
    if (parts.length > 0) {
        let currentParent: string | null = null;
        for (const part of parts) {
            const q = supabase.from('vfs_nodes').select('id').eq('user_id', this.userId).eq('name', part);
            if (currentParent) q.eq('parent_id', currentParent);
            else q.is('parent_id', null);
            
            const { data } = await q.single();
            
            if (data) {
                currentParent = data.id;
            } else {
                const { data: newDir, error } = await supabase
                    .from('vfs_nodes')
                    .insert({
                        user_id: this.userId,
                        parent_id: currentParent,
                        name: part,
                        type: 'directory'
                    })
                    .select('id')
                    .single();
                
                if (error) throw error;
                currentParent = newDir.id;
            }
        }
        newParentId = currentParent;
    }

    // 3. Update the node
    const { error } = await supabase
        .from('vfs_nodes')
        .update({ 
            name: newName, 
            parent_id: newParentId,
            updated_at: new Date().toISOString()
        })
        .eq('id', sourceNode.id);

    if (error) throw error;
  }
}
