"use client"

import { useEffect, useRef, useState } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { ZoomIn, ZoomOut, Maximize2, Eye } from "lucide-react"
import * as d3 from 'd3'
import Link from 'next/link'

interface GraphNode {
  id: string
  name: string
  status: 'understood' | 'in-progress' | 'pending'
  area: string
  areaColor?: string
  level: 'beginner' | 'intermediate' | 'advanced'
  isYouNode?: boolean
  isAreaNode?: boolean
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
  type?: string
}

interface Area {
  id: string
  name: string
  color: string
  icon: string
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { notes, edges, session } = useKnowledge()
  const [viewMode, setViewMode] = useState<'status' | 'area'>('area')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  // Load graph data from API
  useEffect(() => {
    async function loadGraphData() {
      if (!session?.user) {
        // For demo mode, use notes from context
        // Filter out incomplete notes (no slug or temp slug)
        const validNotes = notes.filter(note =>
          note.slug &&
          note.slug !== 'temp' &&
          note.title &&
          note.title !== 'Generating...'
        )

        const demoNodes: GraphNode[] = [
          { id: 'you', name: 'Yo', status: 'understood', area: '', level: 'intermediate', isYouNode: true },
          ...validNotes.map(note => ({
            id: note.slug,
            name: note.title,
            status: (note.status === 'understood' ? 'understood' :
                    note.status === 'read' ? 'in-progress' : 'pending') as 'understood' | 'in-progress' | 'pending',
            area: 'General',
            areaColor: '#C9B7F3',
            level: 'intermediate' as const,
          }))
        ]

        // Create links from "Yo" to each valid note
        const demoLinks: GraphLink[] = validNotes.map(note => ({
          source: 'you',
          target: note.slug
        }))

        // Add edges from context (these are created when notes are generated)
        edges.forEach(edge => {
          // Only add if both source and target exist in nodes
          const sourceExists = demoNodes.some(n => n.id === edge.source)
          const targetExists = demoNodes.some(n => n.id === edge.target)
          if (sourceExists && targetExists) {
            demoLinks.push({
              source: edge.source,
              target: edge.target
            })
          }
        })

        // Add links between notes based on linkedTerms
        validNotes.forEach(note => {
          if (note.linkedTerms) {
            note.linkedTerms.forEach(term => {
              const targetNote = validNotes.find(n =>
                n.title.toLowerCase() === term.toLowerCase() ||
                n.slug === term.toLowerCase().replace(/[^a-z0-9]+/g, '-')
              )
              if (targetNote && !demoLinks.some(l => l.source === note.slug && l.target === targetNote.slug)) {
                demoLinks.push({
                  source: note.slug,
                  target: targetNote.slug
                })
              }
            })
          }
        })

        console.log('Demo mode - nodes:', demoNodes.length, 'links:', demoLinks.length, 'validNotes:', validNotes.length)

        setGraphNodes(demoNodes)
        setGraphLinks(demoLinks)
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Load areas
      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)

      if (areasData) {
        setAreas(areasData)
      }

      // Load concepts
      const { data: concepts } = await supabase
        .from('concepts')
        .select('*, areas(name, color)')
        .eq('user_id', session.user.id)

      // Load relationships
      const { data: relationships } = await supabase
        .from('concept_relationships')
        .select('*')
        .eq('user_id', session.user.id)

      // Build nodes
      const nodes: GraphNode[] = [
        { id: 'you', name: 'Yo', status: 'understood', area: '', level: 'intermediate', isYouNode: true }
      ]

      // Add area nodes
      if (areasData) {
        areasData.forEach(area => {
          nodes.push({
            id: `area-${area.id}`,
            name: area.name,
            status: 'understood',
            area: area.name,
            areaColor: area.color,
            level: 'intermediate',
            isAreaNode: true
          })
        })
      }

      // Add concept nodes
      if (concepts) {
        concepts.forEach(concept => {
          nodes.push({
            id: concept.id,
            name: concept.name,
            status: concept.status || 'pending',
            area: (concept.areas as any)?.name || 'General',
            areaColor: (concept.areas as any)?.color || '#C9B7F3',
            level: concept.level || 'intermediate'
          })
        })
      }

      // Build links
      const links: GraphLink[] = []

      // Link you to areas
      if (areasData) {
        areasData.forEach(area => {
          links.push({ source: 'you', target: `area-${area.id}` })
        })
      }

      // Link concepts to their areas
      if (concepts) {
        concepts.forEach(concept => {
          if (concept.area_id) {
            links.push({ source: `area-${concept.area_id}`, target: concept.id })
          }
        })
      }

      // Add relationship links
      if (relationships) {
        relationships.forEach(rel => {
          links.push({
            source: rel.source_concept_id,
            target: rel.target_concept_id,
            type: rel.relationship_type
          })
        })
      }

      setGraphNodes(nodes)
      setGraphLinks(links)
      setLoading(false)
    }

    loadGraphData()
  }, [session, notes, edges])

