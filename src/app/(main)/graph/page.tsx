"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { useJournal } from "@/lib/store/journal-context"
import { createClient } from "@/lib/supabase/client"
import { ZoomIn, ZoomOut, Maximize2, Sliders, Eye, Palette, Filter, X, ChevronDown, ChevronUp, Minimize2 } from "lucide-react"
import * as d3 from 'd3'
import Link from 'next/link'
import { DEFAULT_AREAS, detectAreaFromContent } from '@/lib/data/areas-config'
import { useAreas } from '@/lib/store/areas-context'
import { SplitLayout } from '@/components/layout/split-layout'
import { SidePanel } from '@/components/features/side-panel'

interface GraphNode {
  id: string
  name: string
  status: 'understood' | 'in-progress' | 'pending'
  area: string
  areaColor?: string
  level: 'beginner' | 'intermediate' | 'advanced'
  isYouNode?: boolean
  isAreaNode?: boolean
  isJournalNode?: boolean
  journalDate?: string // For journal nodes: YYYY-MM-DD format
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
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const { notes, edges, session } = useKnowledge()
  const { entries: journalEntries } = useJournal()
  const { areas: contextAreas, youNodeColor, getColorForDepth } = useAreas()
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

  // Legend and fullscreen states
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Node size scale state
  const [nodeScale, setNodeScale] = useState(1)
  const [nodeScaleSlider, setNodeScaleSlider] = useState(1)
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const nodeScaleRef = useRef(1)

  // Track if graph has been initialized to prevent flickering
  const graphInitializedRef = useRef(false)
  const [graphReady, setGraphReady] = useState(false)

  // Reset initialization state when component remounts
  useEffect(() => {
    graphInitializedRef.current = false
    setGraphReady(false)
    return () => {
      graphInitializedRef.current = false
    }
  }, [])

  // Smooth node scale update - updates nodes without recreating graph
  const handleNodeScaleChange = useCallback((value: number) => {
    setNodeScaleSlider(value) // Update UI immediately
    nodeScaleRef.current = value

    // Update node circles smoothly with D3 transition
    if (nodeSelectionRef.current) {
      nodeSelectionRef.current.selectAll('circle')
        .transition()
        .duration(150)
        .attr('r', (d: any) => {
          let baseSize: number
          if (d.isYouNode) {
            baseSize = 32
          } else if (d.isAreaNode) {
            baseSize = 26
          } else {
            const connections = d.connectionCount || 0
            const baseRadius = 14
            const extraRadius = Math.min(connections * 2, 10)
            baseSize = baseRadius + extraRadius
          }
          return baseSize * value
        })

      // Also update text position
      nodeSelectionRef.current.selectAll('text')
        .transition()
        .duration(150)
        .attr('dy', (d: any) => {
          let baseSize: number
          if (d.isYouNode) {
            baseSize = 32
          } else if (d.isAreaNode) {
            baseSize = 26
          } else {
            const connections = d.connectionCount || 0
            const baseRadius = 14
            const extraRadius = Math.min(connections * 2, 10)
            baseSize = baseRadius + extraRadius
          }
          return (baseSize * value) + 16
        })

      // Update collision force
      if (simulationRef.current) {
        const collisionForce = simulationRef.current.force('collision') as d3.ForceCollide<d3.SimulationNodeDatum>
        if (collisionForce) {
          collisionForce.radius((d: any) => {
            let baseSize: number
            if (d.isYouNode) {
              baseSize = 32
            } else if (d.isAreaNode) {
              baseSize = 26
            } else {
              const connections = d.connectionCount || 0
              const baseRadius = 14
              const extraRadius = Math.min(connections * 2, 10)
              baseSize = baseRadius + extraRadius
            }
            return (baseSize * value) + 20
          })
        }
        simulationRef.current.alpha(0.1).restart()
      }
    }

    // Update state for persistence (debounced)
    if (spacingTimeoutRef.current) {
      clearTimeout(spacingTimeoutRef.current)
    }
    spacingTimeoutRef.current = setTimeout(() => {
      setNodeScale(value)
    }, 300)
  }, [])

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

