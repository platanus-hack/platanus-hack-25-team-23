-- Ensure 'is_generated' column exists in notes table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notes' AND column_name = 'is_generated'
    ) THEN
        ALTER TABLE notes ADD COLUMN is_generated BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Force schema cache reload by notifying pgrst (if configured) or just by the DDL above.
-- Adding a comment also helps force a refresh in some setups.
COMMENT ON TABLE notes IS 'Notes table with is_generated column';
