# Backend Architecture - BrainFlow

## Overview

This document specifies the backend architecture for BrainFlow, an AI-powered knowledge management platform. The backend is built with **Next.js App Router** using API Routes, **Supabase** for database and authentication, and **OpenAI** for AI features.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Supabase) |
| **Authentication** | Supabase Auth |
| **AI Provider** | OpenAI GPT-4o |
| **Cache** | Supabase Edge Functions / Vercel KV (optional) |
| **File Storage** | Supabase Storage |
| **Deployment** | Vercel |

---

## Database Schema

### Core Tables

```sql
-- Users (managed by Supabase Auth, extended with profile)
CREATE TABLE profiles (
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

-- Life Areas (7 customizable areas)
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL, -- hex color
  icon TEXT NOT NULL, -- emoji
  order_position INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Concepts (knowledge nodes)
CREATE TABLE concepts (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Study Content (AI-generated notes)
CREATE TABLE study_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- markdown
  word_count INTEGER,
  estimated_read_time INTEGER, -- minutes
  linked_concepts TEXT[], -- array of concept slugs
  prerequisites TEXT[], -- array of concept slugs
  next_steps TEXT[], -- array of concept slugs
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  generated_by TEXT DEFAULT 'ai' CHECK (generated_by IN ('ai', 'user')),
  ai_model TEXT,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Concept Relationships (graph edges)
CREATE TABLE concept_relationships (
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

-- Folders (library organization)
CREATE TABLE folders (
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

-- Folder Contents (many-to-many)
CREATE TABLE folder_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  study_content_id UUID REFERENCES study_content(id) ON DELETE CASCADE,
  order_position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, study_content_id)
);

-- User Progress
CREATE TABLE user_progress (
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

-- Nodi Suggestions
CREATE TABLE nodi_suggestions (
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

-- Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  study_content_id UUID REFERENCES study_content(id) ON DELETE SET NULL,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Roadmaps
CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  concept_ids UUID[], -- ordered array
  estimated_hours DECIMAL,
  progress INTEGER DEFAULT 0, -- 0-100
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_concepts_user_id ON concepts(user_id);
CREATE INDEX idx_concepts_area_id ON concepts(area_id);
CREATE INDEX idx_concepts_status ON concepts(status);
CREATE INDEX idx_study_content_user_id ON study_content(user_id);
CREATE INDEX idx_study_content_concept_id ON study_content(concept_id);
CREATE INDEX idx_relationships_user_id ON concept_relationships(user_id);
CREATE INDEX idx_relationships_source ON concept_relationships(source_concept_id);
CREATE INDEX idx_relationships_target ON concept_relationships(target_concept_id);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);

-- Row Level Security (RLS)
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

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can CRUD own areas" ON areas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own concepts" ON concepts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own study_content" ON study_content FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own relationships" ON concept_relationships FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own folders" ON folders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own progress" ON user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own suggestions" ON nodi_suggestions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own analytics" ON analytics_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own roadmaps" ON roadmaps FOR ALL USING (auth.uid() = user_id);
-- Public roadmaps can be viewed by anyone
CREATE POLICY "Anyone can view public roadmaps" ON roadmaps FOR SELECT USING (is_public = true);
```

---

## API Endpoints

All API routes are located in `src/app/api/` following Next.js App Router conventions.

### Authentication (Supabase Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout current user |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user profile |

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get user profile |
| PUT | `/api/profile` | Update profile (name, avatar, level) |
| PUT | `/api/profile/preferences` | Update preferences |
| GET | `/api/profile/stats` | Get user statistics |

### Concepts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/concepts` | List concepts (with filters: area, status, level) |
| GET | `/api/concepts/[id]` | Get single concept |
| POST | `/api/concepts` | Create concept |
| PUT | `/api/concepts/[id]` | Update concept |
| DELETE | `/api/concepts/[id]` | Delete concept |
| PATCH | `/api/concepts/[id]/status` | Update concept status |
| POST | `/api/concepts/[id]/mark-understood` | Mark as understood |
| GET | `/api/concepts/[id]/prerequisites` | Get prerequisites |
| GET | `/api/concepts/[id]/next-steps` | Get next steps |
| GET | `/api/concepts/[id]/related` | Get related concepts |

### Study Content (Notes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | List all notes |
| GET | `/api/notes/[id]` | Get single note |
| POST | `/api/notes` | Create manual note |
| PUT | `/api/notes/[id]` | Update note |
| DELETE | `/api/notes/[id]` | Delete note |
| POST | `/api/notes/[id]/rate` | Rate note quality (1-5) |
| POST | `/api/notes/[id]/export` | Export as Markdown |

