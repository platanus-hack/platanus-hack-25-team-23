"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { ZoomIn, ZoomOut, Maximize2, Sliders, Eye, Palette, Filter, X, ChevronDown } from "lucide-react"
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
  connectionCount?: number
  x?: number
  y?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type?: 'prerequisite' | 'related' | 'mentions'
}

interface Area {
  id: string
  name: string
  color: string
  icon: string
}

// Link type colors
const linkTypeColors = {
  prerequisite: '#6366f1',
  related: '#8b5cf6',
  mentions: '#d1d5db'
}

// Calculate distance from area node using BFS
function calculateDistanceFromArea(
  nodes: GraphNode[],
  links: GraphLink[]
): Map<string, number> {
  const distances = new Map<string, number>()
  const areaNodes = nodes.filter(n => n.isAreaNode || n.isYouNode)

  // Initialize distances
  nodes.forEach(n => distances.set(n.id, Infinity))
  areaNodes.forEach(n => distances.set(n.id, 0))

  // BFS from area nodes
  const queue = [...areaNodes.map(n => n.id)]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentDist = distances.get(currentId)!

    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id

      let neighborId: string | null = null
      if (sourceId === currentId) neighborId = targetId
      if (targetId === currentId) neighborId = sourceId

      if (neighborId && distances.get(neighborId)! > currentDist + 1) {
        distances.set(neighborId, currentDist + 1)
        queue.push(neighborId)
      }
    })
  }

  return distances
}

