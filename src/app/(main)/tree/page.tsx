"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { useJournal, JournalEntry } from "@/lib/store/journal-context"
import { useAreas } from "@/lib/store/areas-context"
import { detectAreaFromContent } from "@/lib/data/areas-config"
import { createClient } from "@/lib/supabase/client"
import {
  ChevronRight,
  ChevronDown,
  Check,
  Circle,
  Clock,
  Zap,
  Target,
  TrendingUp,
  Filter,
  LayoutGrid,
  LayoutList,
  Award,
  BookOpen,
  Sparkles,
  MapPin,
  GitBranch,
  Calendar,
  BookHeart
} from "lucide-react"
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface RoadmapNode {
  id: string
  name: string
  status: 'understood' | 'read' | 'new'
  area: string
  areaColor: string
  level: 'basic' | 'intermediate' | 'advanced'
  estimatedHours: number
  difficulty: number
  isJournalEntry?: boolean
  journalDate?: string
}

interface Area {
  id: string
  name: string
  color: string
  icon: string
  description: string
}

type ViewMode = 'timeline' | 'parallel' | 'compact'

export default function TreePage() {
  const { notes: contextNotes, session, markAsUnderstood } = useKnowledge()
  const { entries: journalEntries } = useJournal()
  const { areas: contextAreas } = useAreas()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedArea, setSelectedArea] = useState<string>('all')
  const [showCompleted, setShowCompleted] = useState(true)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(true)

  // Build AREA_CONFIG from context areas (synced with Library and Graph)
  const AREA_CONFIG: Record<string, { color: string; icon: string; description: string }> = useMemo(() => {
    const config: Record<string, { color: string; icon: string; description: string }> = {}
    contextAreas.forEach(area => {
      config[area.name] = { color: area.color, icon: area.icon, description: area.description }
    })
    // Add Journal area
    config['Journal'] = { color: '#C9B7F3', icon: '📓', description: 'Tu diario personal' }
    return config
  }, [contextAreas])

  // Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true)

      let nodes: RoadmapNode[] = []

      if (!session?.user) {
        // Use context notes
        nodes = contextNotes.map(note => {
          const detectedArea = detectAreaFromContent(note.title, note.content)
          const areaName = detectedArea?.name || 'General'
          return {
            id: note.id || note.slug,
            name: note.title,
            status: note.status,
            area: areaName,
            areaColor: detectedArea?.color || '#C9B7F3',
            level: 'intermediate' as const,
            estimatedHours: Math.ceil(note.content.split(/\s+/).length / 200),
            difficulty: 3
          }
        })
      } else {
        const supabase = createClient()
        const { data: notesData } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true })

        if (notesData) {
          nodes = notesData.map(n => {
            const detectedArea = detectAreaFromContent(n.title, n.content || '')
            const areaName = detectedArea?.name || 'General'
            return {
              id: n.id,
              name: n.title,
              status: (n.status || 'new') as 'understood' | 'read' | 'new',
              area: areaName,
              areaColor: detectedArea?.color || '#C9B7F3',
              level: 'intermediate' as const,
              estimatedHours: Math.ceil((n.content || '').split(/\s+/).length / 200),
              difficulty: 3
            }
          })
        }
      }

      // Add Journal entries as nodes
      if (journalEntries.length > 0) {
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

        journalEntries.forEach(entry => {
          const entryDate = new Date(entry.date + 'T00:00:00')
          nodes.push({
            id: `journal-${entry.id}`,
            name: `${dayNames[entryDate.getDay()]} ${entryDate.getDate()} ${monthNames[entryDate.getMonth()]} ${entryDate.getFullYear()}`,
            status: entry.is_complete ? 'understood' : 'new',
            area: 'Journal',
            areaColor: '#C9B7F3',
            level: 'basic' as const,
            estimatedHours: 0.5,
            difficulty: 1,
            isJournalEntry: true,
            journalDate: entry.date
          })
        })
      }

      setRoadmapNodes(nodes)
      // Expand first area
      if (nodes.length > 0) {
        setExpandedPaths(new Set([nodes[0].area.toLowerCase().replace(/\s+/g, '-')]))
      }
      setLoading(false)
    }
    loadData()
  }, [session, contextNotes, journalEntries])

  // Get ALL areas from context (synced with Library and Graph)
  // Plus Journal area if there are journal entries
  const areas: Area[] = useMemo(() => {
    const areasFromContext = contextAreas.map(area => ({
      id: area.id,
      name: area.name,
      color: area.color,
      icon: area.icon,
      description: area.description
    }))

    // Add Journal area if there are journal entries
    if (journalEntries.length > 0) {
      areasFromContext.push({
        id: 'journal',
        name: 'Journal',
        color: '#C9B7F3',
        icon: '📓',
        description: 'Tu diario personal'
      })
    }

    return areasFromContext
  }, [contextAreas, journalEntries])

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return roadmapNodes.filter(node => {
      if (!showCompleted && node.status === 'understood') return false
      if (selectedArea !== 'all' && node.area !== selectedArea) return false
      return true
    })
  }, [roadmapNodes, selectedArea, showCompleted])

  // Group by area
  const learningPaths = useMemo(() => {
    const paths: Record<string, RoadmapNode[]> = {}
    areas.forEach(area => {
      paths[area.name] = filteredNodes.filter(n => n.area === area.name)
    })
    return paths
  }, [areas, filteredNodes])

  // Stats
  const stats = useMemo(() => {
    const total = filteredNodes.length
    const completed = filteredNodes.filter(n => n.status === 'understood').length
    const inProgress = filteredNodes.filter(n => n.status === 'read').length
    const totalHours = filteredNodes.reduce((sum, n) => sum + n.estimatedHours, 0)
    const completedHours = filteredNodes.filter(n => n.status === 'understood').reduce((sum, n) => sum + n.estimatedHours, 0)

    return {
      total,
      completed,
      inProgress,
      pending: total - completed - inProgress,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalHours,
      remainingHours: totalHours - completedHours
    }
  }, [filteredNodes])

  // Next recommended
  const nextRecommended = useMemo(() => {
    return filteredNodes.filter(n => n.status === 'new').slice(0, 3)
  }, [filteredNodes])

  const togglePath = (areaId: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(areaId)) {
        newSet.delete(areaId)
      } else {
        newSet.add(areaId)
      }
      return newSet
    })
  }

  const handleMarkUnderstood = useCallback((nodeId: string) => {
    markAsUnderstood(nodeId)
    setRoadmapNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, status: 'understood' as const } : n
    ))
  }, [markAsUnderstood])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'understood':
        return <Check className="size-4 text-green-600" />
      case 'read':
        return <Circle className="size-4 text-yellow-600 fill-yellow-400" />
      default:
        return <Circle className="size-4 text-gray-400" />
    }
  }

  const getDifficultyStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Zap
        key={i}
        className={`size-3 ${i < difficulty ? 'text-orange-500 fill-orange-500' : 'text-gray-300'}`}
      />
    ))
  }

  // Timeline View
  const renderTimelineView = () => (
    <div className="space-y-4">
      {Object.entries(learningPaths).map(([areaName, pathNodes]) => {
        if (pathNodes.length === 0) return null
        const area = areas.find(a => a.name === areaName)
        if (!area) return null

        const isExpanded = expandedPaths.has(area.id)
        const areaCompleted = pathNodes.filter(n => n.status === 'understood').length
        const areaProgress = pathNodes.length > 0 ? Math.round((areaCompleted / pathNodes.length) * 100) : 0

        return (
          <div
            key={area.id}
            className="rounded-2xl overflow-hidden bg-card border border-border shadow-sm"
          >
            {/* Area Header */}
            <div
              className="p-4 cursor-pointer hover:bg-muted/50 transition-all"
              onClick={() => togglePath(area.id)}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button className="text-muted-foreground">
                    {isExpanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
                  </button>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${area.color}20` }}>
                    <span className="text-lg">{area.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{area.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {areaCompleted} de {pathNodes.length} completados
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{ width: `${areaProgress}%`, backgroundColor: area.color }}
                    />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: area.color }}>{areaProgress}%</span>
                </div>
              </div>
            </div>

            {/* Path Nodes */}
            {isExpanded && (
              <div className="px-4 pb-4">
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 rounded-full bg-border" />
                  <div className="space-y-3">
                    {pathNodes.map((node) => (
                      <div key={node.id} className="relative">
                        <div
                          className="absolute left-6 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background z-10"
                          style={{
                            backgroundColor: node.status === 'understood' ? '#10B981' : node.status === 'read' ? '#F59E0B' : '#D1D5DB'
                          }}
                        />
                        <div className="ml-12">
                          <div
                            className={`p-4 rounded-xl transition-all hover:shadow-md cursor-pointer ${
                              node.status === 'understood' ? 'bg-emerald-500/10' 
                              : node.status === 'read' ? 'bg-amber-500/10' 
                              : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {getStatusIcon(node.status)}
                                  <h4 className="font-medium text-sm text-foreground">{node.name}</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-1 text-xs rounded-lg capitalize bg-background text-muted-foreground border border-border">
                                    {node.level}
                                  </span>
                                  <span className="px-2 py-1 text-xs rounded-lg flex items-center gap-1 bg-background text-muted-foreground border border-border">
                                    <Clock className="size-3" />{node.estimatedHours}h
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Link
                                  href={node.isJournalEntry ? `/journal?date=${node.journalDate}` : `/study?topic=${encodeURIComponent(node.name)}`}
                                  className="p-2 rounded-lg transition-all hover:scale-105 bg-primary/10 text-foreground hover:bg-primary/20"
                                >
                                  {node.isJournalEntry ? <BookHeart className="size-4" /> : <BookOpen className="size-4" />}
                                </Link>
                                {node.status !== 'understood' && !node.isJournalEntry && (
                                  <button
                                    onClick={() => handleMarkUnderstood(node.id)}
                                    className="p-2 rounded-lg transition-all hover:scale-105 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                  >
                                    <Check className="size-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // Parallel View
  const renderParallelView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {Object.entries(learningPaths).map(([areaName, pathNodes]) => {
        if (pathNodes.length === 0) return null
        const area = areas.find(a => a.name === areaName)
        if (!area) return null

        const areaCompleted = pathNodes.filter(n => n.status === 'understood').length
        const areaProgress = pathNodes.length > 0 ? Math.round((areaCompleted / pathNodes.length) * 100) : 0

        return (
          <div key={area.id} className="rounded-2xl overflow-hidden flex flex-col bg-card border border-border shadow-sm">
            <div className="p-4 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${area.color}20` }}>
                  <span className="text-lg">{area.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate text-foreground">{area.name}</h3>
                  <p className="text-xs text-muted-foreground">{pathNodes.length} temas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                  <div className="h-full transition-all rounded-full" style={{ width: `${areaProgress}%`, backgroundColor: area.color }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: area.color }}>{areaProgress}%</span>
              </div>
            </div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-80">
              {pathNodes.slice(0, 8).map((node, index) => (
                <Link
                  key={node.id}
                  href={node.isJournalEntry ? `/journal?date=${node.journalDate}` : `/study?topic=${encodeURIComponent(node.name)}`}
                  className={`p-3 rounded-xl transition-all hover:shadow-sm cursor-pointer block ${
                    node.status === 'understood' ? 'bg-emerald-500/10' 
                    : node.status === 'read' ? 'bg-amber-500/10' 
                    : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                    {getStatusIcon(node.status)}
                    <span className="flex-1 text-sm font-medium truncate text-foreground">{node.name}</span>
                    <span className="text-xs text-muted-foreground">{node.estimatedHours}h</span>
                  </div>
                </Link>
              ))}
              {pathNodes.length > 8 && (
                <button className="w-full py-2 text-sm rounded-lg hover:bg-muted transition-all text-muted-foreground" onClick={() => setSelectedArea(area.name)}>
                  Ver todos ({pathNodes.length - 8} mas)
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  // Compact View
  const renderCompactView = () => (
    <div className="rounded-2xl overflow-x-auto bg-card border border-border shadow-sm">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Tema</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Area</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Nivel</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Tiempo</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredNodes.map((node, idx) => {
            const area = areas.find(a => a.name === node.area)
            return (
              <tr key={node.id} className={`transition-colors hover:bg-muted/30 ${idx > 0 ? 'border-t border-border' : ''}`}>
                <td className="px-4 py-3">{getStatusIcon(node.status)}</td>
                <td className="px-4 py-3"><span className="font-medium text-sm text-foreground">{node.name}</span></td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-lg" style={{ backgroundColor: `${area?.color}20`, color: area?.color }}>
                    {area?.icon} {node.area}
                  </span>
                </td>
                <td className="px-4 py-3"><span className="px-2 py-1 text-xs rounded-lg capitalize bg-muted text-muted-foreground">{node.level}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{node.estimatedHours}h</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={node.isJournalEntry ? `/journal?date=${node.journalDate}` : `/study?topic=${encodeURIComponent(node.name)}`}
                      className="p-2 rounded-lg transition-all hover:scale-105 bg-primary/10 text-foreground hover:bg-primary/20"
                    >
                      {node.isJournalEntry ? <BookHeart className="size-4" /> : <BookOpen className="size-4" />}
                    </Link>
                    {node.status !== 'understood' && !node.isJournalEntry && (
                      <button onClick={() => handleMarkUnderstood(node.id)} className="p-2 rounded-lg transition-all hover:scale-105 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                        <Check className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  if (loading) {
    return (
    <div className="flex-1 flex items-center justify-center transition-colors duration-300 bg-background">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/30 rounded-full animate-spin mx-auto mb-4 border-t-primary" />
        <p className="text-muted-foreground">Cargando ruta...</p>
      </div>
    </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden transition-colors duration-300 bg-background">
      {/* Header */}
      <div className="px-4 py-4 md:px-8 md:py-6 bg-background border-b border-border">
        <div className="mb-6">
          <h2 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <MapPin className="size-5 text-primary" />
            </div>
            Ruta de Aprendizaje
          </h2>
          <p className="text-sm mt-2 text-muted-foreground">Tu roadmap educativo personalizado</p>
        </div>

        {/* Area filter + View mode toggle */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Filter className="size-4 text-primary" />
            </div>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-4 py-2 rounded-xl text-sm transition-all focus:outline-none bg-card border border-border text-foreground shadow-sm"
            >
              <option value="all">Todas las areas</option>
              {areas.map(area => (
                <option key={area.id} value={area.name}>{area.icon} {area.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-muted border border-border">
            <button onClick={() => setViewMode('timeline')} className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium text-sm ${viewMode === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <GitBranch className="size-4" />Timeline
            </button>
            <button onClick={() => setViewMode('parallel')} className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium text-sm ${viewMode === 'parallel' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="size-4" />Paralelo
            </button>
            <button onClick={() => setViewMode('compact')} className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium text-sm ${viewMode === 'compact' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutList className="size-4" />Compacto
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl transition-all hover:shadow-md bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                <Target className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Temas</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl transition-all hover:shadow-md bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10">
                <Award className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl transition-all hover:shadow-md bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
                <TrendingUp className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl transition-all hover:shadow-md bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                <Clock className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.remainingHours}h</p>
                <p className="text-xs text-muted-foreground">Restante</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl transition-all hover:shadow-md bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.progress}%</p>
                <p className="text-xs text-muted-foreground">Progreso</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next recommended */}
      {nextRecommended.length > 0 && (
        <div className="mx-4 md:mx-8 my-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/20">
              <Sparkles className="size-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm mb-2 text-foreground">
                Siguientes Pasos Recomendados
              </p>
              <div className="flex gap-2 flex-wrap">
                {nextRecommended.map(node => (
                  <Link
                    key={node.id}
                    href={node.isJournalEntry ? `/journal?date=${node.journalDate}` : `/study?topic=${encodeURIComponent(node.name)}`}
                    className="px-3 py-1.5 rounded-lg hover:scale-105 transition-all text-sm font-medium flex items-center gap-2 bg-background text-foreground border border-border hover:bg-muted"
                  >
                    {node.isJournalEntry && <BookHeart className="size-3" />}
                    {node.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="px-4 md:px-8 py-4 bg-background border-b border-border">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-primary" />
            <span className="text-sm">Mostrar completados</span>
          </label>
          <div className="flex-1" />
          <Link href="/graph" className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm">
            Ver en Grafo
          </Link>
          <Link href="/library" className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 bg-primary/10 text-foreground hover:bg-primary/20">
            Ir a Biblioteca
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
        <div className="max-w-7xl mx-auto">
          {filteredNodes.length > 0 ? (
            <>
              {viewMode === 'timeline' && renderTimelineView()}
              {viewMode === 'parallel' && renderParallelView()}
              {viewMode === 'compact' && renderCompactView()}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary/10">
                <Calendar className="size-8 text-primary" />
              </div>
              <p className="text-lg font-medium mb-2 text-foreground">No hay temas en tu ruta</p>
              <p className="text-sm mb-6 text-muted-foreground">Agrega areas y temas desde la biblioteca para comenzar</p>
              <Link href="/library" className="px-6 py-3 rounded-xl font-medium transition-all hover:scale-105 bg-primary/10 text-foreground hover:bg-primary/20">
                Ir a Biblioteca
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer with global progress */}
      <div className="px-4 md:px-8 py-4 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Progreso Global:</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
              <div className="h-full transition-all duration-500 rounded-full bg-primary" style={{ width: `${stats.progress}%` }} />
            </div>
            <span className="text-sm font-bold text-primary">{stats.progress}%</span>
            <span className="text-xs text-muted-foreground">({stats.completed}/{stats.total} temas)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
