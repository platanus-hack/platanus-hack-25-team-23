"use client"

import { useEffect, useRef, useState } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { ZoomIn, ZoomOut, Maximize2, Sliders, Eye, Palette } from "lucide-react"
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
  distanceFromArea?: number
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
  const [showControls, setShowControls] = useState(false)
  const [nodeSpacing, setNodeSpacing] = useState(150)

  // Default areas
  const defaultAreas: Area[] = [
    { id: 'desarrollo-profesional', name: 'Desarrollo Profesional', color: '#3b82f6', icon: '💼' },
    { id: 'salud-bienestar', name: 'Salud y Bienestar', color: '#22c55e', icon: '🏃' },
    { id: 'finanzas', name: 'Finanzas Personales', color: '#eab308', icon: '💰' },
    { id: 'relaciones', name: 'Relaciones y Familia', color: '#ec4899', icon: '❤️' },
    { id: 'hobbies', name: 'Hobbies y Creatividad', color: '#8b5cf6', icon: '🎨' },
    { id: 'educacion', name: 'Educación Continua', color: '#f97316', icon: '📚' },
    { id: 'crecimiento-personal', name: 'Crecimiento Personal', color: '#9333ea', icon: '🌱' },
  ]

  const activeAreas = areas.length > 0 ? areas : defaultAreas

  // Load graph data from API
  useEffect(() => {
    async function loadGraphData() {
      if (!session?.user) {
        // For demo mode, use notes from context
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

        const demoLinks: GraphLink[] = validNotes.map(note => ({
          source: 'you',
          target: note.slug
        }))

        edges.forEach(edge => {
          const sourceExists = demoNodes.some(n => n.id === edge.source)
          const targetExists = demoNodes.some(n => n.id === edge.target)
          if (sourceExists && targetExists) {
            demoLinks.push({
              source: edge.source,
              target: edge.target
            })
          }
        })

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

        setGraphNodes(demoNodes)
        setGraphLinks(demoLinks)
        setLoading(false)
        return
      }

      const supabase = createClient()

      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)

      if (areasData) {
        setAreas(areasData)
      }

      const { data: concepts } = await supabase
        .from('concepts')
        .select('*, areas(name, color)')
        .eq('user_id', session.user.id)

      const { data: relationships } = await supabase
        .from('concept_relationships')
        .select('*')
        .eq('user_id', session.user.id)

      const nodes: GraphNode[] = [
        { id: 'you', name: 'Yo', status: 'understood', area: '', level: 'intermediate', isYouNode: true }
      ]

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

      const links: GraphLink[] = []

      if (areasData) {
        areasData.forEach(area => {
          links.push({ source: 'you', target: `area-${area.id}` })
        })
      }

      if (concepts) {
        concepts.forEach(concept => {
          if (concept.area_id) {
            links.push({ source: `area-${concept.area_id}`, target: concept.id })
          }
        })
      }

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
    if (node.isYouNode) return '#C9B7F3'
    if (node.isAreaNode) {
      return node.areaColor || '#D6C9F5'
    }

    if (viewMode === 'status') {
      switch (node.status) {
        case 'understood': return '#A3E4B6'
        case 'in-progress': return '#FFE9A9'
        default: return '#D1D5DB'
      }
    } else {
      return node.areaColor || '#D6C9F5'
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

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    const g = svg.append('g')

    const simulation = d3.forceSimulation(graphNodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(graphLinks)
        .id((d: any) => d.id)
        .distance(nodeSpacing))
      .force('charge', d3.forceManyBody().strength(-(nodeSpacing * 5)))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeRadius(d) + 10))

    const link = g.append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', '#E6E6E6')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.7)

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

    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5)
      .on('click', (event, d) => {
        setSelectedNode(d)
      })
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', getNodeRadius(d) + 5)

        link.attr('stroke-opacity', (l: any) => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id
          const targetId = typeof l.target === 'string' ? l.target : l.target.id
          return (sourceId === d.id || targetId === d.id) ? 1 : 0.2
        })
      })
      .on('mouseleave', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', getNodeRadius(d))

        link.attr('stroke-opacity', 0.7)
      })

    node.append('text')
      .text(d => d.isYouNode ? 'Yo' : (d.name.length > 15 ? d.name.slice(0, 12) + '...' : d.name))
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d) + 16)
      .attr('fill', '#374151')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')
      .style('user-select', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.8))

    return () => {
      simulation.stop()
    }
  }, [graphNodes, graphLinks, viewMode, loading, nodeSpacing])

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().call(d3.zoom().scaleBy as any, 1.3)
  }

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().call(d3.zoom().scaleBy as any, 0.7)
  }

  const handleResetView = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().call(d3.zoom().transform as any, d3.zoomIdentity)
  }

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      {/* View Mode Toggle - Centered at top */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10">
        <div
          className="p-2 rounded-3xl flex gap-2"
          style={{
            background: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)'
          }}
        >
          <button
            onClick={() => setViewMode('status')}
            className="px-5 py-3 rounded-2xl transition-all flex items-center gap-2 font-medium"
            style={{
              background: viewMode === 'status'
                ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
                : 'transparent',
              color: viewMode === 'status' ? 'white' : '#646464',
              boxShadow: viewMode === 'status' ? '0px 2px 8px rgba(201, 183, 243, 0.3)' : 'none'
            }}
          >
            <Eye className="size-4" />
            <span className="text-sm">Vista por Estado</span>
          </button>
          <button
            onClick={() => setViewMode('area')}
            className="px-5 py-3 rounded-2xl transition-all flex items-center gap-2 font-medium"
            style={{
              background: viewMode === 'area'
                ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
                : 'transparent',
              color: viewMode === 'area' ? 'white' : '#646464',
              boxShadow: viewMode === 'area' ? '0px 2px 8px rgba(201, 183, 243, 0.3)' : 'none'
            }}
          >
            <Palette className="size-4" />
            <span className="text-sm">Vista por Area</span>
          </button>
        </div>
      </div>

      {/* Zoom Controls - Right side */}
      <div className="absolute top-6 right-6 z-10 flex flex-col gap-3">
        <button
          onClick={handleZoomIn}
          className="p-3 bg-white rounded-2xl hover:scale-110 transition-all"
          style={{ boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)' }}
          title="Zoom In"
        >
          <ZoomIn className="size-5" style={{ color: '#646464' }} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-3 bg-white rounded-2xl hover:scale-110 transition-all"
          style={{ boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)' }}
          title="Zoom Out"
        >
          <ZoomOut className="size-5" style={{ color: '#646464' }} />
        </button>
        <button
          onClick={handleResetView}
          className="p-3 bg-white rounded-2xl hover:scale-110 transition-all"
          style={{ boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)' }}
          title="Reset View"
        >
          <Maximize2 className="size-5" style={{ color: '#646464' }} />
        </button>

        {/* Spacing Control Toggle */}
        <button
          onClick={() => setShowControls(!showControls)}
          className="p-3 rounded-2xl hover:scale-110 transition-all"
          style={{
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)',
            background: showControls ? 'linear-gradient(135deg, #A3D4FF 0%, #CADFFF 100%)' : 'white'
          }}
          title="Ajustar Espaciado"
        >
          <Sliders
            className="size-5"
            style={{ color: showControls ? 'white' : '#646464' }}
          />
        </button>
      </div>

      {/* Spacing Control Slider */}
      {showControls && (
        <div
          className="absolute top-28 right-6 z-10 p-5 rounded-3xl"
          style={{
            background: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)',
            width: '280px'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: 'rgba(163, 212, 255, 0.2)' }}
            >
              <Sliders className="size-4" style={{ color: '#5A8FCC' }} />
            </div>
            <h4 className="font-semibold" style={{ color: '#1E1E1E' }}>
              Espaciado de Nodos
            </h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs mb-2" style={{ color: '#646464' }}>
              <span>Pegados</span>
              <span>Dispersos</span>
            </div>

            <input
              type="range"
              min="50"
              max="300"
              step="10"
              value={nodeSpacing}
              onChange={(e) => setNodeSpacing(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #A3D4FF 0%, #A3D4FF ${((nodeSpacing - 50) / 250) * 100}%, #E6E6E6 ${((nodeSpacing - 50) / 250) * 100}%, #E6E6E6 100%)`
              }}
            />

            <div className="flex justify-between items-center">
              <span className="text-xs font-medium" style={{ color: '#646464' }}>
                Distancia: {nodeSpacing}px
              </span>
              <button
                onClick={() => setNodeSpacing(150)}
                className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #A3D4FF 0%, #CADFFF 100%)',
                  color: 'white',
                  boxShadow: '0px 2px 6px rgba(163, 212, 255, 0.3)'
                }}
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Legend - Left side */}
      <div
        className="absolute top-6 left-6 z-10 p-5 rounded-3xl"
        style={{
          background: 'white',
          boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)',
          maxWidth: '280px'
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="p-2 rounded-xl"
            style={{
              backgroundColor: viewMode === 'status'
                ? 'rgba(201, 183, 243, 0.2)'
                : 'rgba(163, 212, 255, 0.2)'
            }}
          >
            {viewMode === 'status' ? (
              <Eye className="size-4" style={{ color: '#9575CD' }} />
            ) : (
              <Palette className="size-4" style={{ color: '#5A8FCC' }} />
            )}
          </div>
          <h3 className="font-semibold" style={{ color: '#1E1E1E' }}>
            {viewMode === 'status' ? 'Estados' : 'Areas de Conocimiento'}
          </h3>
        </div>

        {viewMode === 'status' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #A3E4B6 0%, #B9E2B1 100%)',
                  boxShadow: '0px 2px 6px rgba(163, 228, 182, 0.3)'
                }}
              />
              <span className="text-sm font-medium" style={{ color: '#1E1E1E' }}>
                Entendido
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #FFE9A9 0%, #FFF4D4 100%)',
                  boxShadow: '0px 2px 6px rgba(255, 233, 169, 0.3)'
                }}
              />
              <span className="text-sm font-medium" style={{ color: '#1E1E1E' }}>
                En progreso
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #D1D5DB 0%, #E5E7EB 100%)',
                  boxShadow: '0px 2px 6px rgba(209, 213, 219, 0.3)'
                }}
              />
              <span className="text-sm font-medium" style={{ color: '#1E1E1E' }}>
                Pendiente
              </span>
            </div>

            <div
              className="border-t pt-3 mt-3"
              style={{ borderColor: '#E6E6E6' }}
            >
              <p className="text-xs mb-2 font-medium" style={{ color: '#646464' }}>
                Tipos de Conexion
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#6366f1' }} />
                  <span className="text-xs" style={{ color: '#646464' }}>Prerrequisito</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#8b5cf6' }} />
                  <span className="text-xs" style={{ color: '#646464' }}>Relacionado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#d1d5db' }} />
                  <span className="text-xs" style={{ color: '#646464' }}>Menciona</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAreas.slice(0, 5).map((area) => (
              <div key={area.id} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{
                    backgroundColor: area.color,
                    boxShadow: `0px 2px 6px ${area.color}50`
                  }}
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-base">{area.icon}</span>
                  <span className="text-xs font-medium" style={{ color: '#1E1E1E' }}>
                    {area.name}
                  </span>
                </div>
              </div>
            ))}
            {activeAreas.length > 5 && (
              <div className="text-xs text-center pt-2" style={{ color: '#646464' }}>
                +{activeAreas.length - 5} areas mas
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions Panel - Bottom left */}
      <div
        className="absolute bottom-6 left-6 z-10 p-5 rounded-3xl max-w-xs"
        style={{
          background: 'linear-gradient(135deg, #D6C9F5 0%, #E6DEF9 100%)',
          boxShadow: '0px 4px 14px rgba(214, 201, 245, 0.3)'
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: '#1E1E1E' }}>
              Como navegar?
            </p>
            <p className="text-xs" style={{ color: 'rgba(30, 30, 30, 0.7)' }}>
              <strong>Arrastra</strong> los nodos • <strong>Rueda del mouse</strong> para zoom • <strong>Click</strong> para ver contenido
            </p>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" style={{ cursor: 'grab' }} />
      </div>

      {/* Selected Node Panel - Right side */}
      {selectedNode && !selectedNode.isYouNode && !selectedNode.isAreaNode && (
        <div
          className="absolute bottom-6 right-6 z-10 p-5 rounded-3xl w-72"
          style={{
            background: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <h4 className="font-semibold" style={{ color: '#1E1E1E' }}>{selectedNode.name}</h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:scale-110"
              style={{ backgroundColor: '#E6E6E6', color: '#646464' }}
            >
              ×
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: '#646464' }}>Area:</span>
              <span style={{ color: '#1E1E1E' }}>{selectedNode.area}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#646464' }}>Nivel:</span>
              <span className="capitalize" style={{ color: '#1E1E1E' }}>{selectedNode.level}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#646464' }}>Estado:</span>
              <span className="capitalize" style={{
                color: selectedNode.status === 'understood' ? '#22c55e' :
                       selectedNode.status === 'in-progress' ? '#eab308' :
                       '#646464'
              }}>
                {selectedNode.status === 'understood' ? 'Dominado' :
                 selectedNode.status === 'in-progress' ? 'En progreso' : 'Pendiente'}
              </span>
            </div>
          </div>
          <Link
            href={`/study?topic=${encodeURIComponent(selectedNode.name)}`}
            className="mt-4 w-full block text-center py-3 rounded-2xl font-medium transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              color: 'white',
              boxShadow: '0px 2px 8px rgba(201, 183, 243, 0.3)'
            }}
          >
            Estudiar
          </Link>
        </div>
      )}
    </div>
  )
}
