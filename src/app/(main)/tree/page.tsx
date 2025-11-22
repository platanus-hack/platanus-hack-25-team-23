"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
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
  Calendar
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
}

interface Area {
  id: string
  name: string
  color: string
  icon: string
  description: string
}

// Area definitions
const AREA_CONFIG: Record<string, { color: string; icon: string; description: string }> = {
  'Desarrollo Profesional': { color: '#3b82f6', icon: '💼', description: 'Carrera y crecimiento laboral' },
  'Programacion': { color: '#3b82f6', icon: '💻', description: 'Código y desarrollo de software' },
  'Matematicas': { color: '#8b5cf6', icon: '🧮', description: 'Álgebra, cálculo y estadística' },
  'Ciencias': { color: '#22c55e', icon: '🔬', description: 'Física, química y biología' },
  'Salud y Bienestar': { color: '#22c55e', icon: '🏃', description: 'Ejercicio y nutrición' },
  'Finanzas Personales': { color: '#eab308', icon: '💰', description: 'Presupuesto e inversiones' },
  'Historia': { color: '#f97316', icon: '📜', description: 'Historia y geografía' },
  'Idiomas': { color: '#ec4899', icon: '🗣️', description: 'Aprendizaje de idiomas' },
  'Arte': { color: '#8b5cf6', icon: '🎨', description: 'Arte y diseño' },
  'Economia': { color: '#eab308', icon: '📊', description: 'Economía y negocios' },
  'Humanidades': { color: '#ec4899', icon: '📚', description: 'Filosofía y psicología' },
  'Crecimiento Personal': { color: '#9333ea', icon: '🌱', description: 'Hábitos y productividad' },
  'General': { color: '#C9B7F3', icon: '📝', description: 'Temas generales' },
}

type ViewMode = 'timeline' | 'parallel' | 'compact'

function detectArea(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()
  if (text.includes('matemat') || text.includes('algebra') || text.includes('calcul')) return 'Matematicas'
  if (text.includes('program') || text.includes('codigo') || text.includes('algoritm')) return 'Programacion'
  if (text.includes('fisica') || text.includes('quimica') || text.includes('biolog')) return 'Ciencias'
  if (text.includes('histor') || text.includes('geograf')) return 'Historia'
  if (text.includes('idioma') || text.includes('ingles')) return 'Idiomas'
  if (text.includes('arte') || text.includes('musica')) return 'Arte'
  if (text.includes('econom') || text.includes('finanz')) return 'Finanzas Personales'
  if (text.includes('filosof') || text.includes('psicolog')) return 'Humanidades'
  if (text.includes('salud') || text.includes('ejercicio')) return 'Salud y Bienestar'
  if (text.includes('habito') || text.includes('productividad')) return 'Crecimiento Personal'
  return 'General'
}

