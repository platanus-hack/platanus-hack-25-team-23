"use client"

import { useEffect, Suspense } from "react"
import { useKnowledge } from "@/lib/store/knowledge-context"
import { ArrowLeft, CheckCircle, BookOpen, Loader2 } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter, useSearchParams } from "next/navigation"

function StudyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentNote, notes, isLoading, generateNote, markAsUnderstood, selectNote } = useKnowledge()

  // Load note based on topic query parameter
  useEffect(() => {
    const topic = searchParams.get('topic')
    if (topic) {
      // First try to find an existing note by title
      const existingNote = notes.find(n =>
        n.title.toLowerCase() === topic.toLowerCase()
      )
      if (existingNote) {
        selectNote(existingNote.id || existingNote.slug)
      }
    }
  }, [searchParams, notes, selectNote])

  // Transform [[term]] links to clickable elements
  const transformContent = (content: string) => {
    return content.replace(/\[\[([^\]]+)\]\]/g, '[$1](#$1)')
  }

  const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const term = href.slice(1)
      await generateNote(term, currentNote?.title)
    }
  }

  const handleMarkUnderstood = () => {
    if (currentNote?.slug) {
      markAsUnderstood(currentNote.slug)
    }
  }

  if (!currentNote && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#E6DAFF' }}
          >
            <BookOpen className="size-10" style={{ color: '#9575CD' }} />
          </div>
          <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Sin nota seleccionada</h2>
          <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>Genera una nueva nota para empezar a aprender</p>
          <Link
            href="/new-query"
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-2xl hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
            }}
          >
            Nueva Consulta
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 transition-all duration-300"
            style={{
              backgroundColor: 'var(--card)',
              border: '2px solid #EEEBE6'
            }}
          >
            <ArrowLeft className="size-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isLoading ? 'Generando...' : currentNote?.title}
            </h1>
            {currentNote?.status && (
              <span className={`inline-flex items-center gap-1 text-sm mt-1`}
                style={{
                  color: currentNote.status === 'understood' ? '#10B981' :
                    currentNote.status === 'read' ? '#F59E0B' : '#3B82F6'
                }}
              >
                {currentNote.status === 'understood' && <CheckCircle className="size-4" />}
                {currentNote.status === 'understood' ? 'Dominado' :
                  currentNote.status === 'read' ? 'En progreso' : 'Nuevo'}
              </span>
            )}
          </div>
          {currentNote && currentNote.status !== 'understood' && (
            <button
              onClick={handleMarkUnderstood}
              className="flex items-center gap-2 px-4 py-2 rounded-xl hover:scale-105 transition-all duration-300"
              style={{
                backgroundColor: '#D4F5E9',
                color: '#10B981'
              }}
            >
              <CheckCircle className="size-5" />
              Marcar como dominado
            </button>
          )}
        </div>

        {/* Content */}
        <div
          className="rounded-3xl p-8"
          style={{
            backgroundColor: 'var(--card)',
            border: '2px solid #EEEBE6',
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)'
          }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="size-12 animate-spin mb-4" style={{ color: '#C9B7F3' }} />
              <p style={{ color: 'var(--muted-foreground)' }}>Generando contenido...</p>
            </div>
          ) : currentNote?.content ? (
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      onClick={(e) => handleLinkClick(e, href || '')}
                      className="underline cursor-pointer font-medium hover:opacity-80 transition-opacity"
                      style={{ color: '#9575CD' }}
                    >
                      {children}
                    </a>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold mb-6 mt-8 first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-semibold mb-4 mt-6" style={{ color: 'var(--foreground)' }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-semibold mb-3 mt-5" style={{ color: 'var(--foreground)' }}>{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="leading-relaxed mb-4" style={{ color: 'var(--foreground)' }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 mb-4 list-none">{children}</ul>
                  ),
                  li: ({ children }) => {
                    const text = String(children)
                    // Handle special callouts
                    if (text.startsWith('& ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#CFE4FF', border: '1px solid #A3D4FF' }}>
                          <span style={{ color: '#5A8FCC' }} className="text-xl">Key</span>
                          <span style={{ color: 'var(--foreground)' }}>{text.slice(2)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('! ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#FFF0E6', border: '1px solid #FFD5A5' }}>
                          <span style={{ color: '#CC7E4A' }} className="text-xl">!</span>
                          <span style={{ color: 'var(--foreground)' }}>{text.slice(2)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('Ex: ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#D4F5E9', border: '1px solid #A3E4B6' }}>
                          <span style={{ color: '#10B981' }} className="text-xl">Example</span>
                          <span style={{ color: 'var(--foreground)' }}>{text.slice(4)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('? ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#E6DAFF', border: '1px solid #D6C9F5' }}>
                          <span style={{ color: '#9575CD' }} className="text-xl">?</span>
                          <span style={{ color: 'var(--foreground)' }}>{text.slice(2)}</span>
                        </li>
                      )
                    }
                    return (
                      <li className="flex items-start gap-2" style={{ color: 'var(--foreground)' }}>
                        <span className="mt-1" style={{ color: '#C9B7F3' }}>-</span>
                        <span>{children}</span>
                      </li>
                    )
                  },
                  code: ({ children, className }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code
                          className="px-2 py-0.5 rounded text-sm font-mono"
                          style={{ backgroundColor: '#F6F5F2', color: '#9575CD' }}
                        >
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className="block p-4 rounded-xl overflow-x-auto font-mono text-sm" style={{ backgroundColor: '#222222', color: '#F6F5F2' }}>
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="rounded-xl overflow-hidden mb-4" style={{ backgroundColor: '#222222' }}>{children}</pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="pl-4 italic my-4" style={{ borderLeft: '4px solid #E6DAFF', color: 'var(--muted-foreground)' }}>
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {transformContent(currentNote.content)}
              </ReactMarkdown>
            </div>
          ) : (
            <p style={{ color: 'var(--muted-foreground)' }}>Sin contenido disponible</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mt-6">
          <Link
            href="/graph"
            className="flex-1 p-4 rounded-xl text-center hover:scale-[1.02] transition-all duration-300"
            style={{
              backgroundColor: 'var(--card)',
              border: '2px solid #EEEBE6',
              color: 'var(--foreground)'
            }}
          >
            <span>Ver en el Grafo</span>
          </Link>
          <Link
            href="/new-query"
            className="flex-1 p-4 rounded-xl text-center hover:scale-[1.02] transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #E6DAFF 0%, #D6C9F5 100%)',
              color: '#6B5B95'
            }}
          >
            <span className="font-medium">Nueva Consulta</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function StudyPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando estudio...</div>
      </div>
    }>
      <StudyPageContent />
    </Suspense>
  )
}