### Note Generation (AI) - Core Feature

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notes/generate` | Generate note from topic (streaming) |
| GET | `/api/notes/generate/[jobId]/status` | Check generation status |
| POST | `/api/notes/generate/[jobId]/cancel` | Cancel generation |

**Request Body for `/api/notes/generate`:**
```typescript
{
  topic: string;                    // Required: topic to generate
  level?: 'beginner' | 'intermediate' | 'expert'; // User level
  parentConceptId?: string;         // Context from parent concept
  areaId?: string;                  // Assign to specific area
}
```

**Response (Streaming JSON):**
```typescript
{
  title: string;
  content: string;                  // Markdown with [[linked-terms]]
  linkedTerms: string[];            // Extracted concepts
  prerequisites: string[];          // Prerequisite topics
  nextSteps: string[];              // Recommended next topics
  area?: string;                    // Detected area
  estimatedReadTime: number;        // Minutes
}
```

### Areas (Life Areas)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/areas` | List all areas |
| POST | `/api/areas` | Create area |
| PUT | `/api/areas/[id]` | Update area (name, color, icon) |
| DELETE | `/api/areas/[id]` | Delete area |
| POST | `/api/areas/reorder` | Reorder areas |
| GET | `/api/areas/[id]/progress` | Get area progress stats |

### Folders (Library)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders` | List all folders (hierarchical) |
| GET | `/api/folders/[id]` | Get folder with contents |
| POST | `/api/folders` | Create folder |
| PUT | `/api/folders/[id]` | Update folder |
| DELETE | `/api/folders/[id]` | Delete folder |
| POST | `/api/folders/[id]/move` | Move folder |
| POST | `/api/folders/[id]/add-content` | Add note to folder |
| DELETE | `/api/folders/[id]/remove-content/[noteId]` | Remove note from folder |

### Library Auto-Organization (AI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/library/organize` | Trigger AI organization |
| GET | `/api/library/organize/[jobId]/status` | Check organization status |
| POST | `/api/library/organize/[jobId]/apply` | Apply changes |
| POST | `/api/library/organize/[jobId]/reject` | Reject changes |
| PUT | `/api/library/settings` | Update auto-organize settings |

### Knowledge Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/graph` | Get full graph (nodes + edges) |
| GET | `/api/graph/area/[areaId]` | Get subgraph for area |
| GET | `/api/graph/path` | Get learning path (from A to B) |
| POST | `/api/graph/nodes/[id]/position` | Save node position |
| GET | `/api/graph/recommendations` | Get recommended concepts |
| POST | `/api/graph/state` | Save view state (zoom, pan) |

### Nodi Assistant (AI Suggestions)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nodi/suggestions` | Get current suggestions |
| POST | `/api/nodi/suggestions/[id]/dismiss` | Dismiss suggestion |
| POST | `/api/nodi/suggestions/[id]/action` | Log action taken |
| POST | `/api/nodi/generate` | Generate new suggestions |

### Progress & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress` | Get overall progress |
| GET | `/api/progress/area/[areaId]` | Get area progress |
| GET | `/api/progress/timeline` | Get progress over time |
| POST | `/api/progress/[conceptId]` | Update concept progress |
| GET | `/api/badges` | Get user achievements |
| POST | `/api/analytics/event` | Log analytics event |
| POST | `/api/analytics/batch` | Batch log events |

