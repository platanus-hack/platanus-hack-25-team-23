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
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Search Header */}
      <div
        className="p-5 space-y-4"
        style={{
          backgroundColor: 'var(--card)',
          borderBottom: '2px solid #EEEBE6'
        }}
      >
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#9A9A9A' }} />
          <input
            placeholder="Que quieres aprender?"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all focus:outline-none focus:ring-2"
            style={{
              backgroundColor: '#F6F5F2',
              border: '2px solid #EEEBE6',
              color: '#222222'
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
        </form>

        {/* Breadcrumbs */}
        <div className="flex items-center text-sm overflow-x-auto whitespace-nowrap" style={{ color: '#6D6D6D' }}>
          <span
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setInput('')}
          >
            Inicio
          </span>
          {currentNote && (
            <>
              <span className="mx-2">/</span>
              <span className="font-medium" style={{ color: '#222222' }}>{currentNote.title}</span>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: '#E6DAFF' }}
              >
                <Loader2 className="size-6 animate-spin" style={{ color: '#9575CD' }} />
              </div>
              <p style={{ color: '#6D6D6D' }}>Generando conocimiento...</p>
            </div>
          ) : currentNote ? (
            <article>
              <h1 className="text-4xl font-bold mb-6" style={{ color: '#222222' }}>
                {currentNote.title}
              </h1>
              <div
                className="rounded-3xl p-6 mb-6"
                style={{
                  backgroundColor: 'var(--card)',
                  border: '2px solid #EEEBE6',
                  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)'
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0" style={{ color: '#222222' }} {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-2xl font-semibold mt-6 mb-3" style={{ color: '#222222' }} {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-xl font-semibold mt-4 mb-2" style={{ color: '#222222' }} {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="leading-7 mb-4" style={{ color: '#222222' }} {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="mb-1" style={{ color: '#222222' }} {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-bold" style={{ color: '#222222' }} {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="pl-4 my-4 italic rounded-r-xl py-3 pr-4"
                        style={{
                          borderLeft: '4px solid #E6DAFF',
                          backgroundColor: '#F6F5F2',
                          color: '#6D6D6D'
                        }}
                        {...props}
                      />
                    ),
                    a: ({ node, href, children, ...props }) => (
                      <a
                        href={href}
                        onClick={(e) => handleLinkClick(e, href || '')}
                        className="font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ color: '#9575CD' }}
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
                            className="px-1.5 py-0.5 rounded text-sm font-mono"
                            style={{ backgroundColor: '#F6F5F2', color: '#9575CD' }}
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
                        className="rounded-2xl p-4 overflow-x-auto my-4 text-sm"
                        style={{ backgroundColor: '#222222', color: '#F6F5F2' }}
                        {...props}
                      />
                    )
                  }}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>

              {/* Status Footer */}
              <div
                className="flex justify-between items-center p-4 rounded-2xl"
                style={{ backgroundColor: '#F6F5F2', border: '1px solid #EEEBE6' }}
              >
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6D6D6D' }}>
                  Estado:
                  <span
                    className="capitalize font-medium px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: currentNote.status === 'understood' ? '#D4F5E9' : '#FFF0E6',
                      color: currentNote.status === 'understood' ? '#10B981' : '#222222'
                    }}
                  >
                    {currentNote.status === 'understood' ? 'Dominado' :
                      currentNote.status === 'read' ? 'En progreso' : 'Nuevo'}
                  </span>
                </div>
                {currentNote.status !== 'understood' && (
                  <button
                    onClick={() => markAsUnderstood(currentNote.id || currentNote.slug)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: '#D4F5E9',
                      color: '#10B981'
                    }}
                  >
                    <CheckCircle className="size-4" />
                    Marcar como Dominado
                  </button>
                )}
              </div>
            </article>
          ) : (
            <div className="text-center mt-20">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                style={{
                  background: 'linear-gradient(135deg, #E6DAFF 0%, #D6C9F5 100%)',
                  boxShadow: '0px 4px 14px rgba(214, 201, 245, 0.4)'
                }}
              >
                <span className="text-4xl">🧠</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: '#222222' }}>
                Bienvenido a BrainFlow
              </h2>
              <p style={{ color: '#6D6D6D' }}>
                Escribe un tema arriba para comenzar tu viaje de aprendizaje.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
