
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
      async ({ path = '/' }) => {
        return await vfs.listFiles(path);
      },
      {
        name: 'list_files',
        description: 'List files and directories in the VFS.',
        schema: z.object({
          path: z.string().optional().describe('The directory path to list (default: /)'),
        }),
      }
    );

    const writeFile = tool(
      async ({ path, content }) => {
        await vfs.writeFile(path, content);
        return `File '${path}' written successfully.`;
      },
      {
        name: 'write_file',
        description: 'Create or update a markdown file.',
        schema: z.object({
          path: z.string().describe('The full path to the file'),
          content: z.string().describe('The markdown content'),
        }),
      }
    );

    const readFile = tool(
      async ({ path }) => {
        return await vfs.readFile(path);
      },
      {
        name: 'read_file',
        description: 'Read the content of a markdown file.',
        schema: z.object({
          path: z.string().describe('The full path to the file'),
        }),
      }
    );

    // Added create_directory_tool as per instruction's tools array
    const createDirectory = tool(
      async ({ path }) => {
        await vfs.createDirectory(path);
        return `Directory '${path}' created successfully.`;
      },
      {
        name: 'create_directory',
        description: 'Create a new directory.',
        schema: z.object({
          path: z.string().describe('The full path to the new directory'),
        }),
      }
    );

    const SYSTEM_PROMPT = `You are a Knowledge Graph assistant. 
      Use the VFS tools to manage notes. 
      ALWAYS use [[WikiLinks]] for concepts.`;

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
        createDirectory
      ], 
    });

    // Create Stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
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
          const eventStream = await agent.streamEvents(
            { messages: agentMessages },
            { version: 'v2' }
          );

          let chunkCount = 0;
          for await (const event of eventStream) {
            if (event.event === 'on_chat_model_stream') {
                // This is a token chunk from the LLM
                const token = event.data.chunk.content;
                if (token) {
                    // console.log('API: Token:', token); // Too noisy for production logs
                    controller.enqueue(encoder.encode(`0:${JSON.stringify(token)}\n`));
                    chunkCount++;
                }
            } else if (event.event === 'on_tool_start') {
                console.log('API: Tool Start:', event.name);
                // Optional: Send tool status to UI if needed
            } else if (event.event === 'on_tool_end') {
                console.log('API: Tool End:', event.name);
            }
          }
          console.log(`API: Stream finished. Total token chunks: ${chunkCount}`);
          controller.close();
        } catch (e) {
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
