// @ts-nocheck
'use client';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageAttachments,
  MessageAttachment,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Fragment, useState, useEffect } from 'react';
import { useManualChat } from '@/hooks/use-manual-chat';
import { CopyIcon, GlobeIcon, RefreshCcwIcon, SquareIcon } from 'lucide-react';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { Loader } from '@/components/ai-elements/loader';
import { ChatWelcomeScreen } from './ChatWelcomeScreen';
import { NoteRenderer } from '@/components/NoteRenderer';
import { FileArtifact } from '../FileArtifact';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { extractAttributeFromPartialJson } from '@/lib/partial-json';

const models = [
  {
    name: 'GPT 5.1',
    value: 'gpt-5.1-2025-11-13',
  },
  {
    name: 'GPT 4o',
    value: 'openai/gpt-4o',
  },
];

export function ChatView() {
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'expert'>('beginner');
  
  // Use context to get recent notes for the welcome screen
  const { notes } = useKnowledge();
  const recentTopics = Array.from(new Set(notes
    .slice(-5) // Take a few more to ensure we have enough after dedup
    .reverse()
    .map(note => note.title)
    .filter(title => title && title.length > 0)))
    .slice(0, 3); // Take top 3 unique

  const { 
    messages, 
    input: chatInput, // Renamed to avoid conflict with local state 'input'
    handleInputChange, 
    handleSubmit: handleManualSubmit, 
    status, 
    stop,
    append,
    currentTool
  } = useManualChat({
    api: '/api/chat',
    onFinish: (message: any) => console.log('Chat finished:', message),
    onError: (error: any) => {
        console.error('Chat error:', error);
        alert(`Chat Error: ${error.message}`);
    }
  });
  
  const [showWelcome, setShowWelcome] = useState(true);

  // Hide welcome screen when messages exist
  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages]);

  // Open sidebar when streaming starts (specifically when write_file tool is detected)
  useEffect(() => {
    if (currentTool?.name === 'write_file') {
        // Dispatch event to open sidebar
        window.dispatchEvent(new CustomEvent('open-sidebar'));
    }
  }, [currentTool]);

  // Helper to get pending artifact path
  const getPendingArtifactPath = () => {
      if (currentTool?.name === 'write_file' && currentTool.args) {
          // Try to extract path or file_path
          const path = extractAttributeFromPartialJson(currentTool.args, 'path');
          const filePath = extractAttributeFromPartialJson(currentTool.args, 'file_path');
          return path || filePath;
      }
      return null;
  };

  const pendingArtifactPath = getPendingArtifactPath(); 
  
  // DEBUG: Trace pending artifact logic
  useEffect(() => {
      if (status === 'streaming') {
          console.log('DEBUG: ChatView Stream State:', { 
              status, 
              toolName: currentTool?.name, 
              toolArgs: currentTool?.args,
              pendingPath: pendingArtifactPath
          });
      }
  }, [status, currentTool, pendingArtifactPath]); 
  
  const [activeNote, setActiveNote] = useState<{ title: string; content: string } | null>(null);

  // Effect to handle streaming tool updates
  useEffect(() => {
    if (currentTool && currentTool.name === 'write_file') {
        let content = '';
        let title = 'Generating...';
        
        // Use robust partial parser
        const extractedContent = extractAttributeFromPartialJson(currentTool.args, 'content');
        const extractedPath = extractAttributeFromPartialJson(currentTool.args, 'path') || extractAttributeFromPartialJson(currentTool.args, 'file_path');
        
        if (extractedContent) {
            content = extractedContent;
        } else {
            // Fallback: If extraction fails, show raw args wrapped in code block so we see what's happening
            // This is better than blank screen.
            content = "```json\n" + currentTool.args + "\n```";
        }

        if (extractedPath) {
            title = extractedPath.split('/').pop() || 'New Note';
        }

        setActiveNote({
            title: title,
            content: content
        });
    }
  }, [currentTool]);

  // Helper to handle link/artifact clicks
  const handleLinkClick = (term: string) => {
    console.log('Link clicked:', term);

    // 0. Check if we are currently streaming this note!
    // This prevents "Loading..." from overwriting the live stream if user clicks the card.
    if (currentTool && currentTool.name === 'write_file') {
        const streamingPath = extractAttributeFromPartialJson(currentTool.args, 'path') || extractAttributeFromPartialJson(currentTool.args, 'file_path');
        const streamingTitle = streamingPath ? streamingPath.split('/').pop() : '';
        
        // Fuzzy match: if term is contained in streaming path/title or vice versa
        if (streamingPath && (streamingPath.includes(term) || term.includes(streamingTitle || '____'))) {
             console.log('Link click matches streaming note, ignoring DB fetch');
             // We don't need to do anything because the useEffect is already updating activeNote!
             // Just ensure panel is open (it should be).
             return;
        }
    }

    // 1. Normalize term (handle file paths like /notes/Foo.md)
    // Decode URI component to handle %20 spaces
    const decodedTerm = decodeURIComponent(term);
    let searchTitle = decodedTerm;
    
    if (decodedTerm.includes('/') || decodedTerm.endsWith('.md')) {
        searchTitle = decodedTerm.split('/').pop()?.replace('.md', '') || decodedTerm;
    }
    
    // 2. Try to find in loaded notes using fuzzy matching on title/slug
    const note = notes.find(n => 
        n.title === searchTitle || 
        n.slug === searchTitle || 
        n.title.toLowerCase() === searchTitle.toLowerCase() ||
        n.title === term // Fallback to original term just in case
    );
    
    if (note) {
      setActiveNote({ title: note.title, content: note.content });
    } else {
      // Distinguish between Artifact Path (file) and WikiLink (concept)
      const isPath = term.includes('/') || term.endsWith('.md');

      if (isPath) {
          // It's an Artifact Path that wasn't found.
          // Likely a sync issue or just created. Show placeholder.
          console.log('Artifact not found locally:', term);
          const displayTitle = term.split('/').pop()?.replace('.md', '') || term;
          
          setActiveNote({ 
              title: displayTitle, 
              content: `# ${displayTitle}\n\nThis note does not exist yet.\n\n[Generate this note](action:generate:${term})` 
          });
      } else {
          // It's a WikiLink Concept that wasn't found.
          // User wants to explore this concept -> Auto-generate!
          console.log('Ghost Node clicked, triggering generation for:', term);
          handleSubmit(term);
      }
    }
  };

  const handleSubmit = (message: PromptInputMessage | string) => {
    const text = typeof message === 'string' ? message : message.text;
    const files = typeof message === 'string' ? undefined : message.files;

    console.log('ChatView: handleSubmit triggered', text);
    const hasText = Boolean(text);
    const hasAttachments = Boolean(files?.length);

    if (!(hasText || hasAttachments)) {
      console.warn('ChatView: Empty submission');
      return;
    }

    append(
      { 
        role: 'user',
        content: text || 'Sent with attachments',
        files: files
      },
      {
        body: {
          model: model,
          webSearch: webSearch,
          level: level, // Pass level to backend (needs backend support to use it)
        },
      },
    );
    setInput('');
  };

  // If no messages, show the Welcome Screen
  if (messages.length === 0) {
    return (
      <ChatWelcomeScreen 
        onQuery={handleSubmit}
        level={level}
        setLevel={setLevel}
        recentTopics={recentTopics}
        isLoading={status === 'submitted' || status === 'streaming'}
      />
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 relative size-full h-full flex gap-6 bg-[#F6F5F2]">
      {/* Left Panel: Chat (Flexible width) */}
      <div className={`flex flex-col h-full transition-all duration-300 ${activeNote ? 'w-1/2' : 'w-full max-w-4xl mx-auto'}`}>
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'assistant' && message.parts?.filter((part) => part.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter(
                          (part) => part.type === 'source-url',
                        ).length
                      }
                    />
                    {message.parts.filter((part) => part.type === 'source-url').map((part, i) => (
                      <SourcesContent key={`${message.id}-${i}`}>
                        <Source
                          key={`${message.id}-${i}`}
                          href={part.url}
                          title={part.url}
                        />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                
                {/* Handle standard content if parts are missing or empty (backward compatibility) */}
                {(!message.parts || message.parts.length === 0) && message.content && (
                    <Message from={message.role}>
                        <MessageContent className={message.role === 'user' ? "bg-white text-[#222222] border border-[#EEEBE6] shadow-sm" : "text-[#222222]"}>
                            {message.role === 'user' ? (
                                <div className="whitespace-pre-wrap">
                                    {message.content}
                                    {message.parts && message.parts.length > 0 && (
                                        <MessageAttachments className="mt-2">
                                            {message.parts.filter(p => p.type === 'image' || p.type === 'file').map((part, idx) => (
                                                <MessageAttachment 
                                                    key={idx} 
                                                    data={{
                                                        type: part.type,
                                                        url: part.data,
                                                        mediaType: part.mimeType,
                                                        filename: part.name
                                                    }} 
                                                />
                                            ))}
                                        </MessageAttachments>
                                    )}
                                </div>
                            ) : message.role === 'assistant' ? (
                        <>
                            <NoteRenderer 
                                content={message.content} 
                                onLinkClick={handleLinkClick}
                                isStreaming={status === 'streaming' && message.id === messages[messages.length - 1].id}
                                existingNotes={notes}
                            />
                            {/* Show pending artifact if this is the last message and we are writing a file */}
                            {(() => {
                                const isStreaming = status === 'streaming';
                                const isLast = message.id === messages[messages.length - 1].id;
                                const hasPath = !!pendingArtifactPath;
                                
                                if (isStreaming && isLast && hasPath) {
                                    return (
                                        <div className="mt-2">
                                            <FileArtifact path={pendingArtifactPath!} isLoading={true} />
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </>
                    ) : (
                        message.content
                    )}
                        </MessageContent>
                    </Message>
                )}

                {message.parts?.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent className={message.role === 'user' ? "bg-white text-[#222222] border border-[#EEEBE6] shadow-sm" : "text-[#222222]"}>
                            {message.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{part.text}</div>
                            ) : (
                                <NoteRenderer 
                                    content={part.text} 
                                    isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                                    onLinkClick={handleLinkClick}
                                    existingNotes={notes}
                                />
                            )}
                          </MessageContent>
                          {message.role === 'assistant' && i === messages.length - 1 && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => reload()}
                                label="Retry"
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case 'reasoning':
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder="Ask your Knowledge Graph..."
              className="text-[#222222] placeholder:text-[#9A9A9A]"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                variant={webSearch ? 'default' : 'ghost'}
                onClick={() => setWebSearch(!webSearch)}
                className={webSearch ? "bg-[#E6DAFF] text-[#9575CD] hover:bg-[#D6C9F5]" : "text-[#6D6D6D] hover:bg-[#F6F5F2]"}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger className="text-[#6D6D6D] hover:bg-[#F6F5F2]">
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((model) => (
                    <PromptInputSelectItem key={model.value} value={model.value}>
                      {model.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit 
                disabled={!input && status === 'ready'} 
                status={status} 
                onClick={() => {
                    if (status === 'streaming' || status === 'submitted') {
                        stop();
                    }
                }}
                className="bg-[#222222] text-white hover:bg-black"
            >
                {status === 'submitted' || status === 'streaming' ? (
                    <SquareIcon className="size-4" />
                ) : undefined}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>

      {/* Right Panel: Note Viewer */}
      {activeNote && (
        <div className="w-1/2 h-full bg-white border border-[#EEEBE6] rounded-3xl shadow-[0px_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col animate-in slide-in-from-right-10 duration-300">
          <div className="p-4 border-b border-[#EEEBE6] flex items-center justify-between bg-[#F6F5F2]">
            <h2 className="font-bold text-lg truncate text-[#222222]">{activeNote.title}</h2>
            <button 
              onClick={() => setActiveNote(null)}
              className="p-2 hover:bg-[#EEEBE6] rounded-xl transition-colors text-[#6D6D6D]"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
             <NoteRenderer content={activeNote.content} onLinkClick={handleLinkClick} existingNotes={notes} />
          </div>
        </div>
      )}
    </div>
  );
}