### Roadmaps

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/roadmaps` | List user roadmaps |
| POST | `/api/roadmaps` | Create roadmap |
| GET | `/api/roadmaps/[id]` | Get roadmap details |
| PUT | `/api/roadmaps/[id]` | Update roadmap |
| DELETE | `/api/roadmaps/[id]` | Delete roadmap |
| POST | `/api/roadmaps/[id]/start` | Start roadmap |
| POST | `/api/roadmaps/[id]/complete` | Mark complete |
| POST | `/api/roadmaps/[id]/share` | Generate share link |
| GET | `/api/roadmaps/public/[token]` | View public roadmap |

---

## API Route Implementation Examples

### File Structure

```
src/app/api/
├── auth/
│   ├── register/route.ts
│   ├── login/route.ts
│   ├── logout/route.ts
│   ├── refresh/route.ts
│   └── me/route.ts
├── profile/
│   ├── route.ts
│   ├── preferences/route.ts
│   └── stats/route.ts
├── concepts/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── status/route.ts
│       ├── mark-understood/route.ts
│       ├── prerequisites/route.ts
│       ├── next-steps/route.ts
│       └── related/route.ts
├── notes/
│   ├── route.ts
│   ├── generate/
│   │   ├── route.ts
│   │   └── [jobId]/
│   │       ├── status/route.ts
│   │       └── cancel/route.ts
│   └── [id]/
│       ├── route.ts
│       ├── rate/route.ts
│       └── export/route.ts
├── areas/
│   ├── route.ts
│   ├── reorder/route.ts
│   └── [id]/
│       ├── route.ts
│       └── progress/route.ts
├── folders/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── move/route.ts
│       ├── add-content/route.ts
│       └── remove-content/[noteId]/route.ts
├── library/
│   ├── organize/
│   │   ├── route.ts
│   │   └── [jobId]/
│   │       ├── status/route.ts
│   │       ├── apply/route.ts
│   │       └── reject/route.ts
│   └── settings/route.ts
├── graph/
│   ├── route.ts
│   ├── area/[areaId]/route.ts
│   ├── path/route.ts
│   ├── recommendations/route.ts
│   ├── state/route.ts
│   └── nodes/[id]/position/route.ts
├── nodi/
│   ├── suggestions/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── dismiss/route.ts
│   │       └── action/route.ts
│   └── generate/route.ts
├── progress/
│   ├── route.ts
│   ├── timeline/route.ts
│   ├── area/[areaId]/route.ts
│   └── [conceptId]/route.ts
├── badges/route.ts
├── analytics/
│   ├── event/route.ts
│   └── batch/route.ts
└── roadmaps/
    ├── route.ts
    ├── public/[token]/route.ts
    └── [id]/
        ├── route.ts
        ├── start/route.ts
        ├── complete/route.ts
        └── share/route.ts
```

### Example: Note Generation Endpoint

```typescript
// src/app/api/notes/generate/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@ai-sdk/openai'
import { streamObject } from 'ai'
import { noteSchema } from '@/lib/ai/schema'
import { generateNotePrompt } from '@/lib/ai/prompts'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { topic, level = 'beginner', parentConceptId, areaId } = body

  if (!topic) {
    return Response.json({ error: 'Topic is required' }, { status: 400 })
  }

  // Get user context
  const { data: profile } = await supabase
    .from('profiles')
    .select('level, preferences')
    .eq('id', user.id)
    .single()

  // Get parent concept context if provided
  let parentContext = ''
  if (parentConceptId) {
    const { data: parent } = await supabase
      .from('concepts')
      .select('name, definition')
      .eq('id', parentConceptId)
      .single()

    if (parent) {
      parentContext = `Context: The user is learning about "${parent.name}" (${parent.definition}). `
    }
  }

  // Generate prompt
  const prompt = generateNotePrompt({
    topic,
    level: level || profile?.level || 'beginner',
    parentContext,
  })

  // Stream the response
  const result = streamObject({
    model: openai('gpt-4o'),
    schema: noteSchema,
    prompt,
  })

  return result.toTextStreamResponse()
}
```

### Example: Get Graph Endpoint

```typescript
// src/app/api/graph/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const viewMode = searchParams.get('viewMode') || 'area'
  const includeYouNode = searchParams.get('includeYouNode') !== 'false'

  // Get all concepts (nodes)
  const { data: concepts } = await supabase
    .from('concepts')
    .select(`
      id, name, slug, status, level, is_central,
      area:areas(id, name, color, icon)
    `)
    .eq('user_id', user.id)

  // Get all relationships (edges)
  const { data: relationships } = await supabase
    .from('concept_relationships')
    .select('id, source_concept_id, target_concept_id, relationship_type, strength')
    .eq('user_id', user.id)

  // Get areas for area nodes
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, color, icon')
    .eq('user_id', user.id)

  // Build graph structure
  const nodes = []
  const links = []

  // Add "Yo" central node if requested
  if (includeYouNode) {
    nodes.push({
      id: 'yo',
      name: 'Yo',
      status: 'understood',
      area: 'Centro',
      level: 'basic',
      isYouNode: true,
    })

    // Connect Yo to all areas
    areas?.forEach(area => {
      links.push({
        source: 'yo',
        target: `area-${area.id}`,
      })
    })
  }

  // Add area nodes
  areas?.forEach(area => {
    nodes.push({
      id: `area-${area.id}`,
      name: area.name,
      status: 'understood',
      area: area.name,
      color: area.color,
      icon: area.icon,
      level: 'basic',
      isAreaNode: true,
    })
  })

  // Add concept nodes
  concepts?.forEach(concept => {
    nodes.push({
      id: concept.id,
      name: concept.name,
      slug: concept.slug,
      status: concept.status,
      area: concept.area?.name || 'Sin area',
      color: concept.area?.color,
      level: concept.level,
      isCentral: concept.is_central,
    })

    // Connect to area node
    if (concept.area) {
      links.push({
        source: `area-${concept.area.id}`,
        target: concept.id,
      })
    }
  })

  // Add relationship links
  relationships?.forEach(rel => {
    links.push({
      source: rel.source_concept_id,
      target: rel.target_concept_id,
      type: rel.relationship_type,
      strength: rel.strength,
    })
  })

  return Response.json({
    nodes,
    links,
    metadata: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      viewMode,
    }
  })
}
```

---

## AI Integration Architecture

### Prompts Structure

```typescript
// src/lib/ai/prompts.ts

