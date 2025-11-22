"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"
import { useKnowledge } from "@/lib/store/knowledge-context"
import { useState } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Mermaid } from "@/components/ui/mermaid"

import { AuthForm } from "@/components/features/auth-form"

export function NotePanel() {
  const { currentNote, isLoading, generateNote, markAsUnderstood, session } = useKnowledge()
  const [input, setInput] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      generateNote(input)
    }
  }

  if (!session) {
    return <AuthForm />
  }

  // Transform [[term]] to [term](term) for react-markdown
  const processedContent = currentNote?.content.replace(/\[\[(.*?)\]\]/g, '[$1]($1)')

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    // If it's an internal link (from our transformation)
    if (!href.startsWith('http')) {
      generateNote(href, currentNote?.title)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="What do you want to learn?" 
            className="pl-8" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
        </form>
        
        {/* Breadcrumbs - Simple version */}
        <div className="flex items-center text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
          <span className="cursor-pointer hover:text-foreground" onClick={() => setInput('')}>Home</span>
          {currentNote && (
            <>
              <span className="mx-2">/</span>
              <span className="font-medium text-foreground">{currentNote.title}</span>
            </>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Generating knowledge...</p>
            </div>
          ) : currentNote ? (
            <article className="prose dark:prose-invert max-w-none">
              <h1>{currentNote.title}</h1>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  a: ({ node, href, children, ...props }) => (
                    <a 
                      href={href} 
                      onClick={(e) => handleLinkClick(e, href || '')}
                      className="text-blue-400 hover:text-blue-300 cursor-pointer no-underline font-semibold"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  code: ({ node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '')
                    const isMermaid = match && match[1] === 'mermaid'
                    
                    if (isMermaid) {
                      return <Mermaid chart={String(children).replace(/\n$/, '')} />
                    }
                    
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {processedContent}
              </ReactMarkdown>
              
              <div className="mt-8 pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Status: <span className="capitalize font-medium text-foreground">{currentNote.status}</span>
                </div>
                {currentNote.status !== 'understood' && (
                  <Button 
                    onClick={() => markAsUnderstood(currentNote.id || currentNote.slug)}
                    variant="outline"
                    className="gap-2"
                  >
                    Mark as Understood
                  </Button>
                )}
              </div>
            </article>
          ) : (
            <div className="text-center text-muted-foreground mt-20">
              <h2 className="text-2xl font-semibold mb-2">Welcome to KnowledgeFlow</h2>
              <p>Enter a topic above to start your learning journey.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
