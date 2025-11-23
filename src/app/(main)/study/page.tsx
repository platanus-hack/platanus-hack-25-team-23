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
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-primary/10">
            <BookOpen className="size-10 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Sin nota seleccionada</h2>
          <p className="mb-6 text-muted-foreground">Genera una nueva nota para empezar a aprender</p>
          <Link
            href="/new-query"
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-2xl hover:scale-105 transition-all duration-300 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            Nueva Consulta
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-4 py-4 md:px-8 md:py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6 md:mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 transition-all duration-300 bg-card border border-border text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">
              {isLoading ? 'Generando...' : currentNote?.title}
            </h1>
            {currentNote?.status && (
              <span className={`inline-flex items-center gap-1 text-sm mt-1 ${
                currentNote.status === 'understood' ? 'text-emerald-500' :
                currentNote.status === 'read' ? 'text-amber-500' : 'text-blue-500'
              }`}>
                {currentNote.status === 'understood' && <CheckCircle className="size-4" />}
                {currentNote.status === 'understood' ? 'Dominado' :
                  currentNote.status === 'read' ? 'En progreso' : 'Nuevo'}
              </span>
            )}
          </div>
          {currentNote && currentNote.status !== 'understood' && (
            <button
              onClick={handleMarkUnderstood}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl hover:scale-105 transition-all duration-300 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 w-full md:w-auto"
            >
              <CheckCircle className="size-5" />
              Marcar como dominado
            </button>
          )}
        </div>

        {/* Content */}
        <div className="rounded-3xl p-4 md:p-8 bg-card border border-border shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="size-12 animate-spin mb-4 text-primary" />
              <p className="text-muted-foreground">Generando contenido...</p>
            </div>
          ) : currentNote?.content ? (
            <div className="prose prose-lg max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      onClick={(e) => handleLinkClick(e, href || '')}
                      className="underline cursor-pointer font-medium hover:opacity-80 transition-opacity text-primary"
                    >
                      {children}
                    </a>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold mb-6 mt-8 first:mt-0 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-semibold mb-4 mt-6 text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-semibold mb-3 mt-5 text-foreground">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="leading-relaxed mb-4 text-foreground">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 mb-4 list-none">{children}</ul>
                  ),
                  li: ({ children }) => {
                    const text = String(children)
                    // Handle special callouts
                    if (text.startsWith('& ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <span className="text-xl text-blue-500">Key</span>
                          <span className="text-foreground">{text.slice(2)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('! ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                          <span className="text-xl text-orange-500">!</span>
                          <span className="text-foreground">{text.slice(2)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('Ex: ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-xl text-emerald-500">Example</span>
                          <span className="text-foreground">{text.slice(4)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('? ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <span className="text-xl text-purple-500">?</span>
                          <span className="text-foreground">{text.slice(2)}</span>
                        </li>
                      )
                    }
                    return (
                      <li className="flex items-start gap-2 text-foreground">
                        <span className="mt-1 text-primary">-</span>
                        <span>{children}</span>
                      </li>
                    )
                  },
                  code: ({ children, className }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code className="px-2 py-0.5 rounded text-sm font-mono bg-muted text-primary">
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className="block p-4 rounded-xl overflow-x-auto font-mono text-sm bg-muted/50 text-foreground">
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="rounded-xl overflow-hidden mb-4 bg-muted/50">{children}</pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="pl-4 italic my-4 border-l-4 border-primary text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {transformContent(currentNote.content)}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground">Sin contenido disponible</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col md:flex-row gap-4 mt-6">
          <Link
            href="/graph"
            className="flex-1 p-4 rounded-xl text-center hover:scale-[1.02] transition-all duration-300 bg-card border border-border text-foreground hover:bg-muted"
          >
            <span>Ver en el Grafo</span>
          </Link>
          <Link
            href="/new-query"
            className="flex-1 p-4 rounded-xl text-center hover:scale-[1.02] transition-all duration-300 bg-primary/10 text-primary hover:bg-primary/20"
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
