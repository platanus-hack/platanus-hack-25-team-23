"use client"

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
})

interface MermaidProps {
  chart: string
}

export function Mermaid({ chart }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    if (ref.current) {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
      mermaid.render(id, chart).then(({ svg }) => {
        setSvg(svg)
      }).catch((error) => {
        console.error('Mermaid render error:', error)
        setSvg('<p class="text-red-500">Failed to render diagram</p>')
      })
    }
  }, [chart])

  return (
    <div 
      ref={ref} 
      className="mermaid my-4 flex justify-center bg-slate-900/50 p-4 rounded-lg"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  )
}
