-- Virtual File System (VFS) Schema

-- ============================================
-- VFS NODES (Files and Folders)
-- ============================================
CREATE TABLE IF NOT EXISTS vfs_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES vfs_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'directory')),
  content TEXT, -- NULL for directories
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Enforce unique names within a directory for a user
  UNIQUE(user_id, parent_id, name)
);

-- Index for faster path lookups
CREATE INDEX IF NOT EXISTS idx_vfs_parent ON vfs_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_vfs_user ON vfs_nodes(user_id);

-- RLS Policies
ALTER TABLE vfs_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own vfs nodes" ON vfs_nodes 
  FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_vfs_nodes_updated_at 
  BEFORE UPDATE ON vfs_nodes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