export function generateNotePrompt({
  topic,
  level,
  parentContext = '',
}: {
  topic: string
  level: 'beginner' | 'intermediate' | 'expert'
  parentContext?: string
}) {
  const levelInstructions = {
    beginner: 'Use simple language, avoid jargon, provide many examples',
    intermediate: 'Balance theory and practice, introduce technical terms with explanations',
    expert: 'Use technical language, focus on nuances and advanced concepts',
  }

  return `You are a pedagogical expert following Vygotsky's Zone of Proximal Development and Ausubel's meaningful learning theory. Generate an educational note about "${topic}".

${parentContext}

User level: ${level}
Level instructions: ${levelInstructions[level]}

Requirements:
1. Write 400-600 words in Spanish
2. Use markdown formatting
3. Include key concepts as [[bracketed-links]] that users can click to learn more
4. Use these callouts:
   - "- &" for key concepts/definitions
   - "- !" for important notes
   - "- Ex:" for examples
   - "- ?" for questions to consider
   - "- Obs:" for observations
5. Extract 5-8 clickable concepts
6. Identify 2-4 prerequisites
7. Suggest 2-3 next steps

Output JSON with:
{
  "title": "Clear descriptive title",
  "content": "Markdown content with [[linked-terms]]",
  "linkedTerms": ["term1", "term2", ...],
  "prerequisites": ["prereq1", "prereq2", ...],
  "nextSteps": ["step1", "step2", ...],
  "estimatedReadTime": number (minutes)
}`
}

export function generateOrganizationPrompt(notes: Array<{ title: string; content: string }>) {
  return `You are an intelligent library organizer. Analyze these notes and suggest a folder structure.

Notes to organize:
${notes.map((n, i) => `${i + 1}. "${n.title}": ${n.content.slice(0, 200)}...`).join('\n')}

Requirements:
1. Group related notes into folders
2. Create max 3 levels of hierarchy
3. Suggest descriptive folder names in Spanish
4. Assign appropriate emoji icons
5. Provide confidence score (0-1) for each grouping

Output JSON:
{
  "folders": [
    {
      "name": "Folder name",
      "icon": "emoji",
      "description": "Brief description",
      "noteIndices": [0, 2, 5],
      "confidence": 0.95,
      "subfolders": [...]
    }
  ]
}`
}

export function generateSuggestionsPrompt(context: {
  currentConcept: { name: string; status: string }
  prerequisites: Array<{ name: string; status: string }>
  userProgress: { understood: number; total: number }
}) {
  return `You are Nodi, a helpful learning assistant. Generate personalized suggestions for the user.

Current context:
- Viewing: "${context.currentConcept.name}" (status: ${context.currentConcept.status})
- Prerequisites: ${context.prerequisites.map(p => `${p.name} (${p.status})`).join(', ')}
- Overall progress: ${context.userProgress.understood}/${context.userProgress.total} concepts understood

Generate 1-3 suggestions of these types:
- "prerequisite": Missing knowledge they need first
- "next_step": Ready to learn something new
- "review": Time to review something
- "achievement": Celebrate progress

Output JSON array:
[
  {
    "type": "prerequisite|next_step|review|achievement",
    "message": "Helpful message in Spanish",
    "actionLabel": "Button text (optional)",
    "actionConceptSlug": "concept-slug (optional)",
    "priority": 1-5
  }
]`
}
```

### Schema Definitions

```typescript
// src/lib/ai/schema.ts
import { z } from 'zod'

