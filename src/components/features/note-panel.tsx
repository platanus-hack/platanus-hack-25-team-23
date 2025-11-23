"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, CheckCircle } from "lucide-react"
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

  // Process content: Handle links and callouts
  const processedContent = currentNote?.content
    // Fix links: [[term]] -> [term](term) with URL encoding
    .replace(/\[\[(.*?)\]\]/g, (match, p1) => `[${p1}](${encodeURIComponent(p1)})`)
    // Callouts
    .replace(/^- & (.*)/gm, '> **Insight clave**: $1')
    .replace(/^- ! (.*)/gm, '> **Importante**: $1')
    .replace(/^- !! (.*)/gm, '> **Advertencia**: $1')
    .replace(/^- \? (.*)/gm, '> **Explorar**: $1')
    .replace(/^- Ex: (.*)/gm, '> **Ejemplo**: $1')
    .replace(/^- Obs: (.*)/gm, '> **Observacion**: $1') || ''

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    // If it's an internal link (from our transformation)
    if (!href.startsWith('http')) {
      generateNote(decodeURIComponent(href), currentNote?.title)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search Header */}
      <div className="p-5 space-y-4 bg-card border-b border-border">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <input
            placeholder="Que quieres aprender?"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all focus:outline-none focus:ring-2 bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/20"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
        </form>

        {/* Breadcrumbs */}
        <div className="flex items-center text-sm overflow-x-auto whitespace-nowrap text-muted-foreground">
          <span
            className="cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setInput('')}
          >
            Inicio
          </span>
          {currentNote && (
            <>
              <span className="mx-2">/</span>
              <span className="font-medium text-foreground">{currentNote.title}</span>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-primary/10">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
              <p className="text-muted-foreground">Generando conocimiento...</p>
            </div>
          ) : currentNote ? (
            <article>
              <h1 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                {currentNote.title}
              </h1>
              <div className="rounded-3xl p-4 md:p-6 mb-6 bg-card border border-border shadow-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1 className="text-2xl md:text-3xl font-bold mt-8 mb-4 first:mt-0 text-foreground" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xl md:text-2xl font-semibold mt-6 mb-3 text-foreground" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-lg md:text-xl font-semibold mt-4 mb-2 text-foreground" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="leading-7 mb-4 text-sm md:text-base text-foreground" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="mb-1 text-sm md:text-base text-foreground" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-bold text-foreground" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="pl-4 my-4 italic rounded-r-xl py-3 pr-4 text-sm md:text-base border-l-4 border-primary/20 bg-muted/50 text-muted-foreground"
                        {...props}
                      />
                    ),
                    a: ({ node, href, children, ...props }) => (
                      <a
                        href={href}
                        onClick={(e) => handleLinkClick(e, href || '')}
                        className="font-semibold cursor-pointer hover:opacity-80 transition-opacity text-primary"
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

                      // Inline code
                      if (!match) {
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded text-sm font-mono bg-muted text-primary"
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      }

                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    },
                    pre: ({ node, ...props }) => (
                      <pre
                        className="rounded-2xl p-4 overflow-x-auto my-4 text-sm bg-zinc-900 text-zinc-100 dark:bg-zinc-950"
                        {...props}
                      />
                    )
                  }}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>

              {/* Status Footer */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Estado:
                  <span
                    className={`capitalize font-medium px-3 py-1 rounded-full ${
                      currentNote.status === 'understood' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {currentNote.status === 'understood' ? 'Dominado' :
                      currentNote.status === 'read' ? 'En progreso' : 'Nuevo'}
                  </span>
                </div>
                {currentNote.status !== 'understood' && (
                  <button
                    onClick={() => markAsUnderstood(currentNote.id || currentNote.slug)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all hover:scale-[1.02] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    <CheckCircle className="size-4" />
                    Marcar como Dominado
                  </button>
                )}
              </div>
            </article>
          ) : (
            <div className="text-center mt-20">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-primary/10 shadow-lg shadow-primary/5">
                <span className="text-4xl">🧠</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-foreground">
                Bienvenido a BrainFlow
              </h2>
              <p className="text-muted-foreground">
                Escribe un tema arriba para comenzar tu viaje de aprendizaje.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
