import { useState, useCallback } from 'react';

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

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const append = useCallback(async (message: { role: string; content: string }, options?: any) => {
    const userMsg: Message = { 
        id: Date.now().toString(), 
        role: message.role as any, 
        content: message.content 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setStatus('submitted');
    setError(null);

    try {
      const body = {
        messages: [...messages, userMsg],
        ...options?.body
      };

      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error(response.statusText);
      if (!response.body) throw new Error('No response body');

      setStatus('streaming');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
      
      setMessages(prev => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Simple parsing for Data Stream Protocol (0:"text")
        let textToAdd = '';
        
        if (chunk.startsWith('0:')) {
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('0:')) {
                    try {
                        // Remove "0:" and parse JSON string
                        // The format is 0:"some text"
                        // JSON.parse('"some text"') -> "some text"
                        const jsonStr = line.slice(2);
                        if (jsonStr.trim()) {
                            const content = JSON.parse(jsonStr);
                            textToAdd += content;
                        }
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                }
            }
        } else {
            // Fallback for raw text or other formats
            textToAdd = chunk;
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
      console.error('Manual Fetch Error:', err);
      setError(err);
      setStatus('error');
      if (onError) onError(err);
    }
  }, [messages, api, onFinish, onError]);

  const handleSubmit = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!input.trim()) return;
    append({ role: 'user', content: input });
    setInput('');
  };

  const reload = () => {
      // Simple reload: remove last assistant message and re-send last user message
      // Not fully implemented for this demo but prevents crash
      console.log('Reload not fully implemented in manual hook');
  };

  const stop = () => {
      // Not implemented
  };

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
    sendMessage: append // Alias for compatibility
  };
}
