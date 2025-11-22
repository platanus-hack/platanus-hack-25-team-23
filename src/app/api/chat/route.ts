
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
          
          console.log('API: Starting agent stream...');
          
          // Convert UI messages to Agent messages if needed
          // DeepAgents expects { role, content }
          const agentMessages = messages.map((m: any) => ({ 
              role: m.role, 
              content: m.content || (m.parts ? m.parts.map((p:any) => p.text).join('') : '') 
          }));
          console.log('API: Agent messages prepared:', agentMessages.length);

          const agentStream = await agent.stream({
            messages: agentMessages,
          });

          let chunkCount = 0;
          for await (const chunk of agentStream) {
            chunkCount++;
            console.log(`API: Chunk ${chunkCount} keys:`, Object.keys(chunk));
            
            const modelChunk = chunk.model_request || chunk.agent;
            if (modelChunk) {
                console.log('API: Model chunk found. Messages:', modelChunk.messages?.length);
            }

            if (modelChunk && modelChunk.messages && modelChunk.messages.length > 0) {
              const msg = modelChunk.messages[0];
              const content = msg.kwargs?.content || msg.content; 
              console.log('API: Message content type:', typeof content);
              
              if (content && typeof content === 'string') {
                console.log('API: Enqueuing content:', content.slice(0, 50) + '...');
                controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
              }
            }
          }
          console.log(`API: Stream finished. Total chunks: ${chunkCount}`);
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
