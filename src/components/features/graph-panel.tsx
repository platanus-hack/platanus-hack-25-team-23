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
            'background-color': '#C9B7F3',
            'label': 'data(label)',
            'color': '#222222',
            'font-size': '11px',
            'font-weight': 500,
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'width': 24,
            'height': 24,
            'border-width': 2,
            'border-color': '#FFFFFF'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#EEEBE6',
            'target-arrow-color': '#EEEBE6',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'node[status = "understood"]',
          style: {
            'background-color': '#A3E4B6',
            'border-color': '#FFFFFF'
          }
        },
        {
          selector: 'node[status = "read"]',
          style: {
            'background-color': '#FFE9A9',
            'border-color': '#FFFFFF'
          }
        },
        {
          selector: '.highlighted',
          style: {
            'background-color': '#FFD9D9',
            'border-color': '#FFFFFF',
            'border-width': 3,
            'width': 32,
            'height': 32,
            'transition-property': 'background-color, border-width, width, height',
            'transition-duration': 0.3
          }
        },
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0,
            'overlay-color': 'transparent'
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500
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
    <div
      ref={containerRef}
      className="h-full w-full rounded-tl-3xl"
      style={{
        backgroundColor: '#F6F5F2',
        cursor: 'grab'
      }}
    />
  )
}
