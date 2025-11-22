"use client"

import React, { useMemo } from 'react'
import { useKnowledge } from '@/lib/store/knowledge-context'
import { AlertCircle, Lightbulb, HelpCircle, Code, Eye, Sparkles } from 'lucide-react'

interface NoteRendererProps {
  content: string
  onLinkClick?: (term: string) => void
  isStreaming?: boolean
}

// Parse [[links]] and callouts from content
function parseContent(content: string) {
  if (!content) return []

  const parts: Array<{ type: 'text' | 'link' | 'callout' | 'code' | 'heading' | 'math', value: string, calloutType?: string }> = []

  // Split by lines first to handle callouts and code blocks
  const lines = content.split('\n')
  let inCodeBlock = false
  let codeContent = ''
  let codeLanguage = ''

  for (const line of lines) {
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        parts.push({ type: 'code', value: codeContent, calloutType: codeLanguage })
        codeContent = ''
        codeLanguage = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeLanguage = line.slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line
      continue
    }

    // Handle headings
    if (line.startsWith('## ')) {
      parts.push({ type: 'heading', value: line.slice(3) })
      continue
    }
    if (line.startsWith('# ')) {
      parts.push({ type: 'heading', value: line.slice(2) })
      continue
    }

    // Handle callouts
    const calloutMatch = line.match(/^- (&|!{1,2}|\?|Ex:|Obs:)\s*(.*)/)
    if (calloutMatch) {
      const [, marker, text] = calloutMatch
      parts.push({ type: 'callout', value: text, calloutType: marker })
      continue
    }

    // Handle math blocks
    if (line.includes('$$')) {
      const mathMatch = line.match(/\$\$(.+?)\$\$/)
      if (mathMatch) {
        parts.push({ type: 'math', value: mathMatch[1] })
        continue
      }
    }

    // Parse regular text with [[links]]
    if (line.trim()) {
      const linkRegex = /\[\[([^\]]+)\]\]/g
      let lastIndex = 0
      let match

      while ((match = linkRegex.exec(line)) !== null) {
        // Add text before the link
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: line.slice(lastIndex, match.index) })
        }
        // Add the link
        parts.push({ type: 'link', value: match[1] })
        lastIndex = match.index + match[0].length
      }

      // Add remaining text
      if (lastIndex < line.length) {
        parts.push({ type: 'text', value: line.slice(lastIndex) + '\n' })
      } else {
        parts.push({ type: 'text', value: '\n' })
      }
    } else {
      parts.push({ type: 'text', value: '\n' })
    }
  }

  return parts
}

// Callout component
function Callout({ type, children }: { type: string, children: React.ReactNode }) {
  const config = {
    '&': {
      icon: Lightbulb,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      iconColor: 'text-amber-500',
      label: 'Insight clave'
    },
    '!': {
      icon: AlertCircle,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      iconColor: 'text-blue-500',
      label: 'Importante'
    },
    '!!': {
      icon: AlertCircle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      iconColor: 'text-red-500',
      label: 'Advertencia'
    },
    '?': {
      icon: HelpCircle,
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      iconColor: 'text-purple-500',
      label: 'Explorar'
    },
    'Ex:': {
      icon: Code,
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      iconColor: 'text-green-500',
      label: 'Ejemplo'
    },
    'Obs:': {
      icon: Eye,
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-800',
      iconColor: 'text-gray-500',
      label: 'Observación'
    },
  }[type] || {
    icon: Lightbulb,
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    iconColor: 'text-gray-500',
    label: ''
  }

  const Icon = config.icon

  return (
    <div className={`${config.bg} ${config.border} ${config.text} border rounded-xl p-4 my-3 flex items-start gap-3`}>
      <Icon className={`size-5 mt-0.5 ${config.iconColor} shrink-0`} />
      <div>
        {config.label && <span className="font-semibold text-sm">{config.label}: </span>}
        {children}
      </div>
    </div>
  )
}

// Link component
function ConceptLink({ term, onClick }: { term: string, onClick?: (term: string) => void }) {
  return (
    <button
      onClick={() => onClick?.(term)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors font-medium text-sm cursor-pointer border border-purple-200 hover:border-purple-300"
    >
      <Sparkles className="size-3" />
      {term}
    </button>
  )
}

export function NoteRenderer({ content, onLinkClick, isStreaming }: NoteRendererProps) {
  const parsed = useMemo(() => parseContent(content), [content])

  return (
    <div className={`prose prose-gray max-w-none ${isStreaming ? 'animate-pulse-subtle' : ''}`}>
      {parsed.map((part, index) => {
        switch (part.type) {
          case 'link':
            return <ConceptLink key={index} term={part.value} onClick={onLinkClick} />

          case 'callout':
            return (
              <Callout key={index} type={part.calloutType || '!'}>
                {part.value}
              </Callout>
            )

          case 'heading':
            return (
              <h2 key={index} className="text-xl font-bold mt-6 mb-3" style={{ color: '#1E1E1E' }}>
                {part.value}
              </h2>
            )

          case 'code':
            return (
              <pre key={index} className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto my-4 text-sm">
                <code>{part.value}</code>
              </pre>
            )

          case 'math':
            return (
              <div key={index} className="bg-gray-100 rounded-xl p-4 my-4 font-mono text-center overflow-x-auto">
                {part.value}
              </div>
            )

          case 'text':
          default:
            return <span key={index}>{part.value}</span>
        }
      })}

      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-purple-500 animate-blink ml-1" />
      )}
    </div>
  )
}

// Streaming indicator component
export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 text-purple-600">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm font-medium">Nodi está pensando...</span>
    </div>
  )
}
