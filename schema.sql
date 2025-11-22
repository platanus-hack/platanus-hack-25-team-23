-- Notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'read', 'understood'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, slug)
);

-- Edges table (for graph relationships)
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  relationship VARCHAR(50) DEFAULT 'mentions', -- 'mentions', 'prerequisite', 'leads_to'
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, target_id)
);

-- User progress/stats
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_notes INT DEFAULT 0,
  understood_notes INT DEFAULT 0,
  total_time_seconds INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_parent ON notes(parent_id);
CREATE INDEX idx_edges_user ON edges(user_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
