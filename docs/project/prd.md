# Product Requirements Document: KnowledgeFlow MVP

## Executive Summary

**Product Name:** KnowledgeFlow (working title)
**Version:** MVP/POC
**Last Updated:** 2025-11-22

KnowledgeFlow is an interactive knowledge graph platform that enables users to learn any topic through AI-generated, interconnected notes. When a user queries a topic, the system generates a comprehensive note with clickable terms. Clicking any unknown term instantly generates a new contextualized note and updates the visual knowledge graph in real-time.

---

## Problem Statement

### Current Pain Points
1. **Context Switching:** When studying, users encounter unknown terms and must open new tabs, query AI separately, wait for responses, losing focus on the original topic
2. **No Learning Path:** Users don't know what prerequisites they need or what comes next
3. **Knowledge Silos:** Information learned isn't connected or accumulated
4. **No Progress Tracking:** Users can't visualize what they've learned or identify gaps

### Target User
- Students (university, self-learners)
- Professionals learning new domains
- Anyone who wants to deeply understand a topic without getting lost in rabbit holes

---

## Product Vision

> "Click to understand. Every term. Instantly. Connected."

A platform where knowledge expands on-demand through a visual, interactive graph. Users never leave their learning context - they click, learn, and return seamlessly.

---

## Core Features (MVP Scope)

### F1: Topic Query & Note Generation
**Description:** User inputs a topic, system generates a structured note with embedded clickable terms.

**User Story:**
> As a learner, I want to input any topic and receive a well-structured explanation with key terms highlighted, so I can identify what I need to learn deeper.

**Acceptance Criteria:**
- [ ] Text input field for topic query
- [ ] Loading state with visual feedback ("Generating knowledge...")
- [ ] Generated note displays in markdown format
- [ ] All technical terms are rendered as clickable links
- [ ] Note includes: definition, key concepts, relationships, examples
- [ ] Response time < 10 seconds for initial generation

**Technical Notes:**
- Use Claude API (claude-sonnet-4-20250514) for generation
- Prompt must follow atomic note principles (see Appendix A)
- Links format: `[[Term]]` rendered as clickable elements

---

### F2: Click-to-Generate (On-Demand Expansion)
**Description:** Clicking any term in a note instantly generates a new note for that term, contextualized to the parent topic.

**User Story:**
> As a learner, I want to click on any unknown term and immediately see its explanation in context, so I don't lose my learning flow.

**Acceptance Criteria:**
- [ ] Clicking a `[[term]]` triggers generation of new note
- [ ] New note appears in split view or modal (user can configure)
- [ ] New note is contextualized: explains term in relation to parent topic
- [ ] Loading indicator shows on the clicked term while generating
- [ ] Generated note is automatically saved to user's knowledge base
- [ ] Breadcrumb navigation shows: Parent Topic > Current Term

**Technical Notes:**
- Context window must include parent note for relevance
- Prompt: "Explain [[Term]] in the context of learning about [[Parent Topic]]"
- Queue system if user clicks multiple terms rapidly

---

### F3: Interactive Knowledge Graph
**Description:** Real-time visual graph showing all generated notes and their connections.

**User Story:**
> As a learner, I want to see a visual map of everything I've learned and how concepts connect, so I can understand the bigger picture and track my progress.

**Acceptance Criteria:**
- [ ] Graph panel visible alongside note panel (resizable)
- [ ] Each node = one generated note
- [ ] Edges = links between notes (bidirectional)
- [ ] New nodes animate into existence when generated (reinforcement feedback)
- [ ] Nodes are color-coded by status: new (blue), read (yellow), mastered (green)
- [ ] Click node in graph → displays that note
- [ ] Zoom, pan, and drag nodes
- [ ] Node size reflects connectivity (more connections = larger)

**Technical Notes:**
- Use Cytoscape.js or D3-force for graph rendering
- WebSocket or polling for real-time updates
- Graph layout: force-directed with clustering by topic area

---

### F4: Learning Progress Tracking
**Description:** Users can mark notes as "understood" and track their learning progress.

**User Story:**
> As a learner, I want to mark concepts as understood and see my overall progress, so I feel motivated and know what I still need to learn.

**Acceptance Criteria:**
- [ ] Each note has "Mark as Understood" button
- [ ] Understood notes change color in graph (yellow → green)
- [ ] Progress bar shows: X/Y concepts understood in current topic tree
- [ ] "Suggested Next" section recommends unread connected nodes
- [ ] Dashboard shows overall stats: total notes, understood, time spent

---

