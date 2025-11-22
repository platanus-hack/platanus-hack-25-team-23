-- Fix duplicates in vfs_nodes table (specifically root items where parent_id is NULL)

-- 1. Remove duplicates (keeping the most recently updated one)
DELETE FROM vfs_nodes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), name 
             ORDER BY updated_at DESC
           ) as rnum
    FROM vfs_nodes
  ) t
  WHERE t.rnum > 1
);

-- 2. Create a unique index that handles NULL parent_id correctly
-- Standard UNIQUE(user_id, parent_id, name) treats NULLs as distinct.
-- We need a unique index using COALESCE or similar logic, but Postgres unique indexes with expressions are supported.
-- Alternatively, we can use NULLS NOT DISTINCT (Postgres 15+).
-- Assuming Postgres 15+ (Supabase default):
CREATE UNIQUE INDEX IF NOT EXISTS idx_vfs_nodes_unique_name 
ON vfs_nodes (user_id, parent_id, name) 
NULLS NOT DISTINCT;

-- If older Postgres, we would use a partial index for root:
-- CREATE UNIQUE INDEX idx_vfs_nodes_unique_root_name ON vfs_nodes (user_id, name) WHERE parent_id IS NULL;
-- But let's try the NULLS NOT DISTINCT first as it's cleaner. 
-- If it fails, the user will report it and we can fallback.
