# System Analysis: DeepAgents + Vercel AI SDK Integration

## Current Architecture
We have successfully "glued" two powerful but distinct systems together:
1.  **Backend:** `deepagents` (based on LangGraph) for the agentic logic (reasoning, tools, VFS).
2.  **Frontend:** Vercel AI SDK (`useChat`) for the UI and streaming.

## The "Glue" Problem
The core issue is the **Stream Mismatch**.
*   **DeepAgents** outputs a complex stream of LangGraph state updates (events like `on_chain_start`, `on_tool_start`, `model_request`, etc.).
*   **Vercel AI SDK** expects a specific "Data Stream Protocol" (chunks like `0:"text"`, `b:{"tool":"call"}`).

Currently, we are **manually adapting** this in `route.ts`:
```typescript
// Our manual adapter
if (msg.kwargs.content) {
  controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
}
```

## Brutal Honesty: Is this robust?
**No.** It is a "fragile" integration because:
1.  **Internal API Dependence:** We are relying on the internal structure of `deepagents` chunks (`chunk.model_request.messages[0].kwargs.content`). If `deepagents` changes its event structure (which it might, as it's a wrapper), our stream breaks.
2.  **Missing Features:** We are currently only streaming *text*. We are ignoring:
    *   **Tool Calls:** The frontend doesn't know a tool is running until it finishes (or maybe not at all).
    *   **Reasoning Steps:** We aren't streaming the "thought process" properly, just the final text.
    *   **Error Handling:** If the agent errors mid-stream, we catch it but the frontend might just hang.

## Did we need a refactor?
**Yes.** To use `deepagents` (which you requested), we *had* to move away from the standard Vercel `streamText` function because `streamText` controls the agent loop itself. Since `deepagents` wants to control the loop (using LangGraph), we had to switch to a custom route handler.

## Recommendations
1.  **Short Term (Fix Visibility):** Debug the exact chunk format. The frontend is likely rejecting our manual chunks because of a subtle formatting issue (e.g., double JSON encoding or missing IDs).
2.  **Medium Term (Robustness):** Use `LangChainAdapter` from Vercel AI SDK.
    *   Instead of manual `controller.enqueue`, we should try to convert the `deepagents` stream into a standard LangChain stream that `LangChainAdapter` can handle.
    *   *Challenge:* `deepagents` might not expose a standard `Runnable` stream that matches what `LangChainAdapter` expects.
3.  **Long Term (Architecture):**
    *   **Option A (DeepAgents Native):** If `deepagents` releases a Vercel SDK adapter, use it.
    *   **Option B (Pure LangGraph):** If `deepagents` proves too opaque, we might need to "eject" to raw LangGraph to have full control over the stream events, allowing us to map them 1:1 to Vercel SDK protocols.

## Immediate Action Plan
1.  **Verify Frontend:** Force a static stream response to prove the UI works.
2.  **Fix Stream Format:** Ensure we aren't double-encoding JSON strings.