// Get color with alpha based on distance
function getColorWithAlpha(baseColor: string, distance: number, maxDistance: number): string {
  const alpha = Math.max(0.3, 1 - (distance / (maxDistance + 1)) * 0.5)

  // Parse hex color
  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const { notes, edges, session } = useKnowledge()
  const [viewMode, setViewMode] = useState<'status' | 'area'>('area')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [nodeSpacing, setNodeSpacing] = useState(150)
  const [sliderValue, setSliderValue] = useState(150) // Immediate slider value for UI
  const spacingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null)

  // Filter states
  const [filterArea, setFilterArea] = useState<string | null>(null)
  const [filterLevel, setFilterLevel] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Smooth spacing update - updates simulation without recreating graph
  const handleSpacingChange = useCallback((value: number) => {
    setSliderValue(value) // Update UI immediately

    // Update simulation smoothly without debounce
    if (simulationRef.current) {
      const linkForce = simulationRef.current.force('link') as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>
      if (linkForce) {
        linkForce.distance(value)
      }
      // Reheat simulation gently for smooth animation
      simulationRef.current.alpha(0.3).restart()
    }

    // Update state for persistence (debounced)
    if (spacingTimeoutRef.current) {
      clearTimeout(spacingTimeoutRef.current)
    }
    spacingTimeoutRef.current = setTimeout(() => {
      setNodeSpacing(value)
    }, 300)
  }, [])

  // Close popups when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement

      // Don't close if clicking inside the popup or on the toggle button
      const isInsideControls = controlsRef.current?.contains(target)
      const isInsideFilters = filtersRef.current?.contains(target)
      const isToggleButton = target.closest('[data-popup-toggle]')

      if (isToggleButton) return

      if (showControls && !isInsideControls) {
        setShowControls(false)
      }

      if (showFilters && !isInsideFilters) {
        setShowFilters(false)
      }
    }

    // Use click instead of mousedown to avoid race condition with button onClick
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showControls, showFilters])

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

  // Filter nodes and links based on current filters
  const { filteredNodes, filteredLinks, maxDistance } = useMemo(() => {
    let filtered = graphNodes.filter(node => {
      if (node.isYouNode) return true
      if (node.isAreaNode) {
        if (filterArea && !node.name.includes(filterArea)) return false
        return true
      }
      if (filterArea && node.area !== filterArea) return false
      if (filterLevel && node.level !== filterLevel) return false
      if (filterStatus && node.status !== filterStatus) return false
      return true
    })

    // Calculate connection counts
    const connectionCounts = new Map<string, number>()
    graphLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1)
      connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1)
    })

    // Add connection counts to nodes
    filtered = filtered.map(node => ({
      ...node,
      connectionCount: connectionCounts.get(node.id) || 0
    }))

    const filteredIds = new Set(filtered.map(n => n.id))

    // Filter links to only include those between filtered nodes
    const links = graphLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      return filteredIds.has(sourceId) && filteredIds.has(targetId)
    })

    // Calculate distances from area nodes
    const distances = calculateDistanceFromArea(filtered, links)
    const maxDist = Math.max(...Array.from(distances.values()).filter(d => d !== Infinity), 1)

    // Update nodes with distances
    filtered = filtered.map(node => ({
      ...node,
      distanceFromArea: distances.get(node.id) || 0
    }))

    return { filteredNodes: filtered, filteredLinks: links, maxDistance: maxDist }
  }, [graphNodes, graphLinks, filterArea, filterLevel, filterStatus])

  // Get connected node IDs for hovered node
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>()
    const connected = new Set<string>([hoveredNodeId])
    filteredLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      if (sourceId === hoveredNodeId) connected.add(targetId)
      if (targetId === hoveredNodeId) connected.add(sourceId)
    })
    return connected
  }, [hoveredNodeId, filteredLinks])

  // Load graph data from API
  useEffect(() => {
    async function loadGraphData() {
      console.log('📊 Graph: Loading data...', {
        hasSession: !!session?.user,
        notesCount: notes.length,
        edgesCount: edges.length,
        notesTitles: notes.map(n => n.title)
      })

      if (!session?.user) {
        // For demo mode, use notes from context
        const validNotes = notes.filter(note =>
          note.slug &&
          note.slug !== 'temp' &&
          note.title &&
          note.title !== 'Generating...'
        )

        console.log('📊 Graph: Demo mode - valid notes:', validNotes.length, validNotes.map(n => n.title))

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

        console.log('📊 Graph: Created nodes:', demoNodes.length, 'links:', demoLinks.length)

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

      // Load notes from the correct 'notes' table
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (notesError) {
        console.error('Error loading notes for graph:', notesError)
      }

      // Load edges from the correct 'edges' table
      const { data: edgesData, error: edgesError } = await supabase
        .from('edges')
        .select('*')
        .eq('user_id', session.user.id)

      if (edgesError) {
        console.error('Error loading edges for graph:', edgesError)
      }

      const nodes: GraphNode[] = [
        { id: 'you', name: 'Yo', status: 'understood', area: '', level: 'intermediate', isYouNode: true }
      ]

      // Add notes as nodes
      if (notesData && notesData.length > 0) {
        notesData.forEach(note => {
          nodes.push({
            id: note.id,
            name: note.title,
            status: (note.status === 'understood' ? 'understood' :
                    note.status === 'read' ? 'in-progress' : 'pending') as 'understood' | 'in-progress' | 'pending',
            area: 'General',
            areaColor: '#C9B7F3',
            level: 'intermediate'
          })
        })
      }

      const links: GraphLink[] = []

      // Connect all notes to the "You" node
      if (notesData && notesData.length > 0) {
        notesData.forEach(note => {
          links.push({ source: 'you', target: note.id })

          // If note has a parent, create that connection too
          if (note.parent_id) {
            links.push({
              source: note.parent_id,
              target: note.id,
              type: 'prerequisite'
            })
          }
        })
      }

      // Add edges from the edges table
      if (edgesData && edgesData.length > 0) {
        edgesData.forEach(edge => {
          // Check if both source and target exist in nodes
          const sourceExists = nodes.some(n => n.id === edge.source_id)
          const targetExists = nodes.some(n => n.id === edge.target_id)
          if (sourceExists && targetExists) {
            links.push({
              source: edge.source_id,
              target: edge.target_id,
              type: (edge.relationship === 'prerequisite' ? 'prerequisite' :
                    edge.relationship === 'related' ? 'related' : 'mentions') as 'prerequisite' | 'related' | 'mentions'
            })
          }
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
      const baseColor = (() => {
        switch (node.status) {
          case 'understood': return '#A3E4B6'
          case 'in-progress': return '#FFE9A9'
          default: return '#D1D5DB'
        }
      })()
      // Apply distance-based alpha
      return getColorWithAlpha(baseColor, node.distanceFromArea || 0, maxDistance)
    } else {
      const baseColor = node.areaColor || '#D6C9F5'
      // Apply distance-based alpha
      return getColorWithAlpha(baseColor, node.distanceFromArea || 0, maxDistance)
    }
  }

  const getNodeRadius = (node: GraphNode) => {
    if (node.isYouNode) return 32
    if (node.isAreaNode) return 26

    // Dynamic sizing based on connections (min 14, max 24)
    const connections = node.connectionCount || 0
    const baseRadius = 14
    const extraRadius = Math.min(connections * 2, 10)
    return baseRadius + extraRadius
  }

  // Get link color based on type
  const getLinkColor = (link: GraphLink) => {
    const type = link.type || 'mentions'
    return linkTypeColors[type] || linkTypeColors.mentions
  }

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || loading || filteredNodes.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Add arrow markers for different link types
    const defs = svg.append('defs')

    // Prerequisite arrow marker (indigo)
    defs.append('marker')
      .attr('id', 'arrow-prerequisite')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', linkTypeColors.prerequisite)
      .attr('d', 'M0,-5L10,0L0,5')

    // Related arrow marker (purple)
    defs.append('marker')
      .attr('id', 'arrow-related')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', linkTypeColors.related)
      .attr('d', 'M0,-5L10,0L0,5')

    // Mentions arrow marker (gray)
    defs.append('marker')
      .attr('id', 'arrow-mentions')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', linkTypeColors.mentions)
      .attr('d', 'M0,-5L10,0L0,5')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    const g = svg.append('g')

    // Deep copy nodes and links for D3 simulation
    const nodesData = filteredNodes.map(n => ({ ...n }))
    const linksData = filteredLinks.map(l => ({
      ...l,
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id
    }))

    const simulation = d3.forceSimulation(nodesData as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(linksData)
        .id((d: any) => d.id)
        .distance(sliderValue)
        .strength(0.5))
      .force('charge', d3.forceManyBody()
        .strength(-200)
        .distanceMin(50)
        .distanceMax(500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeRadius(d) + 20))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.4)

    // Store simulation ref for smooth updates
    simulationRef.current = simulation

    // Create links with arrow markers
    const link = g.append('g')
      .selectAll('line')
      .data(linksData)
      .join('line')
      .attr('stroke', (d: any) => getLinkColor(d))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d: any) => `url(#arrow-${d.type || 'mentions'})`)

    const node = g.append('g')
      .selectAll('g')
      .data(nodesData)
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

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5)
      .style('filter', 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))')
      .on('click', (event, d) => {
        setSelectedNode(d)
      })
      .on('mouseenter', function(event, d) {
        setHoveredNodeId(d.id)

        // Expand the hovered node
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', getNodeRadius(d) + 6)
          .style('filter', 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))')

        // Get connected node IDs
        const connected = new Set<string>([d.id])
        linksData.forEach(l => {
          const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id
          const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id
          if (sourceId === d.id) connected.add(targetId)
          if (targetId === d.id) connected.add(sourceId)
        })

        // Highlight connected links
        link.transition().duration(200)
          .attr('stroke-opacity', (l: any) => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id
            const targetId = typeof l.target === 'string' ? l.target : l.target.id
            return (sourceId === d.id || targetId === d.id) ? 1 : 0.1
          })
          .attr('stroke-width', (l: any) => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id
            const targetId = typeof l.target === 'string' ? l.target : l.target.id
            return (sourceId === d.id || targetId === d.id) ? 3 : 1.5
          })

        // Highlight connected nodes
        node.selectAll('circle')
          .transition()
          .duration(200)
          .attr('opacity', (n: any) => connected.has(n.id) ? 1 : 0.3)

        node.selectAll('text')
          .transition()
          .duration(200)
          .attr('opacity', (n: any) => connected.has(n.id) ? 1 : 0.3)
      })
      .on('mouseleave', function(event, d) {
        setHoveredNodeId(null)

        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', getNodeRadius(d))
          .style('filter', 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))')

        // Reset link styles
        link.transition().duration(200)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', 2)

        // Reset node opacity
        node.selectAll('circle')
          .transition()
          .duration(200)
          .attr('opacity', 1)

        node.selectAll('text')
          .transition()
          .duration(200)
          .attr('opacity', 1)
      })

    // Add text labels
    node.append('text')
      .text(d => d.isYouNode ? 'Yo' : (d.name.length > 15 ? d.name.slice(0, 12) + '...' : d.name))
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d) + 16)
      .attr('fill', '#374151')
      .attr('font-size', '11px')
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

    // Center the view initially
    svg.call(zoom.transform, d3.zoomIdentity.translate(width * 0.1, height * 0.1).scale(0.8))

    return () => {
      simulation.stop()
    }
  }, [filteredNodes, filteredLinks, viewMode, loading, maxDistance])

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
      className="flex-1 flex flex-col relative overflow-hidden h-full"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      {/* Graph Container - MUST be first for proper z-index stacking */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{
            cursor: 'grab',
            background: 'transparent'
          }}
        />
      </div>

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
          data-popup-toggle="controls"
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

        {/* Filter Toggle */}
        <button
          data-popup-toggle="filters"
          onClick={() => setShowFilters(!showFilters)}
          className="p-3 rounded-2xl hover:scale-110 transition-all relative"
          style={{
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)',
            background: showFilters ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)' : 'white'
          }}
          title="Filtros"
        >
          <Filter
            className="size-5"
            style={{ color: showFilters ? 'white' : '#646464' }}
          />
          {(filterArea || filterLevel || filterStatus) && (
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
              style={{ background: '#C9B7F3' }}
            />
          )}
        </button>
      </div>

      {/* Spacing Control Slider */}
      {showControls && (
        <div
          ref={controlsRef}
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
              value={sliderValue}
              onChange={(e) => handleSpacingChange(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #A3D4FF 0%, #A3D4FF ${((sliderValue - 50) / 250) * 100}%, #E6E6E6 ${((sliderValue - 50) / 250) * 100}%, #E6E6E6 100%)`
              }}
            />

            <div className="flex justify-between items-center">
              <span className="text-xs font-medium" style={{ color: '#646464' }}>
                Distancia: {sliderValue}px
              </span>
              <button
                onClick={() => {
                  setSliderValue(150)
                  setNodeSpacing(150)
                }}
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

      {/* Filter Panel */}
      {showFilters && (
        <div
          ref={filtersRef}
          className="absolute z-10 p-5 rounded-3xl"
          style={{
            background: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)',
            width: '300px',
            top: showControls ? '250px' : '160px',
            right: '24px'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="p-2 rounded-xl"
                style={{ backgroundColor: 'rgba(201, 183, 243, 0.2)' }}
              >
                <Filter className="size-4" style={{ color: '#9575CD' }} />
              </div>
              <h4 className="font-semibold" style={{ color: '#1E1E1E' }}>
                Filtros
              </h4>
            </div>
            {(filterArea || filterLevel || filterStatus) && (
              <button
                onClick={() => {
                  setFilterArea(null)
                  setFilterLevel(null)
                  setFilterStatus(null)
                }}
                className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
                style={{ color: '#646464' }}
              >
                <X className="size-3" />
                Limpiar
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Area Filter */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: '#646464' }}>
                Area
              </label>
              <div className="flex flex-wrap gap-2">
                {activeAreas.slice(0, 4).map(area => (
                  <button
                    key={area.id}
                    onClick={() => setFilterArea(filterArea === area.name ? null : area.name)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
                    style={{
                      background: filterArea === area.name
                        ? `linear-gradient(135deg, ${area.color} 0%, ${area.color}cc 100%)`
                        : 'rgba(0,0,0,0.05)',
                      color: filterArea === area.name ? 'white' : '#646464',
                      boxShadow: filterArea === area.name ? `0px 2px 6px ${area.color}40` : 'none'
                    }}
                  >
                    {area.icon} {area.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Level Filter */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: '#646464' }}>
                Nivel
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'beginner', label: 'Basico', color: '#22c55e' },
                  { id: 'intermediate', label: 'Intermedio', color: '#eab308' },
                  { id: 'advanced', label: 'Avanzado', color: '#ef4444' }
                ].map(level => (
                  <button
                    key={level.id}
                    onClick={() => setFilterLevel(filterLevel === level.id ? null : level.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105 flex-1"
                    style={{
                      background: filterLevel === level.id
                        ? `linear-gradient(135deg, ${level.color} 0%, ${level.color}cc 100%)`
                        : 'rgba(0,0,0,0.05)',
                      color: filterLevel === level.id ? 'white' : '#646464',
                      boxShadow: filterLevel === level.id ? `0px 2px 6px ${level.color}40` : 'none'
                    }}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: '#646464' }}>
                Estado
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'understood', label: 'Dominado', color: '#A3E4B6' },
                  { id: 'in-progress', label: 'En Progreso', color: '#FFE9A9' },
                  { id: 'pending', label: 'Pendiente', color: '#D1D5DB' }
                ].map(status => (
                  <button
                    key={status.id}
                    onClick={() => setFilterStatus(filterStatus === status.id ? null : status.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105 flex-1"
                    style={{
                      background: filterStatus === status.id
                        ? `linear-gradient(135deg, ${status.color} 0%, ${status.color}cc 100%)`
                        : 'rgba(0,0,0,0.05)',
                      color: filterStatus === status.id ? '#1E1E1E' : '#646464',
                      boxShadow: filterStatus === status.id ? `0px 2px 6px ${status.color}40` : 'none'
                    }}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Summary */}
            {(filterArea || filterLevel || filterStatus) && (
              <div
                className="pt-3 border-t text-xs"
                style={{ borderColor: '#E6E6E6', color: '#646464' }}
              >
                <span className="font-medium">Mostrando:</span>{' '}
                {filteredNodes.length} de {graphNodes.length} nodos
              </div>
            )}
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
