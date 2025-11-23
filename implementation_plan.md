# DeepAgents Migration Plan

## Goal
Migrate the chat backend from Vercel AI SDK (`streamText`) to `deepagents` SDK as requested by the user.

## 1. Dependencies
-   [x] Install `deepagents`
-   [x] Install `@langchain/core`, `@langchain/openai`

## 2. Architecture Changes
-   **Tools**: Convert `SupabaseVFS` methods into LangChain-compatible tools using `tool` from `@langchain/core/tools`.
-   **Agent**: Use `createDeepAgent` to initialize the agent with these tools.
-   **Streaming**: The `deepagents` SDK likely returns a LangChain runnable. We need to stream its output back to the client in a format `useChat` understands (or adapt the client).
    -   *Risk*: `deepagents` might output a different stream format.
    -   *Mitigation*: Use `LangChainAdapter` from `ai` SDK if needed, or manually format the stream.

## 3. Implementation Steps
1.  **Define Tools**: Create `list_files`, `read_file`, `write_file` using LangChain's `tool` helper.
2.  **Initialize Agent**: `const agent = createDeepAgent({ tools, systemPrompt })`.
3.  **Handle Request**: In `POST`, invoke the agent.
4.  **Stream Response**: Convert agent output to a stream.

## 4. Code Structure (Draft)
```typescript
import { createDeepAgent } from 'deepagents';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define tools...

export async function POST(req: Request) {
  const { messages } = await req.json();
  const agent = createDeepAgent({ ... });
  
  const result = await agent.stream({
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  });
  
  // Return stream...
}
```
