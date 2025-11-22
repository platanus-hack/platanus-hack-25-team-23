import { useState, useCallback, useRef } from 'react';

export type Message = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  content: string;
  parts?: any[];
};

export function useManualChat({ api = '/api/chat', onFinish, onError }: any = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'ready' | 'streaming' | 'submitted' | 'error'>('ready');
  const [error, setError] = useState<any>(null);
  
  // Ref to hold the AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const append = useCallback(async (message: { role: string; content: string; files?: any[] }, options?: any) => {
    
    let attachments: any[] = [];
    if (message.files && message.files.length > 0) {
      // Files are already converted to base64 by PromptInput (FileUIPart[])
      attachments = message.files.map(file => ({
        name: file.filename || file.name,
        contentType: file.mediaType || file.type,
        url: file.url // Already a data URL
      }));
    }

    const userMsg: Message = { 
        id: Date.now().toString(), 
        role: message.role as any, 
        content: message.content,
        parts: attachments.length > 0 ? [
            { type: 'text', text: message.content },
            ...attachments.map(a => ({ 
                type: a.contentType?.startsWith('image/') ? 'image' : 'file', 
                data: a.url, 
                mimeType: a.contentType,
                name: a.name
            }))
        ] : undefined
    };
    
    setMessages(prev => [...prev, userMsg]);
    setStatus('submitted');
    setError(null);

    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const body = {
        messages: [...messages, userMsg],
        ...options?.body
      };

      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include', // Ensure cookies are sent!
        signal: controller.signal // Link the signal
      });

      if (!response.ok) throw new Error(response.statusText);
      if (!response.body) throw new Error('No response body');

      setStatus('streaming');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
      
      setMessages(prev => [...prev, assistantMsg]);

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        // Keep the last line in the buffer as it might be incomplete
        buffer = lines.pop() || '';

        let textToAdd = '';

        for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith('0:')) {
                try {
                    const jsonStr = line.slice(2);
                    if (jsonStr.trim()) {
                        const content = JSON.parse(jsonStr);
                        textToAdd += content;
                    }
                } catch (e) {
                    console.error('Parse error 0:', e);
                }
            } else if (line.startsWith('T:')) {
                // Tool Delta
                try {
                    const payload = JSON.parse(line.slice(2));
                    setCurrentTool(prev => {
                        if (!prev) return { name: payload.name || 'unknown', args: payload.args || '' };
                        return { ...prev, args: prev.args + (payload.args || '') };
                    });
                } catch (e) { console.error('Tool parse error T:', e); }
            } else if (line.startsWith('S:')) {
                // Tool Start
                try {
                    const payload = JSON.parse(line.slice(2));
                    // Only set if we don't have a tool yet, or if it's a different tool.
                    // Crucial: Do NOT reset args if we are already streaming this tool!
                    setCurrentTool(prev => {
                        // If we have a tool but name is unknown, update the name but KEEP args!
                        if (prev && prev.name === 'unknown') {
                             return { ...prev, name: payload.name };
                        }
                        // If we already have this tool, do nothing
                        if (prev && prev.name === payload.name) {
                            return prev;
                        }
                        // New tool? Reset.
                        return { name: payload.name, args: '' };
                    });
                } catch (e) {}
            } else if (line.startsWith('E:')) {
                // Tool End
                setCurrentTool(null);
            } else {
                // Unknown format or raw text?
                // If we are strict, we ignore. 
                // If we are loose, we append. 
                // Given the issue "veo los chunks en raw", we should be strict and NOT append unless we are sure.
                // But standard Vercel AI SDK might send raw text? No, it uses 0: protocol.
                // So ignoring is safer to prevent leaks.
                // console.log('Ignored line:', line);
            }
        }

        if (textToAdd) {
            assistantMsg = { ...assistantMsg, content: assistantMsg.content + textToAdd };
            
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { ...assistantMsg };
                return newMsgs;
            });
        }
      }
      
      setStatus('ready');
      if (onFinish) onFinish(assistantMsg);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
          console.log('Chat aborted by user');
          setStatus('ready');
          return;
      }
      console.error('Manual Fetch Error:', err);
      setError(err);
      setStatus('error');
      if (onError) onError(err);
    } finally {
        abortControllerRef.current = null;
    }
  }, [messages, api, onFinish, onError]);

  const [currentTool, setCurrentTool] = useState<{ name: string; args: string } | null>(null);

  const handleSubmit = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!input.trim()) return;
    append({ role: 'user', content: input });
    setInput('');
  };

  const reload = () => {
      console.log('Reload not fully implemented in manual hook');
  };

  const stop = useCallback(() => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setStatus('ready');
      }
  }, []);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    error,
    reload,
    stop,
    sendMessage: append,
    currentTool // Expose this!
  };
}