### F5: Prerequisite & Next Steps Suggestions
**Description:** System identifies what user should learn before and after current topic.

**User Story:**
> As a learner, I want to know what I should understand before this topic and what I can learn next, so I have a clear learning path.

**Acceptance Criteria:**
- [ ] Each note shows "Prerequisites" section (concepts you should know first)
- [ ] Each note shows "What's Next" section (where to go deeper)
- [ ] Prerequisites that don't exist yet are clickable (triggers generation)
- [ ] Visual indication in graph for prerequisite relationships (directed edges)

**Technical Notes:**
- LLM determines prerequisites based on topic complexity
- Format in prompt: "List 2-3 prerequisite concepts and 2-3 follow-up topics"

---

### F6: Note Viewer with Rich Formatting
**Description:** Display generated notes with proper formatting, code blocks, math, and diagrams.

**User Story:**
> As a learner, I want notes to be beautifully formatted with code examples, math formulas, and diagrams, so complex topics are easier to understand.

**Acceptance Criteria:**
- [ ] Markdown rendering with syntax highlighting for code
- [ ] LaTeX rendering for mathematical notation (KaTeX)
- [ ] Mermaid diagram support
- [ ] Callout blocks for: key ideas, warnings, examples, observations
- [ ] Responsive design (mobile-friendly)

**Callout Syntax (from BrainFlow):**
```
- & Key idea (use sparingly)
- ! Main point of paragraph
- !! Warning
- ? Question to explore
- > Deeper dive in [[linked note]]
- Ex: One-line example
- Obs: Observation
```

---

## Non-Functional Requirements

### Performance
- Initial note generation: < 10 seconds
- Subsequent note generation: < 8 seconds (cached context)
- Graph update latency: < 500ms after note generated
- Support 100 concurrent users (MVP)

### Scalability
- Notes stored per user (no cross-user sharing in MVP)
- Graph queries optimized for up to 500 nodes per user

### Security
- User authentication required
- API keys stored server-side only
- Notes are private per user

---

## Technical Architecture

### System Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Query Input │  │ Note Viewer │  │ Knowledge Graph (Canvas)│  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ REST API / WebSocket
┌──────────────────────────┼──────────────────────────────────────┐
│                          │         BACKEND                      │
│  ┌───────────────────────▼───────────────────────────────────┐  │
│  │                    API Gateway                            │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────────┐  ┌────▼────────┐  ┌───────────────────────┐  │
│  │ Auth Service  │  │ Note Service│  │ Graph Service         │  │
│  │ (Clerk/Auth0) │  │             │  │                       │  │
│  └───────────────┘  └────┬────────┘  └───────────┬───────────┘  │
│                          │                       │              │
│                    ┌─────▼─────┐          ┌──────▼──────┐       │
│                    │ Claude API│          │ Graph Query │       │
│                    │ (Anthropic)│         │   Engine    │       │
│                    └───────────┘          └─────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     DATABASE LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              PostgreSQL / Supabase                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐   │    │
│  │  │ users   │  │ notes   │  │ edges   │  │ progress  │   │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └───────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router) | SSR, API routes, React ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development |
| Graph Visualization | Cytoscape.js | Performant, extensible, good docs |
| Markdown Rendering | react-markdown + remark-gfm | Flexible, supports plugins |
| Math Rendering | KaTeX | Faster than MathJax |
| Diagrams | Mermaid | Native markdown support |
| Backend | Next.js API Routes | Unified codebase, simpler deployment |
| Database | Supabase (PostgreSQL) | Auth included, real-time subscriptions, free tier |
| AI | Claude API (Anthropic) | Best reasoning for educational content |
| Auth | Supabase Auth | Integrated with DB |
| Deployment | Vercel | Optimized for Next.js |

---

## Database Schema

```sql
-- Users (handled by Supabase Auth)

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
```

---

## API Endpoints

### Notes API

```
POST /api/notes/generate
Body: { topic: string, parentId?: string }
Response: { note: Note, edges: Edge[] }

GET /api/notes
Query: ?userId=xxx
Response: { notes: Note[] }

GET /api/notes/:id
Response: { note: Note }

PATCH /api/notes/:id/status
Body: { status: 'read' | 'understood' }
Response: { note: Note }
```

### Graph API

```
GET /api/graph
Query: ?userId=xxx
Response: { nodes: Node[], edges: Edge[] }

GET /api/graph/suggestions
Query: ?noteId=xxx
Response: { prerequisites: string[], nextSteps: string[] }
```

### User API

```
GET /api/user/stats
Response: { totalNotes, understoodNotes, totalTime }
```