  // Default areas - use context areas (which use shared config as default)
  const defaultAreas: Area[] = contextAreas.map(area => ({
    id: area.id,
    name: area.name,
    color: area.color,
    icon: area.icon
  }))

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

        // Create nodes: Yo + Area nodes + Note nodes
        const demoNodes: GraphNode[] = [
          { id: 'you', name: 'Yo', status: 'understood', area: '', level: 'intermediate', isYouNode: true }
        ]

        // Add ALL area nodes from context (synced with area manager)
        contextAreas.forEach(area => {
          demoNodes.push({
            id: `area-${area.id}`,
            name: area.name,
            status: 'understood',
            area: area.name,
            areaColor: area.color,
            level: 'intermediate',
            isAreaNode: true
          })
        })

        // Add note nodes with detected area
        validNotes.forEach(note => {
          const detectedArea = detectAreaFromContent(note.title, note.content)
          const areaName = detectedArea?.name || 'General'
          const areaColor = detectedArea?.color || '#C9B7F3'

          demoNodes.push({
            id: note.slug,
            name: note.title,
            status: (note.status === 'understood' ? 'understood' :
                    note.status === 'read' ? 'in-progress' : 'pending') as 'understood' | 'in-progress' | 'pending',
            area: areaName,
            areaColor: areaColor,
            level: 'intermediate' as const,
          })
        })

        // Create links: Yo -> Areas, Areas -> Notes
        const demoLinks: GraphLink[] = []

        // Connect all areas to "Yo"
        contextAreas.forEach(area => {
          demoLinks.push({
            source: 'you',
            target: `area-${area.id}`,
            type: 'related'
          })
        })

        // Connect notes to their detected area (or to first area if no area found)
        validNotes.forEach(note => {
          const detectedArea = detectAreaFromContent(note.title, note.content)
          if (detectedArea) {
            // Connect to area node
            demoLinks.push({
              source: `area-${detectedArea.id}`,
              target: note.slug,
              type: 'related'
            })
          } else if (contextAreas.length > 0) {
            // Connect to first area if no area detected (no "General")
            demoLinks.push({
              source: `area-${contextAreas[0].id}`,
              target: note.slug,
              type: 'related'
            })
          }
        })

        console.log('📊 Graph: Created nodes:', demoNodes.length, 'links:', demoLinks.length)

        // Add edges from context
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

        // Add linked terms connections
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
        .order('created_at', { ascending: false })

      if (edgesError) {
        console.error('Error loading edges for graph:', edgesError)
      }

      // Create nodes: Yo + Area nodes + Note nodes
      const nodes: GraphNode[] = [
        { id: 'you', name: 'Yo', status: 'understood', area: '', level: 'intermediate', isYouNode: true }
      ]

