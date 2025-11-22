-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (type IN ('daily', 'weekly', 'monthly', 'yearly')),

  -- Morning section
  gratitude JSONB DEFAULT '[]'::jsonb,
  daily_intention TEXT DEFAULT '',
  make_great JSONB DEFAULT '[]'::jsonb,

  -- Night section
  best_moments JSONB DEFAULT '[]'::jsonb,
  lesson TEXT DEFAULT '',

  -- Quote of the day
  quote JSONB DEFAULT NULL,

  -- Tasks for the day
  -- Format: [{ id: string, text: string, completed: boolean, priority: 'high' | 'medium' | 'low' }]
  tasks JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  is_complete BOOLEAN DEFAULT FALSE,

  -- Weekly specific
  weekly_gratitude JSONB DEFAULT NULL,
  highlights JSONB DEFAULT NULL,
  weekly_lesson TEXT DEFAULT NULL,
  to_improve TEXT DEFAULT NULL,

  -- Monthly specific
  big_wins JSONB DEFAULT NULL,
  kpis JSONB DEFAULT NULL,
  monthly_lesson TEXT DEFAULT NULL,
  adjustments TEXT DEFAULT NULL,

  -- Yearly specific
  word_of_year TEXT DEFAULT NULL,
  vision_statement TEXT DEFAULT NULL,
  smart_goals JSONB DEFAULT NULL,
  yearly_reflection JSONB DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user, date, and type
  UNIQUE(user_id, date, type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_type ON journal_entries(type);
CREATE INDEX IF NOT EXISTS idx_journal_created ON journal_entries(created_at DESC);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own journal entries"
  ON journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_journal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS journal_entries_updated_at ON journal_entries;
CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_updated_at();
