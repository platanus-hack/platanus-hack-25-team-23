"use client"

import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { useKnowledge } from '@/lib/store/knowledge-context'

export function GraphPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const { notes, edges, currentNote, selectNote } = useKnowledge()

  useEffect(() => {
    if (!containerRef.current) return

    cyRef.current = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3B82F6',
            'label': 'data(label)',
            'color': '#F8FAFC',
            'font-size': '12px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'width': 20,
            'height': 20
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'node[status = "understood"]',
          style: {
            'background-color': '#22C55E',
            'line-color': '#22C55E',
            'target-arrow-color': '#22C55E'
          }
        },
        {
          selector: '.highlighted',
          style: {
            'background-color': '#FBBF24',
            'line-color': '#FBBF24',
            'target-arrow-color': '#FBBF24',
            'transition-property': 'background-color, line-color, target-arrow-color',
            'transition-duration': 0.5
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true
      }
    })

    return () => {
      cyRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    if (!cyRef.current) return

    const cy = cyRef.current
    
    // Add new nodes
    notes.forEach(note => {
      const existingNode = cy.$id(note.id || note.slug)
      if (existingNode.length === 0) {
        cy.add({
          group: 'nodes',
          data: { id: note.id || note.slug, label: note.title, status: note.status },
          position: { x: Math.random() * 500, y: Math.random() * 500 } // Random pos for now
        })
      } else {
        // Update status if changed
        if (existingNode.data('status') !== note.status) {
          existingNode.data('status', note.status)
        }
      }
    })

    // Add new edges
    edges.forEach(edge => {
      if (cy.$id(edge.id).length === 0) {
        cy.add({
          group: 'edges',
          data: { id: edge.id, source: edge.source, target: edge.target }
        })
      }
    })

    // Run layout if nodes changed
    if (notes.length > 0) {
      cy.layout({ name: 'cose', animate: true }).run()
    }
    
    // Highlight current note
    if (currentNote) {
      cy.elements().removeClass('highlighted')
      cy.$id(currentNote.id || currentNote.slug).addClass('highlighted')
    }

    // Handle clicks
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      selectNote(node.id())
    })

  }, [notes, edges, currentNote, selectNote])

  return (
    <div ref={containerRef} className="h-full w-full bg-slate-950" />
  )
}
