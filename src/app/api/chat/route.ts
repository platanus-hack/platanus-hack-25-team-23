
import { createDeepAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SupabaseVFS } from '@/lib/vfs/SupabaseVFS';

export const maxDuration = 60;

export async function POST(req: Request) {
  console.log('API: Chat request received (DeepAgents)');
  try {
    const { messages, model } = await req.json();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('API: Unauthorized');
      return new Response('Unauthorized', { status: 401 });
    }
    // const user = { id: 'debug-user-id' }; // Mock user for debugging

    const vfs = new SupabaseVFS(user.id, supabase);

    // Define Tools
    const listFiles = tool(
      async ({ path = '/', file_path }) => {
        return await vfs.listFiles(path || file_path || '/');
      },
      {
        name: 'list_files',
        description: 'List files and directories in the VFS.',
        schema: z.object({
          path: z.string().optional().describe('The directory path to list (default: /)'),
          file_path: z.string().optional().describe('Alias for path'),
          offset: z.number().optional().describe('Ignored'),
          limit: z.number().optional().describe('Ignored'),
        }),
      }
    );

    const writeFile = tool(
      async ({ path, file_path, content }) => {
        const targetPath = path || file_path;
        if (!targetPath) throw new Error('Path is required');
        await vfs.writeFile(targetPath, content);
        return `File '${targetPath}' written successfully.`;
      },
      {
        name: 'write_file',
        description: 'Create or update a markdown file. You must provide the path and content.',
        schema: z.object({
          path: z.string().optional().describe('The full path to the file (e.g. /notes/React.md)'),
          file_path: z.string().optional().describe('Alias for path'),
          content: z.string().describe('The markdown content'),
        }),
      }
    );

    const readFile = tool(
      async ({ path, file_path }) => {
        const targetPath = path || file_path;
        if (!targetPath) throw new Error('Path is required');
        return await vfs.readFile(targetPath);
      },
      {
        name: 'read_file',
        description: 'Read the content of a markdown file.',
        schema: z.object({
          path: z.string().optional().describe('The full path to the file'),
          file_path: z.string().optional().describe('Alias for path'),
        }),
      }
    );

    // Added create_directory_tool as per instruction's tools array
    const createDirectory = tool(
      async ({ path, file_path }) => {
        const targetPath = path || file_path;
        if (!targetPath) throw new Error('Path is required');
        await vfs.createDirectory(targetPath);
        return `Directory '${targetPath}' created successfully.`;
      },
      {
        name: 'create_directory',
        description: 'Create a new directory.',
        schema: z.object({
          path: z.string().optional().describe('The full path to the new directory'),
          file_path: z.string().optional().describe('Alias for path'),
        }),
      }
    );

    const searchFiles = tool(
      async ({ query }) => {
        const results = await vfs.searchFiles(query);
        return results.length > 0 ? `Found files:\n${results.join('\n')}` : 'No files found.';
      },
      {
        name: 'search_files',
        description: 'Search for files by name or content (like grep/find).',
        schema: z.object({
          query: z.string().describe('The search term'),
        }),
      }
    );

    const moveFile = tool(
      async ({ source_path, destination_path }) => {
        await vfs.moveFile(source_path, destination_path);
        return `Moved '${source_path}' to '${destination_path}' successfully.`;
      },
      {
        name: 'move_file',
        description: 'Move or rename a file or directory.',
        schema: z.object({
          source_path: z.string().describe('The full path of the file/dir to move'),
          destination_path: z.string().describe('The new full path (including name)'),
        }),
      }
    );

    // Fetch existing files for context
    const existingFiles = await vfs.getAllFilePaths();
    const fileListContext = existingFiles.length > 0 
        ? existingFiles.map(f => `- ${f}`).join('\n')
        : '(No files created yet)';

    const SYSTEM_PROMPT = `You are KnowledgeFlow, an AI that generates atomic, interconnected knowledge notes.
    
    ## Core Objective
    You are NOT a chatbot. You are a **Graph Builder**.
    Your goal is to build a Knowledge Graph by creating Markdown files in the Virtual File System (VFS).
    
    ## Current Knowledge Graph (Existing Files)
    The following files already exist. DO NOT create duplicates. Link to them using [[WikiLinks]].
    ${fileListContext}
    
    ## Critical Rules
    1. **Check Before Create**: You already have the list above. If a file exists, DO NOT create it again.
    2. **No Duplicates**: If "Energy.md" exists, do NOT create "Energy (duplicate).md".
    3. **File = Node**: Every file you create becomes a node in the graph.
    4. **Links = Edges**: Use [[WikiLinks]] to connect concepts. These become edges in the graph.
    5. **Language**: Speak in **Spanish** (Español) unless requested otherwise.
    6. **Conciseness**: Be concise. Don't repeat yourself.
    7. **Artifacts**: When you create a file, you MUST display it to the user using this specific syntax in your response:
       :::artifact{path="/notes/Topic.md"}:::
       (Replace /notes/Topic.md with the actual path you wrote to).
 
    ## Content Format Rules (for the file content)
    1. **Structure**: Start with a clear definition, then expand with sections.
    2. **Clickable Terms**: Wrap technical terms in [[double brackets]].
       - Terms should be singular and capitalized: [[Machine Learning]], not [[machine learning]].
       - Only link terms that genuinely need explanation.
    3. **Callouts**: Use these markers for emphasis (start line with "- marker "):
       - "- & " Key insight
       - "- ! " Important point
       - "- !! " Warning or common misconception
       - "- ? " Question to explore further
       - "- Ex: " Brief example
       - "- Obs: " Observation
    4. **Math**: Use LaTeX with single $ for inline, $$ for block.
    5. **Code**: Use fenced code blocks with language identifier.
    6. **Tone**: First person, direct, educational.
    `;

    // Initialize Agent
    const modelInstance = new ChatOpenAI({
      modelName: model || 'gpt-4o',
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });

    const agent = await createDeepAgent({
      model: modelInstance, 
      systemPrompt: SYSTEM_PROMPT,
      tools: [
        listFiles,
        readFile,
        writeFile,
        createDirectory,
        searchFiles,
        moveFile
      ], 
    });

    // Create Stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to safely enqueue data
        const safeEnqueue = (data: Uint8Array) => {
            try {
                controller.enqueue(data);
            } catch (e: any) {
                // Ignore if controller is already closed (client disconnected)
                if (e.message && (e.message.includes('Controller is already closed') || e.code === 'ERR_INVALID_STATE')) {
                    console.log('API: Stream closed by client (safeEnqueue)');
                    return;
                }
                throw e;
            }
        };

        try {
          // STATIC DEBUG STREAM - REMOVED
          // console.log('API: Starting STATIC stream (DATA STREAM PROTOCOL)...');
          
          console.log('API: Starting agent stream (Token Level)...');
          
          // Convert UI messages to Agent messages
          const agentMessages = messages.map((m: any) => ({ 
              role: m.role, 
              content: m.content || (m.parts ? m.parts.map((p:any) => p.text).join('') : '') 
          }));

          // Use streamEvents to get token-level updates
          // Pass req.signal to allow cancellation
          const eventStream = await agent.streamEvents(
            { messages: agentMessages },
            { 
                version: 'v2',
                signal: req.signal 
            }
          );

          let chunkCount = 0;
          for await (const event of eventStream) {
            // Check if client disconnected
            if (req.signal.aborted) {
                console.log('API: Client aborted, stopping stream loop');
                break;
            }

            // console.log('API: Event:', event.event, event.name); // DEBUG ALL EVENTS
            if (event.event === 'on_chat_model_stream') {
                // This is a token chunk from the LLM
                const chunk = event.data.chunk;
                
                // Handle text content
                if (chunk.content) {
                    safeEnqueue(encoder.encode(`0:${JSON.stringify(chunk.content)}\n`));
                    chunkCount++;
                }

                // Handle tool call chunks (streaming arguments)
                if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
                    for (const toolChunk of chunk.tool_call_chunks) {
                        
                        // Crucial: Send if it has args OR name. 
                        // The first chunk usually has name but empty args.
                        if (toolChunk.args || toolChunk.name) {
                            const payload = {
                                name: toolChunk.name,
                                args: toolChunk.args,
                                id: toolChunk.id,
                                index: toolChunk.index
                            };
                            safeEnqueue(encoder.encode(`T:${JSON.stringify(payload)}\n`));
                        }
                    }
                }
            } else if (event.event === 'on_tool_start') {
                console.log('API: Tool Start:', event.name);
                // Notify frontend tool started (optional, but good for UI state)
                safeEnqueue(encoder.encode(`S:${JSON.stringify({ name: event.name })}\n`));
            } else if (event.event === 'on_tool_end') {
                console.log('API: Tool End:', event.name);
                safeEnqueue(encoder.encode(`E:${JSON.stringify({ name: event.name })}\n`));
            }
          }
          console.log(`API: Stream finished. Total token chunks: ${chunkCount}`);
          controller.close();
        } catch (e: any) {
          // Ignore abort errors
          if (e.name === 'AbortError' || req.signal.aborted) {
              console.log('API: Stream aborted by client');
              try { controller.close(); } catch(e) {}
              return;
          }
          console.error('Stream Error:', e);
          controller.error(e);
        }
      }
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1'
      },
    });
  } catch (error: any) {
    console.error('API Fatal Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
  }
}
