"use client"

import React, { useMemo, useEffect, useState } from 'react'
import { AlertCircle, Lightbulb, HelpCircle, Code, Eye, Sparkles, BookOpen } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface NoteRendererProps {
  content: string
  onLinkClick?: (term: string) => void
  isStreaming?: boolean
  existingNotes?: Array<{ title: string, slug: string }>
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
    type: 'text' | 'link' | 'md-link' | 'callout' | 'code' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'hr' | 'list-item' | 'math-block' | 'math-inline' | 'bold' | 'italic' | 'artifact',
    value: string,
    calloutType?: string,
    parts?: any[]
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

    // Handle headings - check longest first to avoid partial matches
    if (line.startsWith('###### ')) {
      const text = line.slice(7);
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'h6', value: text, parts: itemParts })
      continue
    }
    if (line.startsWith('##### ')) {
      const text = line.slice(6);
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'h5', value: text, parts: itemParts })
      continue
    }
    if (line.startsWith('#### ')) {
      const text = line.slice(5);
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'h4', value: text, parts: itemParts })
      continue
    }
    if (line.startsWith('### ')) {
      const text = line.slice(4);
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'h3', value: text, parts: itemParts })
      continue
    }
    if (line.startsWith('## ')) {
      const text = line.slice(3);
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'h2', value: text, parts: itemParts })
      continue
    }
    if (line.startsWith('# ')) {
      const text = line.slice(2);
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'h1', value: text, parts: itemParts })
      continue
    }

    // Handle callouts
    const calloutMatch = line.match(/^- (&|!{1,2}|\?|Ex:|Obs:)\s*(.*)/)
    if (calloutMatch) {
      const [, marker, text] = calloutMatch
      const itemParts: any[] = [];
      parseLineWithMathAndLinks(text, itemParts);
      parts.push({ type: 'callout', value: text, calloutType: marker, parts: itemParts })
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
  parts: Array<{ type: 'text' | 'link' | 'md-link' | 'callout' | 'code' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'hr' | 'list-item' | 'math-block' | 'math-inline' | 'bold' | 'italic' | 'artifact', value: string, calloutType?: string, parts?: any[] }>
) {
  // Combined regex for links, inline math, bold, italic, artifact, AND standard markdown links [text](url)
  // Matches: [[link]] OR [text](url) OR $math$ OR **bold** OR *italic* OR :::artifact{...}:::
  const combinedRegex = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)|(?<!\$)\$(?!\$)([^$]+)\$(?!\$)|(\*\*|__)(.*?)\5|(\*|_)(.*?)\7|:::artifact\{([^}]+)\}:::/g
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
    } else if (match[2] && match[3]) {
      // It's a [text](url)
      parts.push({ type: 'md-link', value: match[2], calloutType: match[3] }) // value=text, calloutType=url
    } else if (match[4]) {
      // It's inline $math$
      parts.push({ type: 'math-inline', value: match[4] })
    } else if (match[6]) {
      // It's **bold**
      parts.push({ type: 'bold', value: match[6] })
    } else if (match[8]) {
      // It's *italic*
      parts.push({ type: 'italic', value: match[8] })
    } else if (match[9]) {
      // It's an artifact
      parts.push({ type: 'artifact', value: match[9] })
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

// Callout component with Kenko styling
function Callout({ type, children }: { type: string, children: React.ReactNode }) {
  const config = {
    '&': {
      icon: Lightbulb,
      bg: '#FFF0E6',
      border: '#FFE4D1',
      text: '#CC7E4A',
      iconColor: '#CC7E4A',
      label: 'Insight clave'
    },
    '!': {
      icon: AlertCircle,
      bg: '#CFE4FF',
      border: '#A3D4FF',
      text: '#5A8FCC',
      iconColor: '#5A8FCC',
      label: 'Importante'
    },
    '!!': {
      icon: AlertCircle,
      bg: '#FFD9D9',
      border: '#FFCACA',
      text: '#D46A6A',
      iconColor: '#D46A6A',
      label: 'Advertencia'
    },
    '?': {
      icon: HelpCircle,
      bg: '#E6DAFF',
      border: '#D6C9F5',
      text: '#9575CD',
      iconColor: '#9575CD',
      label: 'Explorar'
    },
    'Ex:': {
      icon: Code,
      bg: '#D4F5E9',
      border: '#A3E4B6',
      text: '#10B981',
      iconColor: '#10B981',
      label: 'Ejemplo'
    },
    'Obs:': {
      icon: Eye,
      bg: '#F6F5F2',
      border: '#EEEBE6',
      text: '#6D6D6D',
      iconColor: '#6D6D6D',
      label: 'Observacion'
    },
  }[type] || {
    icon: Lightbulb,
    bg: '#F6F5F2',
    border: '#EEEBE6',
    text: '#6D6D6D',
    iconColor: '#6D6D6D',
    label: ''
  }

  const Icon = config.icon

  return (
    <div
      className="rounded-2xl p-4 my-3 flex items-start gap-3"
      style={{
        backgroundColor: config.bg,
        border: `2px solid ${config.border}`,
        color: config.text
      }}
    >
      <Icon className="size-5 mt-0.5 shrink-0" style={{ color: config.iconColor }} />
      <div>
        {config.label && <span className="font-semibold text-sm">{config.label}: </span>}
        {children}
      </div>
    </div>
  )
}


// Link component
function ConceptLink({ term, displayText, onClick }: { term: string, displayText?: string, onClick?: (term: string) => void }) {
  return (
    <button
      onClick={() => onClick?.(term)}
      className="group relative inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all font-medium text-sm cursor-pointer border border-purple-200 hover:border-purple-300 overflow-hidden"
    >
      <Sparkles className="size-3" />
      <span className="relative z-10">{displayText || term}</span>
      
      {/* Shine effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-0" />
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
          backgroundColor: '#F6F5F2',
          border: '2px solid #EEEBE6'
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

// Helper to render parts recursively
function RenderParts({ parts, onLinkClick, existingNotes }: { parts: any[], onLinkClick?: (term: string) => void, existingNotes?: Array<{ title: string, slug: string }> }) {
    return (
        <>
            {parts.map((p: any, i: number) => {
                switch (p.type) {
                case 'link':
                    const [target, alias] = p.value.split('|');
                    // Check if note exists
                    const noteExists = existingNotes?.some(n => 
                        n.title.toLowerCase() === target.toLowerCase() || 
                        n.slug.toLowerCase() === target.toLowerCase()
                    );

                    if (noteExists) {
                        return (
                            <button key={i} onClick={() => onLinkClick?.(target)} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium text-sm cursor-pointer border border-blue-200 hover:border-blue-300 mx-0.5 align-baseline">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4h4"/></svg>
                                {alias || target}
                            </button>
                        );
                    }
                    return <ConceptLink key={i} term={target} displayText={alias || target} onClick={onLinkClick} />
                case 'md-link':
                    const isInternal = p.calloutType?.startsWith('/');
                    if (isInternal) {
                        return (
                            <button key={i} onClick={() => onLinkClick?.(p.calloutType!)} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium text-sm cursor-pointer border border-blue-200 hover:border-blue-300 mx-0.5 align-baseline">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4h4"/></svg>
                                {p.value}
                            </button>
                        );
                    }
                    return <a key={i} href={p.calloutType} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline hover:text-blue-800 transition-colors">{p.value}<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></a>
                case 'bold': return <strong key={i} className="font-bold">{p.value}</strong>
                case 'italic': return <em key={i} className="italic">{p.value}</em>
                case 'math-inline': return <MathBlock key={i} latex={p.value} displayMode={false} />
                default: return <span key={i}>{p.value}</span>
                }
            })}
        </>
    )
}

export function StreamingIndicator() {
  return <span className="inline-block w-2 h-5 bg-purple-500 animate-blink ml-1" />
}

export function NoteRenderer({ content, onLinkClick, isStreaming, existingNotes }: NoteRendererProps) {
  const parsed = useMemo(() => parseContent(content), [content])

  return (
    <div className={`prose prose-gray max-w-none whitespace-pre-wrap ${isStreaming ? 'animate-pulse-subtle' : ''}`}>
      {parsed.map((part, index) => {
        switch (part.type) {
          case 'link':
            const [target, alias] = part.value.split('|');
            // Check if note exists
            const noteExists = existingNotes?.some(n => 
                n.title.toLowerCase() === target.toLowerCase() || 
                n.slug.toLowerCase() === target.toLowerCase()
            );

            if (noteExists) {
                return (
                    <button 
                        key={index} 
                        onClick={() => onLinkClick?.(target)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium text-sm cursor-pointer border border-blue-200 hover:border-blue-300 mx-0.5 align-baseline"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4h4"/></svg>
                        {alias || target}
                    </button>
                );
            }
            return <ConceptLink key={index} term={target} displayText={alias || target} onClick={onLinkClick} />

          case 'md-link':
            // Check if it's an internal file path (starts with /) or external URL
            const isInternal = part.calloutType?.startsWith('/');
            if (isInternal) {
                return (
                    <button 
                        key={index} 
                        onClick={() => onLinkClick?.(part.calloutType!)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium text-sm cursor-pointer border border-blue-200 hover:border-blue-300 mx-0.5 align-baseline"
                        title={part.calloutType}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4h4"/></svg>
                        {part.value}
                    </button>
                );
            }
            return (
                <a 
                    key={index} 
                    href={part.calloutType} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                >
                    {part.value}
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                </a>
            );

          case 'callout':
            return (
              <Callout key={index} type={part.calloutType || '!'}>
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </Callout>
            )

          case 'h1':
            return (
              <h1 key={index} className="text-3xl font-bold mt-8 mb-6 text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </h1>
            )

          case 'h2':
            return (
              <h2 key={index} className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </h2>
            )
          
          case 'h3':
            return (
              <h3 key={index} className="text-xl font-semibold mt-6 mb-3 text-zinc-800 dark:text-zinc-200">
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </h3>
            )

          case 'h4':
            return (
              <h4 key={index} className="text-lg font-medium mt-4 mb-2 text-zinc-700 dark:text-zinc-300">
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </h4>
            )

          case 'h5':
            return (
              <h5 key={index} className="text-base font-medium mt-4 mb-2 text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </h5>
            )

          case 'h6':
            return (
              <h6 key={index} className="text-sm font-medium mt-4 mb-2 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
              </h6>
            )

          case 'hr':
            return <hr key={index} className="my-8 border-t-2 border-zinc-100 dark:border-zinc-800" />

          case 'list-item':
            return (
                <div key={index} className="flex items-start gap-2 my-1 ml-4">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                    <div className="flex-1">
                        {part.parts ? <RenderParts parts={part.parts} onLinkClick={onLinkClick} existingNotes={existingNotes} /> : part.value}
                    </div>
                </div>
            )

          case 'code':
            return (
              <pre
                key={index}
                className="rounded-2xl p-4 overflow-x-auto my-4 text-sm font-mono"
                style={{ backgroundColor: '#222222', color: '#F6F5F2' }}
              >
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

      {isStreaming && <StreamingIndicator />}
    </div>
  )
}
