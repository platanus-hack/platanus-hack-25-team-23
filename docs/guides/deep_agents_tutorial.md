# Deep Agents Tutorial: Building a "Graph Gardener"

## 1. What is a "Deep Agent"?

A **Deep Agent** (or "Agentic System") differs from a standard Chatbot in three key ways:

1.  **The Loop (Reasoning)**: Instead of `Input -> Response`, it operates as `Input -> Thought -> Action -> Observation -> Thought -> ... -> Response`. It can "think" for multiple steps before answering.
2.  **The Hands (Tools)**: It has access to tools (APIs, Database, File System) to manipulate the world.
3.  **The Memory (State)**: It maintains context over time, often using a "Virtual Filesystem" or Knowledge Graph to store information that exceeds its context window.

In the context of **KnowledgeFlow**, a Deep Agent isn't just answering questions; it's **managing your knowledge base**. It acts as a librarian or "Graph Gardener" that organizes, links, and expands your notes autonomously.

---

## 2. Frameworks: LangGraph vs. Vercel AI SDK

You mentioned the **LangChain Deep Agents** framework. Here is the comparison for your specific stack:

| Feature | LangGraph (LangChain) | Vercel AI SDK (Current Stack) |
| :--- | :--- | :--- |
| **Core Concept** | State Machines (Nodes & Edges) | Recursive Tool Calling Loop |
| **Best For** | Complex, branching flows with many sub-agents | Streamlined, full-stack React/Next.js apps |
| **State Mgmt** | Explicit `State` object passed between nodes | Implicit `messages` array + Server State |
| **Complexity** | High (requires learning graph syntax) | Low (uses standard JS/TS functions) |
| **Streaming** | Requires specialized setup | Native, instant streaming to UI |

**Recommendation**: Since you are already using **Next.js** and the **Vercel AI SDK**, you can achieve "Deep Agent" capabilities using the **`maxSteps`** pattern without introducing the heavy complexity of LangGraph. We will build a "Deep Agent" using the Vercel AI SDK that mimics the capabilities of LangChain's "Deep Research" agents.

---

## 3. Implementation Guide: The "Graph Gardener"

We will build an agent that can **Plan**, **Research**, and **Execute** changes to your Knowledge Graph.

### Step 1: Define the "Virtual Filesystem" (Database Tools)

In a web app, we don't edit local files. We edit **Database Rows**. We map "File Operations" to "Supabase Actions".

**`src/lib/ai/tools.ts`**

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const getTools = (user: any) => ({
  // 1. READ: Search the "Vault"
  search_notes: tool({
    description: 'Search existing notes in the knowledge graph to find context or avoid duplicates.',
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      const supabase = await createClient();
      const { data } = await supabase.rpc('search_notes', { query_text: query, user_id: user.id });
      return data;
    },
  }),

  // 2. CREATE: Add a new note
  create_note: tool({
    description: 'Create a new atomic note. Use this to expand the graph.',
    parameters: z.object({
      title: z.string(),
      content: z.string().describe('Markdown content'),
      parentId: z.string().optional().describe('ID of the parent note to link to'),
    }),
    execute: async ({ title, content, parentId }) => {
      const supabase = await createClient();
      // Logic to insert into 'concepts' and 'study_content' tables
      // Logic to insert into 'concept_relationships' if parentId is provided
      return { success: true, message: `Note '${title}' created.` };
    },
  }),

  // 3. UPDATE: Edit an existing note
  update_note: tool({
    description: 'Update the content of an existing note.',
    parameters: z.object({
      id: z.string(),
      content: z.string(),
    }),
    execute: async ({ id, content }) => {
      // Update logic
      return { success: true };
    },
  }),
  
  // 4. LINK: Connect two notes
  link_notes: tool({
    description: 'Create a relationship between two existing notes.',
    parameters: z.object({
      sourceId: z.string(),
      targetId: z.string(),
      type: z.enum(['related_to', 'prerequisite', 'next_step']),
    }),
    execute: async ({ sourceId, targetId, type }) => {
      // Insert into 'concept_relationships'
      return { success: true };
    },
  }),
});
```

### Step 2: The Agent Loop (Server Action)

We use `streamText` with `maxSteps`. This allows the AI to call a tool, see the result, and then call *another* tool (or answer the user).

**`src/app/api/chat/route.ts`**

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getTools } from '@/lib/ai/tools';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // 1. System Prompt: Define the Persona and Rules
  const systemPrompt = `
    You are the KnowledgeFlow Graph Gardener.
    Your goal is to help the user build a comprehensive Knowledge Graph.
    
    RULES:
    1. ALWAYS search before creating. Don't create duplicate notes.
    2. Keep notes atomic (focused on one concept).
    3. When explaining a complex topic, break it down into multiple linked notes.
    4. Use the 'create_note' tool to save knowledge.
  `;

  // 2. The Deep Loop
  const result = streamText({
    model: openai('gpt-4o'), // Or 'gpt-5.1' if available
    system: systemPrompt,
    messages,
    tools: getTools(user), // Inject our "Hands"
    maxSteps: 10, // <--- THIS IS THE KEY. It allows up to 10 steps of reasoning/action.
  });

  return result.toDataStreamResponse();
}
```

### Step 3: The "Deep" Workflow Example

**User**: "Create a study plan for Machine Learning."

**Agent Execution Flow (Invisible to User, happens in seconds):**

1.  **Step 1 (Thought)**: "I need to check if we already have a 'Machine Learning' note."
2.  **Step 1 (Action)**: Call `search_notes("Machine Learning")`.
3.  **Step 2 (Observation)**: Result: `[]` (No results).
4.  **Step 2 (Thought)**: "It doesn't exist. I will create the main node, then child nodes for Supervised and Unsupervised Learning."
5.  **Step 2 (Action)**: Call `create_note("Machine Learning", content="...")`.
6.  **Step 3 (Observation)**: Result: `Success, ID: 123`.
7.  **Step 3 (Action)**: Call `create_note("Supervised Learning", parentId="123")`.
8.  **Step 4 (Observation)**: Result: `Success`.
9.  **Step 4 (Action)**: Call `create_note("Unsupervised Learning", parentId="123")`.
10. **Step 5 (Final Response)**: "I've created a study plan for you! I added a main 'Machine Learning' note and linked two sub-topics to get you started."

---

## 4. Advanced: "Generative UI"

To make this feel like a modern 2025 app, we don't just show text. We show **UI components** for the tool calls.

In your frontend `ChatInterface`:

```tsx
<div className="chat-stream">
  {messages.map(m => (
    <div key={m.id}>
      {m.toolInvocations?.map(tool => {
        if (tool.toolName === 'create_note') {
          // Show a "Creating Note..." card that turns into a "Note Created" card
          return <NoteCreationCard key={tool.toolCallId} state={tool.state} args={tool.args} />;
        }
        return null;
      })}
      <Markdown>{m.content}</Markdown>
    </div>
  ))}
</div>
```

## Summary

You don't need a new framework. You need to:
1.  **Expose your Database** as Tools.
2.  **Enable the Loop** (`maxSteps`).
3.  **Visualize the Actions** (Generative UI).

This turns your chatbot into a **Deep Agent** that actually *does work* in your application.
