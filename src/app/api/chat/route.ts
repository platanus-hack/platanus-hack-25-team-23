
import { createDeepAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SupabaseVFS } from '@/lib/vfs/SupabaseVFS';
// @ts-ignore
import PDFParser from 'pdf2json';

export const maxDuration = 60;

export async function POST(req: Request) {
  console.log('API: Chat request received (DeepAgents)');
  try {
    const { messages, model, webSearch } = await req.json();
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

    const readPdf = tool(
      async ({ url }) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const pdfParser = new PDFParser(null, true);
          const text = await new Promise<string>((resolve, reject) => {
              pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
              pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                  resolve(pdfParser.getRawTextContent());
              });
              pdfParser.parseBuffer(buffer);
          });
          return text;
        } catch (error: any) {
          return `Error reading PDF: ${error.message}`;
        }
      },
      {
        name: 'read_pdf',
        description: 'Read and extract text from a PDF file via URL.',
        schema: z.object({
          url: z.string().describe('The URL of the PDF file to read'),
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
    \${fileListContext}
    
    ## Critical Rules
    1. **Check Before Create**: You already have the list above. If a file exists, DO NOT create it again.
    2. **No Duplicates**: If "Energy.md" exists, do NOT create "Energy (duplicate).md".
    3. **File = Node**: Every file you create becomes a node in the graph.
    4. **Links = Edges**: Use [[WikiLinks]] to connect concepts. These become edges in the graph.
    5. **File References**: When mentioning an existing file, ALWAYS use Markdown link syntax: \`[filename](/path/to/file.md)\`. This makes it clickable.
    6. **Language**: Speak in **Spanish** (Español) unless requested otherwise.
    7. **Conciseness**: Be concise. Don't repeat yourself.
    8. **Artifacts**: When you create a file, you MUST display it to the user using this specific syntax in your response:
       :::artifact{path="/notes/Topic.md"}:::
       (Replace /notes/Topic.md with the actual path you wrote to).

    ## Content Format Rules (CS BrainFlow Standard)
    
    ### 1. Atomic Note-Taking
    - Break down complex topics into smaller, focused notes.
    - Each note should contain one main idea or concept.
    - Avoid orphaned files/notes.
    
    ### 2. Bidirectional Links
    - Format: \`[[Full Topic Name|Alias]]\` or \`[[Full Topic Name]]\`.
    - **Singular & Capitalized**: Always use singular form and capitalize terms (unless it's a common verb).
      - Correct: \`[[Neural Network]]s\` (renders as Neural Networks), \`[[Object-oriented programming|OOP]]\`
      - Incorrect: \`[[AIs]]\`, \`[[artificial intelligence]]\`
    - **No Self-Referencing**: Do not link to the note itself.
    - **Aliases**: Use aliases for abbreviations or flow (e.g., \`[[Artificial Intelligence|AI]]\`).
    
    ### 3. Callouts (Bullet List Style)
    Use these specific markers at the start of a bullet point line for emphasis:
    - \`- & \` **Key Idea**: The main takeaway. Use sparingly.
    - \`- ? \` **Question**: Uncertainty or topic to investigate.
    - \`- ! \` **Important**: Main idea of a paragraph.
    - \`- !! \` **Warning**: Caution or common pitfall.
    - \`- - \` **Related**: Link to a related topic (e.g., \`- - See [[Related Note]]\`).
    - \`- Obs: \` **Observation**: Crucial observation.
    - \`- Ex: \` **Example**: Brief 1-line example.
    - \`- > \` **Expansion**: Idea developed further in another note.
    - \`- < \` **Code/Tip**: Single-line code example or tip.

    ### 4. Maps of Content (MOC)
    - If a topic has many subtopics (>5), create a MOC.
    - Start with a header \`## Map of Content #MOC\`.
    - List links to sub-notes.

    ### 5. Math & Code
    - Math: LaTeX with single $ for inline, $$ for block.
    - Code: Fenced code blocks with language identifier.
    `;

    // Initialize Agent
    let modelName = model || 'gpt-4o';
    let apiKey = process.env.OPENAI_API_KEY;
    let configuration = undefined;

    if (webSearch) {
        console.log('API: Web Search enabled, switching to Perplexity');
        modelName = 'sonar'; // Perplexity model
        apiKey = process.env.PERPLEXITY_API_KEY;
        configuration = { baseURL: 'https://api.perplexity.ai' };
    }

    const modelInstance = new ChatOpenAI({
      modelName: modelName,
      openAIApiKey: apiKey,
      configuration: configuration,
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
        searchFiles,
        moveFile,
        readPdf
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
          const agentMessages = await Promise.all(messages.map(async (m: any) => {
              if (m.parts && m.parts.length > 0) {
                  const contentParts = [];
                  for (const part of m.parts) {
                      if (part.type === 'text') {
                          contentParts.push({ type: 'text', text: part.text });
                      } else if (part.type === 'image') {
                          // Handle base64 image
                          contentParts.push({ 
                              type: 'image_url', 
                              image_url: { url: part.data } 
                          });
                      } else if (part.type === 'file' && (part.mimeType === 'application/pdf' || part.mimeType?.includes('pdf'))) {
                          // Parse PDF on the fly
                          console.log(`API: Processing PDF attachment: ${part.name} (${part.mimeType})`);
                          try {
                              // part.data is base64 data URL: data:application/pdf;base64,...
                              const base64Data = part.data.split(',')[1];
                              if (!base64Data) throw new Error('Invalid base64 data');
                              
                              const buffer = Buffer.from(base64Data, 'base64');
                              
                              // Use pdf2json for robust Node.js parsing
                              const pdfParser = new PDFParser(null, true); // true = text only
                              
                              const text = await new Promise<string>((resolve, reject) => {
                                  pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
                                  pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                                      resolve(pdfParser.getRawTextContent());
                                  });
                                  pdfParser.parseBuffer(buffer);
                              });

                              console.log(`API: PDF parsed successfully. Length: ${text.length}`);
                              
                              contentParts.push({ 
                                  type: 'text', 
                                  text: `\n\n[Attached PDF Content: ${part.name}]\n${text}\n[End PDF Content]\n` 
                              });
                          } catch (e: any) {
                              console.error('Error parsing attached PDF:', e);
                              contentParts.push({ type: 'text', text: `[Error reading attached PDF ${part.name}: ${e.message}]` });
                          }
                      }
                  }
                  return { role: m.role, content: contentParts };
              }
              
              return { 
                  role: m.role, 
                  content: m.content || '' 
              };
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