  const getNodeColor = (node: GraphNode) => {
    if (node.isYouNode) return '#6366f1'
    if (node.isAreaNode) {
      return node.areaColor || '#C9B7F3'
    }

    if (viewMode === 'status') {
      switch (node.status) {
        case 'understood': return '#A3E4B6'
        case 'in-progress': return '#FFE9A9'
        default: return '#E6E6E6'
      }
    } else {
      return node.areaColor || '#C9B7F3'
    }
  }

  const getNodeRadius = (node: GraphNode) => {
    if (node.isYouNode) return 30
    if (node.isAreaNode) return 25
    return 18
  }

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || loading || graphNodes.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    const g = svg.append('g')

    // Create simulation
    const simulation = d3.forceSimulation(graphNodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(graphLinks)
        .id((d: any) => d.id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeRadius(d) + 10))

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', '#E6E6E6')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(graphNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }) as any)

    // Node circles
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('click', (event, d) => {
        setSelectedNode(d)
      })

    // Node labels
    node.append('text')
      .text(d => d.isYouNode ? 'Yo' : (d.name.length > 15 ? d.name.slice(0, 12) + '...' : d.name))
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d) + 16)
      .attr('fill', '#646464')
      .attr('font-size', '12px')
      .attr('font-weight', '500')

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Initial zoom to fit
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.8))

    return () => {
      simulation.stop()
    }
  }, [graphNodes, graphLinks, viewMode, loading])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Grafo de Conocimiento</h1>
          <p className="text-sm text-gray-500">Explora tus conceptos y conexiones</p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('status')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'status' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Por Estado
            </button>
            <button
              onClick={() => setViewMode('area')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'area' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Por Area
            </button>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-xl p-4 shadow-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            {viewMode === 'status' ? 'Estado' : 'Areas'}
          </h4>
          {viewMode === 'status' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#A3E4B6' }} />
                <span className="text-sm text-gray-600">Dominado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FFE9A9' }} />
                <span className="text-sm text-gray-600">En progreso</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#E6E6E6' }} />
                <span className="text-sm text-gray-600">Pendiente</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {areas.length > 0 ? areas.slice(0, 5).map(area => (
                <div key={area.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="text-sm text-gray-600">{area.name}</span>
                </div>
              )) : (
                <span className="text-sm text-gray-500">Sin areas definidas</span>
              )}
            </div>
          )}
        </div>

        {/* Selected Node Panel */}
        {selectedNode && !selectedNode.isYouNode && !selectedNode.isAreaNode && (
          <div className="absolute top-4 right-4 bg-white rounded-xl p-4 shadow-lg border border-gray-200 w-72">
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-semibold text-gray-900">{selectedNode.name}</h4>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Area:</span>
                <span className="text-gray-900">{selectedNode.area}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nivel:</span>
                <span className="text-gray-900 capitalize">{selectedNode.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado:</span>
                <span className={`capitalize ${
                  selectedNode.status === 'understood' ? 'text-green-600' :
                  selectedNode.status === 'in-progress' ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  {selectedNode.status === 'understood' ? 'Dominado' :
                   selectedNode.status === 'in-progress' ? 'En progreso' : 'Pendiente'}
                </span>
              </div>
            </div>
            <Link
              href={`/study?topic=${encodeURIComponent(selectedNode.name)}`}
              className="mt-4 w-full block text-center py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              Estudiar
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
