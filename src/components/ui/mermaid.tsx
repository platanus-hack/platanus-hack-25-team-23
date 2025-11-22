"use client"

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor: '#FFF0E6',
    primaryTextColor: '#222222',
    primaryBorderColor: '#EEEBE6',
    lineColor: '#6D6D6D',
    secondaryColor: '#E6DAFF',
    tertiaryColor: '#F6F5F2',
  },
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
        setSvg('<p class="text-[#D46A6A]">Failed to render diagram</p>')
      })
    }
  }, [chart])

  return (
    <div
      ref={ref}
      className="mermaid my-4 flex justify-center bg-[#F6F5F2] p-6 rounded-2xl border border-[#EEEBE6]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
