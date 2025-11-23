-- Fix duplicates in notes table
-- This script removes duplicate notes (keeping the most recently updated one)
-- and ensures the unique constraint exists.

-- 1. Remove duplicates
DELETE FROM notes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, slug ORDER BY updated_at DESC) as rnum
    FROM notes
  ) t
  WHERE t.rnum > 1
);

-- 2. Ensure Unique Constraint exists on notes(user_id, slug)
DO $$
BEGIN
    -- Check if constraint exists (generic name or specific name)
    -- We try to add it, if it fails it might be because it exists with a different name
    -- or we can check pg_constraint.
    
    -- Simplest way: Drop if exists (to ensure name) and Add
    -- But we don't want to break things if it's correct.
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'notes'::regclass 
        AND conname = 'notes_user_id_slug_key'
    ) THEN
        -- Try to add it. If there's another constraint covering the same columns, this is fine.
        ALTER TABLE notes ADD CONSTRAINT notes_user_id_slug_key UNIQUE (user_id, slug);
    END IF;
END $$;