export default function TreePage() {
  const { notes: contextNotes, session, markAsUnderstood } = useKnowledge()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedArea, setSelectedArea] = useState<string>('all')
  const [showCompleted, setShowCompleted] = useState(true)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(true)

  // Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true)

      if (!session?.user) {
        // Use context notes
        const nodes: RoadmapNode[] = contextNotes.map(note => {
          const area = detectArea(note.title, note.content)
          return {
            id: note.id || note.slug,
            name: note.title,
            status: note.status,
            area,
            areaColor: AREA_CONFIG[area]?.color || '#C9B7F3',
            level: 'intermediate' as const,
            estimatedHours: Math.ceil(note.content.split(/\s+/).length / 200),
            difficulty: 3
          }
        })
        setRoadmapNodes(nodes)
        // Expand first area
        if (nodes.length > 0) {
          setExpandedPaths(new Set([nodes[0].area.toLowerCase().replace(/\s+/g, '-')]))
        }
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })

      if (notesData) {
        const nodes: RoadmapNode[] = notesData.map(n => {
          const area = detectArea(n.title, n.content || '')
          return {
            id: n.id,
            name: n.title,
            status: (n.status || 'new') as 'understood' | 'read' | 'new',
            area,
            areaColor: AREA_CONFIG[area]?.color || '#C9B7F3',
            level: 'intermediate' as const,
            estimatedHours: Math.ceil((n.content || '').split(/\s+/).length / 200),
            difficulty: 3
          }
        })
        setRoadmapNodes(nodes)
        if (nodes.length > 0) {
          setExpandedPaths(new Set([nodes[0].area.toLowerCase().replace(/\s+/g, '-')]))
        }
      }
      setLoading(false)
    }
    loadData()
  }, [session, contextNotes])

  // Get unique areas
  const areas: Area[] = useMemo(() => {
    const uniqueAreas = [...new Set(roadmapNodes.map(n => n.area))]
    return uniqueAreas.map(name => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      color: AREA_CONFIG[name]?.color || '#C9B7F3',
      icon: AREA_CONFIG[name]?.icon || '📝',
      description: AREA_CONFIG[name]?.description || ''
    }))
  }, [roadmapNodes])

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
    <div className="space-y-6">
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
            className="bg-white rounded-3xl overflow-hidden"
            style={{ boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)' }}
          >
            {/* Area Header */}
            <div
              className="p-6 cursor-pointer hover:opacity-90 transition-all"
              style={{
                backgroundColor: `${area.color}10`,
                borderBottom: `3px solid ${area.color}40`
              }}
              onClick={() => togglePath(area.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button style={{ color: area.color }}>
                    {isExpanded ? <ChevronDown className="size-7" /> : <ChevronRight className="size-7" />}
                  </button>
                  <span className="text-4xl">{area.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold" style={{ color: '#1E1E1E' }}>{area.name}</h3>
                    <p className="text-sm mt-1" style={{ color: '#646464' }}>
                      {areaCompleted} de {pathNodes.length} temas completados
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-3xl font-bold" style={{ color: area.color }}>{areaProgress}%</p>
                    <p className="text-sm" style={{ color: '#646464' }}>Progreso</p>
                  </div>
                  <div className="w-32 h-4 rounded-full overflow-hidden" style={{ backgroundColor: `${area.color}20` }}>
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{ width: `${areaProgress}%`, backgroundColor: area.color }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Path Nodes */}
            {isExpanded && (
              <div className="p-6">
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-1 rounded-full" style={{ backgroundColor: `${area.color}30` }} />
                  <div className="space-y-4">
                    {pathNodes.map((node) => (
                      <div key={node.id} className="relative">
                        <div
                          className="absolute left-8 -translate-x-1/2 w-5 h-5 rounded-full border-4 border-white z-10"
                          style={{
                            backgroundColor: node.status === 'understood' ? area.color : '#cbd5e1',
                            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)'
                          }}
                        />
                        <div className="ml-16">
                          <div
                            className="p-5 rounded-2xl transition-all hover:scale-[1.01] cursor-pointer relative overflow-hidden"
                            style={{
                              background: node.status === 'understood' ? '#B9E2B1'
                                : node.status === 'read' ? '#FFF4D4' : 'white',
                              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
                              border: `3px solid ${node.status === 'understood' ? '#A3E4B6'
                                : node.status === 'read' ? '#FFE9A9' : '#E6E6E6'}`
                            }}
                          >
                            {node.status === 'understood' && (
                              <div
                                className="absolute top-0 right-0 w-16 h-16"
                                style={{ backgroundColor: '#A3E4B6', clipPath: 'polygon(100% 0, 100% 100%, 0 0)', opacity: 0.5 }}
                              />
                            )}
                            <div className="flex items-start justify-between gap-4 relative z-10">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-3">
                                  <div
                                    className="p-1.5 rounded-lg"
                                    style={{
                                      backgroundColor: node.status === 'understood' ? 'rgba(47, 143, 79, 0.2)'
                                        : node.status === 'read' ? 'rgba(184, 156, 60, 0.2)' : 'rgba(100, 100, 100, 0.1)'
                                    }}
                                  >
                                    {getStatusIcon(node.status)}
                                  </div>
                                  <h4 className="font-semibold text-lg" style={{ color: '#1E1E1E' }}>{node.name}</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-3 py-1.5 text-xs rounded-full font-medium capitalize"
                                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', color: '#646464', border: '1px solid rgba(230, 230, 230, 0.8)' }}>
                                    📚 {node.level}
                                  </span>
                                  <span className="px-3 py-1.5 text-xs rounded-full font-medium flex items-center gap-1.5"
                                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', color: '#646464', border: '1px solid rgba(230, 230, 230, 0.8)' }}>
                                    <span className="flex gap-0.5">{getDifficultyStars(node.difficulty)}</span>
                                  </span>
                                  <span className="px-3 py-1.5 text-xs rounded-full font-medium flex items-center gap-1.5"
                                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', color: '#646464', border: '1px solid rgba(230, 230, 230, 0.8)' }}>
                                    <Clock className="size-3.5" />{node.estimatedHours}h
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Link
                                  href={`/study?topic=${encodeURIComponent(node.name)}`}
                                  className="px-4 py-2 rounded-xl text-white font-medium transition-all hover:scale-110"
                                  style={{ backgroundColor: area.color, boxShadow: `0px 2px 6px ${area.color}50` }}
                                >
                                  <BookOpen className="size-5" />
                                </Link>
                                {node.status !== 'understood' && (
                                  <button
                                    onClick={() => handleMarkUnderstood(node.id)}
                                    className="px-4 py-2 rounded-xl text-white font-medium transition-all hover:scale-110"
                                    style={{ backgroundColor: '#A3E4B6', boxShadow: '0px 2px 6px rgba(163, 228, 182, 0.4)' }}
                                  >
                                    <Check className="size-5" />
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
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {Object.entries(learningPaths).map(([areaName, pathNodes]) => {
        if (pathNodes.length === 0) return null
        const area = areas.find(a => a.name === areaName)
        if (!area) return null

        const areaCompleted = pathNodes.filter(n => n.status === 'understood').length
        const areaProgress = pathNodes.length > 0 ? Math.round((areaCompleted / pathNodes.length) * 100) : 0

        return (
          <div key={area.id} className="bg-white rounded-xl border-2 overflow-hidden flex flex-col" style={{ borderColor: `${area.color}40` }}>
            <div className="p-4" style={{ backgroundColor: `${area.color}10` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{area.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{area.name}</h3>
                  <p className="text-xs text-gray-600">{pathNodes.length} temas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${areaProgress}%`, backgroundColor: area.color }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: area.color }}>{areaProgress}%</span>
              </div>
            </div>
            <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-96">
              {pathNodes.slice(0, 8).map((node, index) => (
                <Link
                  key={node.id}
                  href={`/study?topic=${encodeURIComponent(node.name)}`}
                  className={`p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer block ${
                    node.status === 'understood' ? 'border-green-500 bg-green-50'
                      : node.status === 'read' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    {getStatusIcon(node.status)}
                    <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
                    <Clock className="size-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{node.estimatedHours}h</span>
                  </div>
                </Link>
              ))}
              {pathNodes.length > 8 && (
                <button className="w-full py-2 text-sm text-gray-600 hover:text-gray-900" onClick={() => setSelectedArea(area.name)}>
                  Ver todos ({pathNodes.length - 8} más)
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
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Estado</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Tema</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Área</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Nivel</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Dificultad</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Tiempo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredNodes.map((node) => {
            const area = areas.find(a => a.name === node.area)
            return (
              <tr key={node.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">{getStatusIcon(node.status)}</td>
                <td className="px-6 py-4"><span className="font-medium text-gray-900">{node.name}</span></td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: `${area?.color}20`, color: area?.color }}>
                    {area?.icon} {node.area}
                  </span>
                </td>
                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">{node.level}</span></td>
                <td className="px-6 py-4"><div className="flex gap-0.5">{getDifficultyStars(node.difficulty)}</div></td>
                <td className="px-6 py-4"><span className="text-sm text-gray-600">{node.estimatedHours}h</span></td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Link href={`/study?topic=${encodeURIComponent(node.name)}`} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                      <BookOpen className="size-4" />
                    </Link>
                    {node.status !== 'understood' && (
                      <button onClick={() => handleMarkUnderstood(node.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
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
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F6F8FA' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: '#C9B7F3' }} />
          <p style={{ color: '#646464' }}>Cargando ruta...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F6F8FA' }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: 'white' }}>
        <div className="mb-6">
          <h2 className="text-4xl font-bold flex items-center gap-3" style={{ color: '#1E1E1E' }}>
            <div className="p-3 rounded-2xl" style={{ backgroundColor: 'rgba(201, 183, 243, 0.2)' }}>
              <MapPin className="size-8" style={{ color: '#9575CD' }} />
            </div>
            Ruta de Aprendizaje
          </h2>
          <p className="text-lg mt-2" style={{ color: '#646464' }}>Tu roadmap educativo personalizado</p>
        </div>

        {/* Area filter + View mode toggle */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Filter className="size-5" style={{ color: '#646464' }} />
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-5 py-3 rounded-2xl transition-all focus:outline-none"
              style={{ backgroundColor: 'white', border: '3px solid #E6E6E6', color: '#1E1E1E', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' }}
            >
              <option value="all">🌐 Todas las áreas</option>
              {areas.map(area => (
                <option key={area.id} value={area.name}>{area.icon} {area.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 p-2 rounded-3xl" style={{ backgroundColor: 'white', border: '3px solid #E6E6E6', boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)' }}>
            <button onClick={() => setViewMode('timeline')} className="px-4 py-3 rounded-2xl transition-all flex items-center gap-2 font-medium"
              style={{ backgroundColor: viewMode === 'timeline' ? '#C9B7F3' : 'transparent', color: viewMode === 'timeline' ? 'white' : '#646464' }}>
              <GitBranch className="size-4" />Línea de Tiempo
            </button>
            <button onClick={() => setViewMode('parallel')} className="px-4 py-3 rounded-2xl transition-all flex items-center gap-2 font-medium"
              style={{ backgroundColor: viewMode === 'parallel' ? '#C9B7F3' : 'transparent', color: viewMode === 'parallel' ? 'white' : '#646464' }}>
              <LayoutGrid className="size-4" />Rutas Paralelas
            </button>
            <button onClick={() => setViewMode('compact')} className="px-4 py-3 rounded-2xl transition-all flex items-center gap-2 font-medium"
              style={{ backgroundColor: viewMode === 'compact' ? '#C9B7F3' : 'transparent', color: viewMode === 'compact' ? 'white' : '#646464' }}>
              <LayoutList className="size-4" />Vista Compacta
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          <div className="p-5 rounded-3xl transition-all hover:scale-105 duration-300 relative overflow-hidden"
            style={{ backgroundColor: '#D6C9F5', border: '3px solid #C9B7F3', boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)' }}>
            <div className="absolute top-0 right-0 w-16 h-16" style={{ backgroundColor: '#C9B7F3', clipPath: 'polygon(100% 0, 100% 100%, 0 0)', opacity: 0.5 }} />
            <div className="flex items-center gap-3 relative z-10">
              <Target className="size-8" style={{ color: 'white' }} />
              <div>
                <p className="text-3xl font-bold" style={{ color: 'white' }}>{stats.total}</p>
                <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Total Temas</p>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-3xl transition-all hover:scale-105 duration-300 relative overflow-hidden"
            style={{ backgroundColor: '#B9E2B1', border: '3px solid #A3E4B6', boxShadow: '0px 4px 14px rgba(163, 228, 182, 0.3)' }}>
            <div className="flex items-center gap-3 relative z-10">
              <Award className="size-8" style={{ color: '#2F8F4F' }} />
              <div>
                <p className="text-3xl font-bold" style={{ color: '#2F8F4F' }}>{stats.completed}</p>
                <p className="text-sm" style={{ color: '#2F8F4F' }}>Completados</p>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-3xl transition-all hover:scale-105 duration-300 relative overflow-hidden"
            style={{ backgroundColor: '#FFF4D4', border: '3px solid #FFE9A9', boxShadow: '0px 4px 14px rgba(255, 233, 169, 0.3)' }}>
            <div className="flex items-center gap-3 relative z-10">
              <TrendingUp className="size-8" style={{ color: '#B89C3C' }} />
              <div>
                <p className="text-3xl font-bold" style={{ color: '#B89C3C' }}>{stats.inProgress}</p>
                <p className="text-sm" style={{ color: '#B89C3C' }}>En Progreso</p>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-3xl transition-all hover:scale-105 duration-300 relative overflow-hidden"
            style={{ backgroundColor: '#A3D4FF', border: '3px solid #5A8FCC', boxShadow: '0px 4px 14px rgba(163, 212, 255, 0.3)' }}>
            <div className="flex items-center gap-3 relative z-10">
              <Clock className="size-8" style={{ color: '#5A8FCC' }} />
              <div>
                <p className="text-3xl font-bold" style={{ color: '#5A8FCC' }}>{stats.remainingHours}h</p>
                <p className="text-sm" style={{ color: '#5A8FCC' }}>Tiempo Restante</p>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-3xl transition-all hover:scale-105 duration-300 relative overflow-hidden"
            style={{ backgroundColor: '#FFCFA9', border: '3px solid #CC7A3C', boxShadow: '0px 4px 14px rgba(255, 207, 169, 0.3)' }}>
            <div className="flex items-center gap-3 relative z-10">
              <Sparkles className="size-8" style={{ color: '#CC7A3C' }} />
              <div>
                <p className="text-3xl font-bold" style={{ color: '#CC7A3C' }}>{stats.progress}%</p>
                <p className="text-sm" style={{ color: '#CC7A3C' }}>Progreso Global</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next recommended */}
      {nextRecommended.length > 0 && (
        <div className="px-8 py-5 relative overflow-hidden" style={{ backgroundColor: '#E6DEF9', border: '3px solid #D6C9F5' }}>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
              <Sparkles className="size-6" style={{ color: '#9575CD' }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#1E1E1E' }}>
                <span className="text-xl">🎯</span>Siguientes Pasos Recomendados
              </p>
              <div className="flex gap-3 flex-wrap">
                {nextRecommended.map(node => (
                  <Link key={node.id} href={`/study?topic=${encodeURIComponent(node.name)}`}
                    className="px-4 py-2 bg-white rounded-2xl hover:scale-105 transition-all font-medium"
                    style={{ color: '#9575CD', boxShadow: '0px 2px 8px rgba(255, 255, 255, 0.5)' }}>
                    {node.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-white px-8 py-5 border-t-2 border-gray-100">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-2xl hover:bg-gray-50 transition-all">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
            <span className="text-sm font-medium" style={{ color: '#646464' }}>Mostrar completados</span>
          </label>
          <div className="flex-1" />
          <Link href="/graph" className="px-5 py-2 rounded-2xl font-medium transition-all hover:scale-105"
            style={{ border: '3px solid #C9B7F3', color: '#9575CD', background: 'white' }}>
            Ver en Grafo
          </Link>
          <Link href="/library" className="px-5 py-2 rounded-2xl text-white font-medium transition-all hover:scale-105"
            style={{ backgroundColor: '#C9B7F3', boxShadow: '0px 2px 8px rgba(201, 183, 243, 0.3)' }}>
            Ir a Biblioteca
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {filteredNodes.length > 0 ? (
            <>
              {viewMode === 'timeline' && renderTimelineView()}
              {viewMode === 'parallel' && renderParallelView()}
              {viewMode === 'compact' && renderCompactView()}
            </>
          ) : (
            <div className="text-center py-20">
              <Calendar className="size-16 mx-auto text-gray-300 mb-4" />
              <p className="text-xl text-gray-600 mb-2">No hay temas en tu ruta</p>
              <p className="text-gray-500 mb-6">Agrega áreas y temas desde la biblioteca para comenzar</p>
              <Link href="/library" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Ir a Biblioteca
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer with global progress */}
      <div className="bg-white border-t-2 border-gray-200 px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Progreso Global:</span>
            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-500" style={{ width: `${stats.progress}%`, backgroundColor: '#C9B7F3' }} />
            </div>
            <span className="text-lg font-bold text-purple-600">{stats.progress}%</span>
            <span className="text-sm text-gray-600">({stats.completed}/{stats.total} temas)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