      // Add ALL area nodes from context (synced with area manager)
      contextAreas.forEach(area => {
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

      // Add notes as nodes with detected area
      if (notesData && notesData.length > 0) {
        notesData.forEach(note => {
          const detectedArea = detectAreaFromContent(note.title, note.content || '')
          const areaName = detectedArea?.name || 'General'
          const areaColor = detectedArea?.color || '#C9B7F3'

          nodes.push({
            id: note.id,
            name: note.title,
            status: (note.status === 'understood' ? 'understood' :
                    note.status === 'read' ? 'in-progress' : 'pending') as 'understood' | 'in-progress' | 'pending',
            area: areaName,
            areaColor: areaColor,
            level: 'intermediate'
          })
        })
      }

      // Add Journal area node if there are journal entries
      if (journalEntries.length > 0) {
        nodes.push({
          id: 'area-journal',
          name: 'Journal',
          status: 'understood',
          area: 'Journal',
          areaColor: '#C9B7F3',
          level: 'intermediate',
          isAreaNode: true
        })

        // Add journal entries as nodes
        journalEntries.forEach(entry => {
          const entryDate = new Date(entry.date + 'T00:00:00')
          const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

          nodes.push({
            id: `journal-${entry.id}`,
            name: `${dayNames[entryDate.getDay()]} ${entryDate.getDate()} ${monthNames[entryDate.getMonth()]}`,
            status: entry.is_complete ? 'understood' : 'pending',
            area: 'Journal',
            areaColor: '#C9B7F3',
            level: 'beginner',
            isJournalNode: true,
            journalDate: entry.date // Store the date for navigation
          })
        })
      }

      const links: GraphLink[] = []

      // Connect all areas to "Yo"
      contextAreas.forEach(area => {
        links.push({
          source: 'you',
          target: `area-${area.id}`,
          type: 'related'
        })
      })

      // Connect notes to their detected area (or to first area if no area found)
      if (notesData && notesData.length > 0) {
        notesData.forEach(note => {
          const detectedArea = detectAreaFromContent(note.title, note.content || '')

          if (detectedArea) {
            // Connect to area node
            links.push({
              source: `area-${detectedArea.id}`,
              target: note.id,
              type: 'related'
            })
          } else if (contextAreas.length > 0) {
            // Connect to first area if no area detected (no "General")
            links.push({
              source: `area-${contextAreas[0].id}`,
              target: note.id,
              type: 'related'
            })
          }

          // If note has a parent, create that connection too (for hierarchy)
          if (note.parent_id) {
            links.push({
              source: note.parent_id,
              target: note.id,
              type: 'prerequisite'
            })
          }
        })
      }

      // Connect Journal area to "Yo" and journal entries to Journal area
      if (journalEntries.length > 0) {
        // Connect Journal area to Yo
        links.push({
          source: 'you',
          target: 'area-journal',
          type: 'related'
        })

        // Connect each journal entry to Journal area
        journalEntries.forEach(entry => {
          links.push({
            source: 'area-journal',
            target: `journal-${entry.id}`,
            type: 'related'
          })
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
  }, [session, notes, edges, contextAreas, journalEntries])

  const getNodeColor = (node: GraphNode) => {
    // Central "Yo" node always uses color from context
    if (node.isYouNode) return youNodeColor

    if (viewMode === 'status') {
      // In STATUS VIEW: ALL nodes (including areas) show status colors
      // Only Yo node keeps its own color
      // Status colors - pastel versions matching our design
      const baseColor = (() => {
        switch (node.status) {
          case 'understood': return '#86EFAC' // Pastel green (matching our palette)
          case 'in-progress': return '#FDE047' // Pastel yellow/amber
          default: return '#D1D5DB' // Light gray for pending
        }
      })()
      return baseColor
    } else {
      // In AREA VIEW: Area nodes use solid color, notes use hierarchy
      if (node.isAreaNode) {
        return node.areaColor || '#D6C9F5'
      }
      const baseColor = node.areaColor || '#D6C9F5'
      // Apply distance-based color hierarchy
      // Distance 0 = Area (solid), 1 = Topic, 2 = Subtopic, 3+ = Notes
      const depth = Math.min(node.distanceFromArea || 1, 3)
      return getColorForDepth(baseColor, depth)
    }
  }

  const getNodeRadius = (node: GraphNode) => {
    let baseSize: number
    if (node.isYouNode) {
      baseSize = 32
    } else if (node.isAreaNode) {
      baseSize = 26
    } else {
      // Dynamic sizing based on connections (min 14, max 24)
      const connections = node.connectionCount || 0
      const baseRadius = 14
      const extraRadius = Math.min(connections * 2, 10)
      baseSize = baseRadius + extraRadius
    }
    // Apply scale factor
    return baseSize * nodeScale
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

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove()

    // Hide graph during setup to prevent flicker
    if (!graphInitializedRef.current) {
      d3.select(svgRef.current).style('opacity', 0)
    }

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
    zoomRef.current = zoom

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
    // Reset node scale ref to current value
    nodeScaleRef.current = nodeScale

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
      .selectAll<SVGGElement, GraphNode>('g')
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

    // Store node selection ref for smooth updates
    nodeSelectionRef.current = node as any

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5)
      .style('filter', 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))')
      .on('click', (event, d) => {
        // If it's a journal node, redirect to the journal page with the date
        if (d.isJournalNode && d.journalDate) {
          router.push(`/journal?date=${d.journalDate}`)
          return
        }
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

    // Fade in the graph smoothly after setup
    if (!graphInitializedRef.current) {
      svg.transition()
        .duration(400)
        .style('opacity', 1)
      graphInitializedRef.current = true
      setGraphReady(true)
    }

    return () => {
      simulation.stop()
    }
  }, [filteredNodes, filteredLinks, viewMode, loading, maxDistance])

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.5)
  }

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 0.67)
  }

  const handleResetView = () => {
    if (!svgRef.current || !zoomRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity)
  }

  const handleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <SplitLayout
      leftPanel={<SidePanel />}
      rightPanel={
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-background">
          {/* Controls */}
          <div className="absolute top-6 right-6 flex flex-col gap-3 z-10">
            {/* View Mode Toggle */}
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl p-1 shadow-sm flex">
              <button
                onClick={() => setViewMode('area')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'area' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="Vista por Áreas"
              >
                <Palette className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('status')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'status' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="Vista por Estado"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl p-1 shadow-sm flex flex-col">
              <button
                onClick={() => {
                  if (zoomRef.current && svgRef.current) {
                    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.2)
                  }
                }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Acercar"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (zoomRef.current && svgRef.current) {
                    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.8)
                  }
                }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Alejar"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (zoomRef.current && svgRef.current) {
                    d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity)
                  }
                }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Resetear Vista"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Toggle */}
            <button
              data-popup-toggle
              onClick={() => setShowControls(!showControls)}
              className={`p-3 rounded-xl border shadow-sm transition-all ${showControls ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/90 backdrop-blur-sm border-border text-muted-foreground hover:text-foreground'}`}
              title="Configuración del Grafo"
            >
              <Sliders className="w-5 h-5" />
            </button>

            {/* Filters Toggle */}
            <button
              data-popup-toggle
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-xl border shadow-sm transition-all ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/90 backdrop-blur-sm border-border text-muted-foreground hover:text-foreground'}`}
              title="Filtros"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Settings Popup */}
          {showControls && (
            <div
              ref={controlsRef}
              className="absolute top-6 right-20 w-72 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-xl p-5 z-20 animate-in fade-in slide-in-from-right-4 duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Configuración</h3>
                <button onClick={() => setShowControls(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Espaciado</span>
                    <span className="font-mono text-foreground">{sliderValue}px</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    value={sliderValue}
                    onChange={(e) => handleSpacingChange(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-muted rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tamaño de Nodos</span>
                    <span className="font-mono text-foreground">{nodeScaleSlider.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={nodeScaleSlider}
                    onChange={(e) => handleNodeScaleChange(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-muted rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filters Popup */}
          {showFilters && (
            <div
              ref={filtersRef}
              className="absolute top-20 right-20 w-72 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-xl p-5 z-20 animate-in fade-in slide-in-from-right-4 duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Filtros</h3>
                <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Área</label>
                  <select
                    className="w-full bg-muted/50 border border-border rounded-lg p-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    value={filterArea || ''}
                    onChange={(e) => setFilterArea(e.target.value || null)}
                  >
                    <option value="">Todas</option>
                    {activeAreas.map(area => (
                      <option key={area.id} value={area.name}>{area.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
                  <select
                    className="w-full bg-muted/50 border border-border rounded-lg p-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    value={filterStatus || ''}
                    onChange={(e) => setFilterStatus(e.target.value || null)}
                  >
                    <option value="">Todos</option>
                    <option value="understood">Dominado</option>
                    <option value="in-progress">En Progreso</option>
                    <option value="pending">Pendiente</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Legend - Collapsible */}
          <div className={`absolute bottom-6 right-6 bg-card/90 backdrop-blur-sm border border-border rounded-2xl shadow-sm transition-all duration-300 z-10 overflow-hidden ${legendCollapsed ? 'w-12 h-12 p-0 flex items-center justify-center cursor-pointer hover:bg-muted/50' : 'p-5 min-w-[200px]'}`}>
            {legendCollapsed ? (
              <button onClick={() => setLegendCollapsed(false)} className="w-full h-full flex items-center justify-center text-muted-foreground">
                <ChevronUp className="w-5 h-5" />
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-foreground">Leyenda</h3>
                  <button onClick={() => setLegendCollapsed(true)} className="text-muted-foreground hover:text-foreground">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">Nodo Central (Yo)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#C9B7F3]" />
                    <span className="text-xs text-muted-foreground">Área / Tema Principal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#E6DAFF]" />
                    <span className="text-xs text-muted-foreground">Nota / Concepto</span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-[#6366f1]" />
                    <span className="text-xs text-muted-foreground">Prerrequisito</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-[#8b5cf6]" />
                    <span className="text-xs text-muted-foreground">Relacionado</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-primary/10 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className="text-muted-foreground font-medium animate-pulse">Cargando grafo...</p>
              </div>
            </div>
          )}

          {/* How to navigate */}
          <div
            className="absolute bottom-6 left-6 z-10 p-4 rounded-2xl"
            style={{
              backgroundColor: '#FFF0E6',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FFD9D9' }}
              >
                <span className="text-sm">💡</span>
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: '#222222' }}>
                  Como navegar?
                </p>
                <p className="text-xs" style={{ color: '#6D6D6D' }}>
                  <strong>Arrastra</strong> los nodos • <strong>Rueda</strong> para zoom • <strong>Click</strong> para ver contenido
                </p>
              </div>
            </div>
          </div>

          {/* Selected Node Panel - Right side */}
          {selectedNode && !selectedNode.isYouNode && !selectedNode.isAreaNode && (
            <div
              className="absolute bottom-6 right-6 z-10 p-5 rounded-2xl w-72"
              style={{
                backgroundColor: 'white',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <h4 className="font-semibold" style={{ color: '#222222' }}>{selectedNode.name}</h4>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:scale-105"
                  style={{ backgroundColor: '#F6F5F2', color: '#6D6D6D' }}
                >
                  ×
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#6D6D6D' }}>Area:</span>
                  <span style={{ color: '#222222' }}>{selectedNode.area}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#6D6D6D' }}>Nivel:</span>
                  <span className="capitalize" style={{ color: '#222222' }}>{selectedNode.level}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#6D6D6D' }}>Estado:</span>
                  <span className="capitalize" style={{
                    color: selectedNode.status === 'understood' ? '#10B981' :
                           selectedNode.status === 'in-progress' ? '#F59E0B' :
                           '#6D6D6D'
                  }}>
                    {selectedNode.status === 'understood' ? 'Dominado' :
                     selectedNode.status === 'in-progress' ? 'En progreso' : 'Pendiente'}
                  </span>
                </div>
              </div>
              <Link
                href={`/study?topic=${encodeURIComponent(selectedNode.name)}`}
                className="mt-4 w-full block text-center py-3 rounded-xl font-medium transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222'
                }}
              >
                Estudiar
              </Link>
            </div>
          )}

          {/* SVG Container */}
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            style={{ opacity: graphReady ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }}
          />
        </div>
      }
    />
  )
}
