# Technical Debt & Architectural Decisions

This document tracks technical debt incurred from recent architectural choices to prioritize speed and user experience over strict scalability or purity.

## 1. VFS Context Injection (The "Smart" Fix)
**Decision:** We inject the **entire list of existing file paths** directly into the AI's System Prompt at the start of every request.
**Reason:** To give the AI immediate "awareness" of the graph state, preventing duplicates and enabling spontaneous linking without the latency of `list_files` tool calls.
**Debt (Scalability):**
- **Context Window:** As the number of notes grows (e.g., >1,000), the list of paths will consume a significant portion of the LLM's context window.
- **Cost:** We pay for these tokens on every single request.
**Future Solution:** Implement RAG (Retrieval-Augmented Generation) or a vector store to retrieve only *relevant* file paths, or revert to strict agentic tool usage (`list_files`) when the graph becomes too large.

## 2. Permissive Tool Schemas (The "Hallucination" Fix)
**Decision:** We added `offset`, `limit`, and `file_path` fields to the Zod schemas for VFS tools (`list_files`, etc.), marked as "Ignored".
**Reason:** The AI model (GPT-4o) frequently hallucinates these standard filesystem parameters. Strict validation was causing crashes.
**Debt (API Purity):**
- The API definition is now "lying" about its capabilities (it claims to accept pagination but ignores it).
- `SupabaseVFS` does not actually support pagination, so `list_files` always returns everything.
**Future Solution:** Implement actual SQL-based pagination (`LIMIT`/`OFFSET`) in `SupabaseVFS` and wire it up to the tool arguments.

## 3. Virtual File System (VFS) vs. Real FS
**Decision:** We use a Postgres-backed VFS (`vfs_nodes` table) instead of a real local filesystem.
**Reason:** To ensure compatibility with serverless web deployments (Vercel/Netlify) where local files are ephemeral.
**Debt (Complexity):**
- We are re-implementing filesystem logic (paths, folders, recursion) in SQL/TypeScript.
- Performance for deep directory traversals is suboptimal compared to a native FS.
**Future Solution:** None required if this remains a web app. If porting to a Desktop App (Electron/Tauri), we should abstract the VFS layer to use the native OS filesystem.

## 4. Unicode Sanitization
**Decision:** We explicitly strip `\u0000` (null bytes) from content in `SupabaseVFS.writeFile`.
**Reason:** Postgres `text` fields cannot store null bytes, and the LLM occasionally outputs them, causing save failures.
**Debt (Data Integrity):**
- We are silently altering data. While null bytes are usually garbage in Markdown, this is a "magic fix".
**Future Solution:** Investigate why the model outputs null bytes or handle binary data properly if we ever support non-text files.

## 5. Persistent `ls` Inconsistency
**Decision:** We refactored `listFiles` to use `getAllFilePaths` (in-memory filtering) to match the AI's context injection.
**Reason:** The AI was seeing files in its system prompt but `ls` was returning empty results, likely due to "ghost" directory nodes or VFS sync issues.
**Debt (Reliability):**
- Despite the fix, the user reported `ls` still failing in some environments.
- We are relying on a "double source of truth" (DB query vs. recursive reconstruction).
**Future Solution:** Rebuild the VFS table structure to be a proper adjacency list with enforced foreign keys for folders, ensuring `ls` always works natively via SQL.

## 6. Build Dependencies (Shiki)
**Decision:** We manually installed `shiki` to resolve a "Package shiki can't be external" build error in Next.js 16 (Turbopack).
**Reason:** The `streamdown` or `NoteRenderer` components rely on it, and the build system wasn't resolving it correctly.
**Debt (Maintenance):**
- We might have an unnecessary direct dependency in `package.json`.
**Future Solution:** Audit dependencies and remove `shiki` if it can be properly resolved by the transitive dependency.
