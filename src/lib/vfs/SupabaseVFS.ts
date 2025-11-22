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
    const supabase = await this.getSupabase();
    
    let parentId: string | null = null;
    
    if (path !== '/' && path !== '') {
      const node = await this.resolvePath(path);
      if (!node || node.type !== 'directory') {
        throw new Error(`Path not found or not a directory: ${path}`);
      }
      parentId = node.id;
    }

    const query = supabase
      .from('vfs_nodes')
      .select('name, type')
      .eq('user_id', this.userId);

    if (parentId) {
      query.eq('parent_id', parentId);
    } else {
      query.is('parent_id', null);
    }

    const { data } = await query;
    return data?.map(n => n.type === 'directory' ? `${n.name}/` : n.name) || [];
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
}