export const noteSchema = z.object({
  title: z.string().describe('Clear, descriptive title'),
  content: z.string().describe('Markdown content with [[linked-terms]]'),
  linkedTerms: z.array(z.string()).describe('Extracted concepts to link'),
  prerequisites: z.array(z.string()).describe('Required prior knowledge'),
  nextSteps: z.array(z.string()).describe('Recommended next topics'),
  estimatedReadTime: z.number().describe('Reading time in minutes'),
})

export const organizationSchema = z.object({
  folders: z.array(z.object({
    name: z.string(),
    icon: z.string(),
    description: z.string(),
    noteIds: z.array(z.string()),
    confidence: z.number(),
    subfolders: z.array(z.lazy(() => z.any())).optional(),
  })),
})

export const suggestionSchema = z.array(z.object({
  type: z.enum(['prerequisite', 'next_step', 'review', 'achievement']),
  message: z.string(),
  actionLabel: z.string().optional(),
  actionConceptSlug: z.string().optional(),
  priority: z.number().min(1).max(5),
}))
```

---

## Authentication Flow

```
1. User registers/logs in via Supabase Auth
2. Supabase returns JWT access token + refresh token
3. Access token stored in memory, refresh in httpOnly cookie
4. All API calls include Authorization: Bearer <token>
5. Middleware validates token on every request
6. Token refresh happens automatically via Supabase client
```

### Middleware

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect API routes (except auth routes)
  if (request.nextUrl.pathname.startsWith('/api/') &&
      !request.nextUrl.pathname.startsWith('/api/auth/') &&
      !request.nextUrl.pathname.startsWith('/api/roadmaps/public/')) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Protect app routes
  if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/study') ||
      request.nextUrl.pathname.startsWith('/graph') ||
      request.nextUrl.pathname.startsWith('/library') ||
      request.nextUrl.pathname.startsWith('/profile')) {
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/study/:path*', '/graph/:path*', '/library/:path*', '/profile/:path*'],
}
```

---

## Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|------|---------------|-----|--------------|
| Generated notes | Supabase (persistent) | Forever | Manual delete |
| Graph structure | Client-side (React Query) | 5 min | On concept update |
| User profile | Client-side | 10 min | On profile update |
| Nodi suggestions | Server (Redis/KV) | 5 min | On concept status change |
| Analytics events | Batched, then DB | N/A | Sent every 30s |

---

## Rate Limiting

```typescript
// Implemented via middleware or API route wrapper

const RATE_LIMITS = {
  'POST /api/notes/generate': { requests: 10, window: '1d' }, // 10/day free
  'POST /api/library/organize': { requests: 1, window: '1d' }, // 1/day free
  'default': { requests: 100, window: '1m' }, // 100/min for other endpoints
}
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Vercel KV for caching
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

---

## Deployment Checklist

1. [ ] Set up Supabase project
2. [ ] Run database migrations (schema.sql)
3. [ ] Configure RLS policies
4. [ ] Set environment variables in Vercel
5. [ ] Configure OpenAI API key
6. [ ] Set up Supabase Auth providers (email, optional OAuth)
7. [ ] Configure CORS if needed
8. [ ] Set up error monitoring (Sentry)
9. [ ] Configure analytics (optional)

---

## Endpoint Count Summary

| Category | Count |
|----------|-------|
| Authentication | 5 |
| Profile | 4 |
| Concepts | 11 |
| Notes | 8 |
| Areas | 6 |
| Folders | 7 |
| Library Organization | 5 |
| Graph | 6 |
| Nodi Assistant | 4 |
| Progress & Analytics | 7 |
| Roadmaps | 9 |
| **Total** | **72 endpoints** |

---

## Priority Implementation Order

### Phase 1: MVP (Week 1-2)
1. Authentication (Supabase Auth)
2. Profile CRUD
3. Note Generation (AI)
4. Concepts CRUD
5. Basic Graph endpoint

### Phase 2: Core Features (Week 3-4)
6. Areas CRUD
7. Concept relationships
8. Study content management
9. User progress tracking

### Phase 3: Advanced Features (Week 5-6)
10. Folders & Library
11. Library auto-organization
12. Nodi suggestions
13. Roadmaps

### Phase 4: Polish (Week 7-8)
14. Analytics
15. Badges/Achievements
16. Export features
17. Sharing features
