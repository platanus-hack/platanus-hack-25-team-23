-- BrainFlow Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILES (extends Supabase Auth users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'expert')),
  preferences JSONB DEFAULT '{}',
  streak_days INTEGER DEFAULT 0,
  total_study_hours DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- AREAS (7 Life Areas)
-- ============================================
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  order_position INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Function to create default areas for new users
CREATE OR REPLACE FUNCTION public.create_default_areas()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.areas (user_id, name, description, color, icon, order_position, is_default) VALUES
    (NEW.id, 'Desarrollo Personal', 'Crecimiento y mejora continua', '#7FBFFF', '🧠', 0, true),
    (NEW.id, 'Salud y Bienestar', 'Salud fisica y mental', '#A7DEAE', '💚', 1, true),
    (NEW.id, 'Finanzas', 'Educacion financiera e inversiones', '#FFEF84', '💰', 2, true),
    (NEW.id, 'Relaciones', 'Conexiones personales y profesionales', '#F7B9C8', '💝', 3, true),
    (NEW.id, 'Hobbies', 'Pasatiempos y creatividad', '#FFD5A5', '🎨', 4, true),
    (NEW.id, 'Educacion', 'Aprendizaje academico y profesional', '#A3D4FF', '📚', 5, true),
    (NEW.id, 'Crecimiento', 'Desarrollo espiritual y proposito', '#C9B7F3', '✨', 6, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_areas();

-- ============================================
-- CONCEPTS (knowledge nodes)
-- ============================================
CREATE TABLE IF NOT EXISTS concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  definition TEXT,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  level TEXT DEFAULT 'basic' CHECK (level IN ('basic', 'intermediate', 'advanced')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'understood')),
  is_central BOOLEAN DEFAULT false,
  estimated_hours DECIMAL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  parent_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  position_x DECIMAL,
  position_y DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- ============================================
-- STUDY CONTENT (AI-generated notes)
-- ============================================
CREATE TABLE IF NOT EXISTS study_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER,
  estimated_read_time INTEGER,
  linked_concepts TEXT[],
  prerequisites TEXT[],
  next_steps TEXT[],
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  generated_by TEXT DEFAULT 'ai' CHECK (generated_by IN ('ai', 'user')),
  ai_model TEXT,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONCEPT RELATIONSHIPS (graph edges)
-- ============================================
CREATE TABLE IF NOT EXISTS concept_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('prerequisite', 'related_to', 'next_step', 'subtopic')),
  strength INTEGER DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
  source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_concept_id, target_concept_id, relationship_type)
);

-- ============================================
-- FOLDERS (library organization)
-- ============================================
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  order_position INTEGER DEFAULT 0,
  auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOLDER CONTENTS (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS folder_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  study_content_id UUID REFERENCES study_content(id) ON DELETE CASCADE,
  order_position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, study_content_id)
);

-- ============================================
-- USER PROGRESS
-- ============================================
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'understood')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  hours_spent DECIMAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  confidence_level INTEGER DEFAULT 1 CHECK (confidence_level BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, concept_id)
);

-- ============================================
-- NODI SUGGESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS nodi_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prerequisite', 'next_step', 'review', 'achievement', 'tip')),
  message TEXT NOT NULL,
  action_label TEXT,
  action_concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  action_taken BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ============================================
-- ANALYTICS EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  study_content_id UUID REFERENCES study_content(id) ON DELETE SET NULL,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROADMAPS
-- ============================================
CREATE TABLE IF NOT EXISTS roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  concept_ids UUID[],
  estimated_hours DECIMAL,
  progress INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_concepts_user_id ON concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_area_id ON concepts(area_id);
CREATE INDEX IF NOT EXISTS idx_concepts_status ON concepts(status);
CREATE INDEX IF NOT EXISTS idx_concepts_slug ON concepts(slug);
CREATE INDEX IF NOT EXISTS idx_study_content_user_id ON study_content(user_id);
CREATE INDEX IF NOT EXISTS idx_study_content_concept_id ON study_content(concept_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON concept_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON concept_relationships(source_concept_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON concept_relationships(target_concept_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_nodi_suggestions_user_id ON nodi_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON roadmaps(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodi_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Areas
CREATE POLICY "Users can CRUD own areas" ON areas FOR ALL USING (auth.uid() = user_id);

-- Concepts
CREATE POLICY "Users can CRUD own concepts" ON concepts FOR ALL USING (auth.uid() = user_id);

-- Study Content
CREATE POLICY "Users can CRUD own study_content" ON study_content FOR ALL USING (auth.uid() = user_id);

-- Concept Relationships
CREATE POLICY "Users can CRUD own relationships" ON concept_relationships FOR ALL USING (auth.uid() = user_id);

-- Folders
CREATE POLICY "Users can CRUD own folders" ON folders FOR ALL USING (auth.uid() = user_id);

-- Folder Contents (need to check folder ownership)
CREATE POLICY "Users can CRUD own folder_contents" ON folder_contents FOR ALL
  USING (EXISTS (SELECT 1 FROM folders WHERE folders.id = folder_contents.folder_id AND folders.user_id = auth.uid()));

-- User Progress
CREATE POLICY "Users can CRUD own progress" ON user_progress FOR ALL USING (auth.uid() = user_id);

-- Nodi Suggestions
CREATE POLICY "Users can CRUD own suggestions" ON nodi_suggestions FOR ALL USING (auth.uid() = user_id);

-- Analytics Events
CREATE POLICY "Users can view own analytics" ON analytics_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analytics" ON analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Roadmaps
CREATE POLICY "Users can CRUD own roadmaps" ON roadmaps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view public roadmaps" ON roadmaps FOR SELECT USING (is_public = true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_concepts_updated_at BEFORE UPDATE ON concepts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_content_updated_at BEFORE UPDATE ON study_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmaps_updated_at BEFORE UPDATE ON roadmaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Function to calculate word count
CREATE OR REPLACE FUNCTION calculate_word_count(content TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN array_length(regexp_split_to_array(content, '\s+'), 1);
END;
$$ LANGUAGE plpgsql;
