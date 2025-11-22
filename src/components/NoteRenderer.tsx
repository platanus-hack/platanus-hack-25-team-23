"use client"

import React, { useMemo, useEffect, useState } from 'react'
import { AlertCircle, Lightbulb, HelpCircle, Code, Eye, Sparkles } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface NoteRendererProps {
  content: string
  onLinkClick?: (term: string) => void
  isStreaming?: boolean
}

// Render LaTeX to HTML using KaTeX
function renderLatex(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
      macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\C": "\\mathbb{C}",
      }
    })
  } catch (error) {
    console.error('KaTeX error:', error)
    return `<span class="text-red-500">${latex}</span>`
  }
}

// Parse [[links]], callouts, and math from content
function parseContent(content: string) {
  if (!content) return []

  const parts: Array<{
    type: 'text' | 'link' | 'callout' | 'code' | 'heading' | 'math-block' | 'math-inline' | 'bold' | 'italic' | 'artifact',
    value: string,
    calloutType?: string
  }> = []

  // Split by lines first to handle callouts and code blocks
  const lines = content.split('\n')
  let inCodeBlock = false
  let codeContent = ''
  let codeLanguage = ''
  let inMathBlock = false
  let mathContent = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Handle multi-line math blocks ($$...$$)
    if (line.trim() === '$$') {
      if (inMathBlock) {
        // End of math block
        parts.push({ type: 'math-block', value: mathContent.trim() })
        mathContent = ''
        inMathBlock = false
      } else {
        // Start of math block
        inMathBlock = true
      }
      continue
    }

    if (inMathBlock) {
      mathContent += (mathContent ? '\n' : '') + line
      continue
    }

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

    // Handle inline math blocks on single line ($$...$$)
    const blockMathMatch = line.match(/^\$\$(.+?)\$\$$/)
    if (blockMathMatch) {
      parts.push({ type: 'math-block', value: blockMathMatch[1] })
      continue
    }

    // Parse regular text with [[links]] and inline math ($...$)
    if (line.trim()) {
      parseLineWithMathAndLinks(line, parts)
    } else {
      parts.push({ type: 'text', value: '\n' })
    }
  }

  return parts
}

// Parse a line for [[links]], inline $math$, **bold**, *italic*, and :::artifact:::
function parseLineWithMathAndLinks(
  line: string,
  parts: Array<{ type: 'text' | 'link' | 'callout' | 'code' | 'heading' | 'math-block' | 'math-inline' | 'bold' | 'italic' | 'artifact', value: string, calloutType?: string }>
) {
  // Combined regex for links, inline math, bold, italic, and artifact
  // Matches: [[link]] OR $math$ OR **bold** OR *italic* OR :::artifact{...}:::
  const combinedRegex = /\[\[([^\]]+)\]\]|(?<!\$)\$(?!\$)([^$]+)\$(?!\$)|(\*\*|__)(.*?)\3|(\*|_)(.*?)\5|:::artifact\{([^}]+)\}:::/g
  let lastIndex = 0
  let match

  while ((match = combinedRegex.exec(line)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: line.slice(lastIndex, match.index) })
    }

    if (match[1]) {
      // It's a [[link]]
      parts.push({ type: 'link', value: match[1] })
    } else if (match[2]) {
      // It's inline $math$
      parts.push({ type: 'math-inline', value: match[2] })
    } else if (match[4]) {
      // It's **bold**
      parts.push({ type: 'bold', value: match[4] })
    } else if (match[6]) {
      // It's *italic*
      parts.push({ type: 'italic', value: match[6] })
    } else if (match[7]) {
      // It's an artifact
      parts.push({ type: 'artifact', value: match[7] })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < line.length) {
    parts.push({ type: 'text', value: line.slice(lastIndex) + '\n' })
  } else {
    parts.push({ type: 'text', value: '\n' })
  }
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

// Math component for rendering LaTeX
function MathBlock({ latex, displayMode }: { latex: string, displayMode: boolean }) {
  const html = useMemo(() => renderLatex(latex, displayMode), [latex, displayMode])

  if (displayMode) {
    return (
      <div
        className="my-4 py-4 px-6 rounded-2xl overflow-x-auto"
        style={{
          backgroundColor: '#F6F8FA',
          border: '1px solid #E6E6E6'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <span
      className="mx-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

import { FileArtifact } from './FileArtifact';

export function NoteRenderer({ content, onLinkClick, isStreaming }: NoteRendererProps) {
  const parsed = useMemo(() => parseContent(content), [content])

  return (
    <div className={`prose prose-gray max-w-none whitespace-pre-wrap ${isStreaming ? 'animate-pulse-subtle' : ''}`}>
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

          case 'math-block':
            return <MathBlock key={index} latex={part.value} displayMode={true} />

          case 'math-inline':
            return <MathBlock key={index} latex={part.value} displayMode={false} />

          case 'bold':
            return <strong key={index} className="font-bold">{part.value}</strong>

          case 'italic':
            return <em key={index} className="italic">{part.value}</em>

          case 'artifact':
             // Parse attributes from value string (e.g. path="/notes/foo.md")
             const pathMatch = part.value.match(/path="([^"]+)"/);
             const path = pathMatch ? pathMatch[1] : '';
             // Pass the FULL path so ChatView knows it's an artifact click
             return path ? <FileArtifact key={index} path={path} onClick={() => onLinkClick?.(path)} /> : null;

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
