"use client"

import { useState, useEffect } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { Search, Filter, Grid, List, CheckCircle, Clock, Circle, Plus } from "lucide-react"
import Link from 'next/link'

interface Concept {
  id: string
  name: string
  area: string
  areaColor?: string
  status: string
  level: string
  isGenerated: boolean
}

interface Area {
  id: string
  name: string
  color: string
  icon: string
}

export default function LibraryPage() {
  const { notes, session } = useKnowledge()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLibraryData() {
      if (!session?.user) {
        // Demo mode: use notes from context
        const demoConcepts = notes.map(note => ({
          id: note.slug,
          name: note.title,
          area: 'General',
          status: note.status === 'understood' ? 'understood' : note.status === 'read' ? 'in-progress' : 'pending',
          level: 'intermediate',
          isGenerated: true
        }))
        setConcepts(demoConcepts)
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

      // Load concepts with areas
      const { data: conceptsData } = await supabase
        .from('concepts')
        .select('*, areas(name, color)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (conceptsData) {
        const loadedConcepts: Concept[] = conceptsData.map(c => ({
          id: c.id,
          name: c.name,
          area: (c.areas as any)?.name || 'General',
          areaColor: (c.areas as any)?.color || '#C9B7F3',
          status: c.status || 'pending',
          level: c.level || 'intermediate',
          isGenerated: true
        }))
        setConcepts(loadedConcepts)
      }

      setLoading(false)
    }

    loadLibraryData()
  }, [session, notes])

  const allConcepts = concepts

  // Filter concepts
  const filteredConcepts = allConcepts.filter(concept => {
    const matchesSearch = concept.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesArea = !selectedArea || concept.area === selectedArea
    const matchesStatus = !selectedStatus || concept.status === selectedStatus
    return matchesSearch && matchesArea && matchesStatus
  })

  // Group by area
  const groupedByArea = filteredConcepts.reduce((acc, concept) => {
    if (!acc[concept.area]) {
      acc[concept.area] = []
    }
    acc[concept.area].push(concept)
    return acc
  }, {} as Record<string, typeof filteredConcepts>)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'understood':
        return <CheckCircle className="size-5 text-green-500" />
      case 'in-progress':
        return <Clock className="size-5 text-yellow-500" />
      default:
        return <Circle className="size-5 text-gray-300" />
    }
  }

  const getAreaColor = (areaName: string, concept?: Concept) => {
    if (concept?.areaColor) return concept.areaColor
    const area = areas.find(a => a.name === areaName)
    return area?.color || '#C9B7F3'
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Biblioteca</h1>
            <p className="text-gray-600">{allConcepts.length} conceptos en tu biblioteca</p>
          </div>
          <Link
            href="/new-query"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Plus className="size-5" />
            Nuevo Concepto
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-soft border border-gray-100 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conceptos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Area Filter */}
            <select
              value={selectedArea || ''}
              onChange={(e) => setSelectedArea(e.target.value || null)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">Todas las areas</option>
              {areas.map(area => (
                <option key={area.id} value={area.name}>{area.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">Todos los estados</option>
              <option value="understood">Dominado</option>
              <option value="in-progress">En progreso</option>
              <option value="pending">Pendiente</option>
            </select>

            {/* View Mode */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              >
                <Grid className="size-5 text-gray-600" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              >
                <List className="size-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {Object.keys(groupedByArea).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-soft border border-gray-100 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="size-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron conceptos</h3>
            <p className="text-gray-600">Intenta con otros filtros o crea un nuevo concepto</p>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View - Grouped by Area
          <div className="space-y-8">
            {Object.entries(groupedByArea).map(([areaName, concepts]) => (
              <div key={areaName}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: getAreaColor(areaName) + '30' }}
                  >
                    {areas.find(a => a.name === areaName)?.icon || '📚'}
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">{areaName}</h2>
                  <span className="text-sm text-gray-500">({concepts.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {concepts.map(concept => (
                    <Link
                      key={concept.id}
                      href={`/study?topic=${encodeURIComponent(concept.name)}`}
                      className="bg-white rounded-xl p-4 shadow-soft border border-gray-100 hover:border-purple-200 transition-all hover:shadow-md group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        {getStatusIcon(concept.status)}
                        <span className="text-xs text-gray-400 capitalize">{concept.level}</span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                        {concept.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: getAreaColor(concept.area, concept) + '20',
                            color: getAreaColor(concept.area, concept)
                          }}
                        >
                          {concept.area.split(' ')[0]}
                        </span>
                        {concept.isGenerated && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                            IA
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-gray-600">Concepto</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-600">Area</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-600">Nivel</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-600">Estado</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map(concept => (
                  <tr key={concept.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-medium text-gray-900">{concept.name}</span>
                      {concept.isGenerated && (
                        <span className="ml-2 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          IA
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className="text-sm px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: getAreaColor(concept.area, concept) + '20',
                          color: getAreaColor(concept.area, concept)
                        }}
                      >
                        {concept.area}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600 capitalize">{concept.level}</td>
                    <td className="p-4">{getStatusIcon(concept.status)}</td>
                    <td className="p-4">
                      <Link
                        href={`/study?topic=${encodeURIComponent(concept.name)}`}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        Estudiar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