---

## LLM Prompt Template

### Note Generation Prompt

```markdown
You are KnowledgeFlow, an AI that generates atomic, interconnected knowledge notes.

## Instructions

Generate a comprehensive note about: {{TOPIC}}
{{#if PARENT_TOPIC}}
Context: The user is learning this as part of understanding {{PARENT_TOPIC}}.
Make sure to explain how {{TOPIC}} relates to {{PARENT_TOPIC}}.
{{/if}}

## Output Format

Return a JSON object with this exact structure:

{
  "title": "Topic Title",
  "content": "Markdown content (see format below)",
  "linkedTerms": ["term1", "term2", ...],
  "prerequisites": ["prereq1", "prereq2"],
  "nextSteps": ["next1", "next2"]
}

## Content Format Rules

1. **Structure**: Start with a clear definition, then expand with sections
2. **Clickable Terms**: Wrap technical terms in [[double brackets]]
   - Terms should be singular and capitalized: [[Machine Learning]], not [[machine learning]]
   - Only link terms that genuinely need explanation
   - Aim for 5-15 linked terms per note
3. **Callouts**: Use these markers for emphasis:
   - `- & ` Key insight (use once per note)
   - `- ! ` Important point
   - `- !! ` Warning or common misconception
   - `- ? ` Question to explore further
   - `- Ex: ` Brief example
   - `- Obs: ` Observation
4. **Math**: Use LaTeX with single $ for inline, $$ for block
5. **Code**: Use fenced code blocks with language identifier
6. **Length**: 300-600 words optimal
7. **Tone**: First person, direct, educational

## Example Output

{
  "title": "Neural Network",
  "content": "A [[Neural Network]] is a computational model inspired by biological [[neuron]]s...\n\n- & The key insight is that neural networks learn by adjusting connection weights.\n\n## Architecture\n\nA basic neural network consists of:\n- Input layer: receives [[feature]]s\n- Hidden [[layer]]s: perform transformations\n- Output layer: produces predictions\n\n- ! Each connection has a [[weight]] that determines signal strength.\n\n## Learning Process\n\nNetworks learn through [[backpropagation]]:\n$$\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial a} \\cdot \\frac{\\partial a}{\\partial w}$$\n\n- Ex: A network classifying images adjusts weights when it mislabels a cat as a dog.",
  "linkedTerms": ["neuron", "feature", "layer", "weight", "backpropagation"],
  "prerequisites": ["Linear Algebra", "Calculus", "Gradient Descent"],
  "nextSteps": ["Convolutional Neural Network", "Activation Function", "Loss Function"]
}
```

---

