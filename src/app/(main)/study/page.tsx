"use client"

import { useKnowledge } from "@/lib/store/knowledge-context"
import { ArrowLeft, CheckCircle, BookOpen, Loader2 } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"

export default function StudyPage() {
  const router = useRouter()
  const { currentNote, isLoading, generateNote, markAsUnderstood } = useKnowledge()

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
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="size-10 text-purple-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sin nota seleccionada</h2>
          <p className="text-gray-600 mb-6">Genera una nueva nota para empezar a aprender</p>
          <Link
            href="/new-query"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            Nueva Consulta
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="size-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {isLoading ? 'Generando...' : currentNote?.title}
            </h1>
            {currentNote?.status && (
              <span className={`inline-flex items-center gap-1 text-sm mt-1 ${
                currentNote.status === 'understood' ? 'text-green-600' :
                currentNote.status === 'read' ? 'text-yellow-600' :
                'text-blue-600'
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
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"
            >
              <CheckCircle className="size-5" />
              Marcar como dominado
            </button>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="size-12 text-purple-600 animate-spin mb-4" />
              <p className="text-gray-600">Generando contenido...</p>
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
                      className="text-purple-600 hover:text-purple-700 underline cursor-pointer font-medium"
                    >
                      {children}
                    </a>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold text-gray-900 mb-6 mt-8 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4 mt-6">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-5">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 mb-4 list-none">{children}</ul>
                  ),
                  li: ({ children }) => {
                    const text = String(children)
                    // Handle special callouts
                    if (text.startsWith('& ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <span className="text-blue-600 text-xl">Key</span>
                          <span className="text-gray-700">{text.slice(2)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('! ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                          <span className="text-yellow-600 text-xl">!</span>
                          <span className="text-gray-700">{text.slice(2)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('Ex: ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                          <span className="text-green-600 text-xl">Example</span>
                          <span className="text-gray-700">{text.slice(4)}</span>
                        </li>
                      )
                    }
                    if (text.startsWith('? ')) {
                      return (
                        <li className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                          <span className="text-purple-600 text-xl">?</span>
                          <span className="text-gray-700">{text.slice(2)}</span>
                        </li>
                      )
                    }
                    return (
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-purple-400 mt-1">-</span>
                        <span>{children}</span>
                      </li>
                    )
                  },
                  code: ({ children, className }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code className="bg-gray-100 text-purple-600 px-2 py-0.5 rounded text-sm font-mono">
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className="block bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto font-mono text-sm">
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="bg-gray-900 rounded-xl overflow-hidden mb-4">{children}</pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-purple-300 pl-4 italic text-gray-600 my-4">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {transformContent(currentNote.content)}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-gray-500">Sin contenido disponible</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mt-6">
          <Link
            href="/graph"
            className="flex-1 p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-colors text-center"
          >
            <span className="text-gray-700">Ver en el Grafo</span>
          </Link>
          <Link
            href="/new-query"
            className="flex-1 p-4 bg-purple-100 rounded-xl hover:bg-purple-200 transition-colors text-center"
          >
            <span className="text-purple-700">Nueva Consulta</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