## User Interface Specifications

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧠 KnowledgeFlow                    [Search] [Profile] [Stats]     │
├───────────────────────────────────┬─────────────────────────────────┤
│                                   │                                 │
│                                   │                                 │
│        NOTE PANEL (60%)           │      GRAPH PANEL (40%)          │
│                                   │                                 │
│  ┌─────────────────────────────┐  │  ┌───────────────────────────┐  │
│  │ Breadcrumb: Home > ML > NN  │  │  │                           │  │
│  ├─────────────────────────────┤  │  │     ○────○                │  │
│  │                             │  │  │    /      \               │  │
│  │  # Neural Network           │  │  │   ○        ●──○           │  │
│  │                             │  │  │    \      /               │  │
│  │  A [[Neural Network]] is... │  │  │     ○────○                │  │
│  │                             │  │  │                           │  │
│  │  ## Architecture            │  │  │  ● = current node         │  │
│  │  ...                        │  │  │  ○ = connected nodes      │  │
│  │                             │  │  │                           │  │
│  │  [Mark as Understood ✓]     │  │  └───────────────────────────┘  │
│  └─────────────────────────────┘  │                                 │
│                                   │  Progress: ████░░░░ 12/30       │
│  Prerequisites: [[Linear Alg]]    │                                 │
│  Next: [[CNN]], [[Activation]]    │  Suggested: [[Backpropagation]] │
│                                   │                                 │
└───────────────────────────────────┴─────────────────────────────────┘
```

### Interactions

| Element | Action | Result |
|---------|--------|--------|
| `[[term]]` in note | Click | Generate new note, add to graph, show in panel |
| Node in graph | Click | Load that note in panel |
| Node in graph | Hover | Show title + status tooltip |
| "Mark as Understood" | Click | Change node color, update progress |
| Search bar | Type + Enter | Generate new root topic |
| Graph | Scroll | Zoom in/out |
| Graph | Drag background | Pan |
| Graph | Drag node | Reposition |
| Panel divider | Drag | Resize panels |

### Visual Design

**Color Palette:**
- Primary: #6366F1 (Indigo)
- Background: #0F172A (Slate 900)
- Surface: #1E293B (Slate 800)
- Text: #F8FAFC (Slate 50)
- Node New: #3B82F6 (Blue)
- Node Read: #FBBF24 (Yellow)
- Node Understood: #22C55E (Green)
- Edge: #475569 (Slate 600)
- Edge Prerequisite: #F97316 (Orange, directed)

**Typography:**
- Headers: Inter (sans-serif)
- Body: Inter
- Code: JetBrains Mono
- Math: KaTeX default

---

## User Flows

### Flow 1: First-Time User
```
1. User lands on homepage
2. User signs up (email/Google via Supabase)
3. Onboarding modal: "What do you want to learn?"
4. User types: "Machine Learning"
5. Loading state with animation
6. Note appears + first node in graph
7. Tooltip: "Click any [[blue term]] to learn more!"
8. User clicks [[Neural Network]]
9. New note generates, graph animates new node
10. User continues exploring
```

### Flow 2: Returning User
```
1. User logs in
2. Dashboard shows: recent notes, progress stats
3. Graph shows all previous knowledge
4. User clicks node to continue where they left off
5. Or searches new topic to start new branch
```

### Flow 3: Marking Progress
```
1. User reads note fully
2. Clicks "Mark as Understood"
3. Node turns green in graph
4. Progress bar updates
5. "Suggested Next" updates based on remaining connections
```

---

## Success Metrics (Post-MVP)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Note | < 15 seconds | From signup to first generated note |
| Notes per Session | > 5 | Average notes generated per session |
| Return Rate | > 40% | Users who return within 7 days |
| Completion Rate | > 20% | Notes marked as "understood" / total |
| NPS | > 50 | Net Promoter Score from surveys |

---

## MVP Scope Boundaries

### In Scope
- [x] Single user accounts
- [x] Topic query + note generation
- [x] Click-to-generate expansion
- [x] Interactive knowledge graph
- [x] Basic progress tracking
- [x] Prerequisite/next suggestions
- [x] Responsive web design

### Out of Scope (Future)
- [ ] Collaborative/shared graphs
- [ ] Spaced repetition (Anki-style)
- [ ] Export to Obsidian/Notion
- [ ] Mobile native apps
- [ ] Offline mode
- [ ] Custom prompt customization
- [ ] Multiple AI model options
- [ ] Knowledge graph templates
- [ ] Quizzes/assessments
- [ ] API for third-party integrations

---

## Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Next.js project setup with TypeScript
- [ ] Supabase integration (auth + database)
- [ ] Basic UI layout (note panel + graph panel)
- [ ] Claude API integration
- [ ] Single note generation working

### Phase 2: Core Loop (Week 2)
- [ ] Click-to-generate functionality
- [ ] Graph visualization with Cytoscape
- [ ] Real-time graph updates
- [ ] Note linking and navigation

### Phase 3: Polish (Week 3)
- [ ] Progress tracking
- [ ] Prerequisites/next steps
- [ ] Loading states and animations
- [ ] Error handling
- [ ] Mobile responsiveness

### Phase 4: Launch Prep (Week 4)
- [ ] Performance optimization
- [ ] Edge cases handling
- [ ] User testing and feedback
- [ ] Documentation
- [ ] Deployment to Vercel

---

## Appendix A: BrainFlow Prompt Principles

The note generation system is based on proven principles from the BrainFlow Obsidian system:

1. **Atomic Notes**: Each note contains one main concept, fully explained
2. **Bidirectional Linking**: Terms wrapped in `[[brackets]]` create connections
3. **Contextual**: Notes explain terms in relation to parent topics
4. **Progressive Disclosure**: Core idea first, then deeper sections
5. **Callout System**: Standardized markers for key insights, warnings, examples
6. **No Orphans**: Every note connects to at least one other note

---

## Appendix B: Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| API timeout | "Taking longer than expected... Still thinking!" | Retry with backoff |
| API rate limit | "High demand right now. Please wait a moment." | Queue request |
| Invalid topic | "Hmm, I couldn't generate that. Try rephrasing?" | Show input again |
| Network error | "Connection lost. Retrying..." | Auto-retry 3x |
| Auth expired | "Session expired. Please log in again." | Redirect to login |

---

## Appendix C: Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

*Document Version: 1.0*
*Created: 2025-11-22*
*Authors: André & Co-founder*
