"use client"

import { useState, useEffect } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { Search, Grid, List, CheckCircle, Clock, Circle, Plus, BookOpen, ArrowRight, FolderOpen } from "lucide-react"
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
        const demoConcepts = notes.map(note => ({
          id: note.slug,
          name: note.title,
          area: 'General',
          areaColor: '#C9B7F3',
          status: note.status === 'understood' ? 'understood' : note.status === 'read' ? 'in-progress' : 'pending',
          level: 'intermediate',
          isGenerated: true
        }))
        setConcepts(demoConcepts)
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

  const filteredConcepts = allConcepts.filter(concept => {
    const matchesSearch = concept.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesArea = !selectedArea || concept.area === selectedArea
    const matchesStatus = !selectedStatus || concept.status === selectedStatus
    return matchesSearch && matchesArea && matchesStatus
  })

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
        return (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #A3E4B6 0%, #B9E2B1 100%)',
              boxShadow: '0px 2px 6px rgba(163, 228, 182, 0.3)'
            }}
          >
            <CheckCircle className="size-4 text-white" />
          </div>
        )
      case 'in-progress':
        return (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FFE9A9 0%, #FFF4D4 100%)',
              boxShadow: '0px 2px 6px rgba(255, 233, 169, 0.3)'
            }}
          >
            <Clock className="size-4" style={{ color: '#B89C3C' }} />
          </div>
        )
      default:
        return (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #E6E6E6 0%, #F0F0F0 100%)',
              boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)'
            }}
          >
            <Circle className="size-4" style={{ color: '#646464' }} />
          </div>
        )
    }
  }

  const getAreaColor = (areaName: string, concept?: Concept) => {
    if (concept?.areaColor) return concept.areaColor
    const area = areas.find(a => a.name === areaName)
    return area?.color || '#C9B7F3'
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: '#1E1E1E' }}>
              Biblioteca
            </h1>
            <p style={{ color: '#646464' }}>
              {allConcepts.length} conceptos en tu biblioteca
            </p>
          </div>
          <Link
            href="/new-query"
            className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
            }}
          >
            <Plus className="size-5" />
            Nuevo Concepto
          </Link>
        </div>

        {/* Search and Filters */}
        <div
          className="rounded-3xl p-5 mb-6"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 size-5"
                style={{ color: '#646464' }}
              />
              <input
                type="text"
                placeholder="Buscar conceptos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: '#F6F6F6',
                  border: '1px solid #E6E6E6',
                  color: '#1E1E1E'
                }}
              />
            </div>

            {/* Area Filter */}
            <select
              value={selectedArea || ''}
              onChange={(e) => setSelectedArea(e.target.value || null)}
              className="px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: '#F6F6F6',
                border: '1px solid #E6E6E6',
                color: '#646464'
              }}
            >
              <option value="">Todas las areas</option>
              {areas.map(area => (
                <option key={area.id} value={area.name}>{area.icon} {area.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: '#F6F6F6',
                border: '1px solid #E6E6E6',
                color: '#646464'
              }}
            >
              <option value="">Todos los estados</option>
              <option value="understood">Dominado</option>
              <option value="in-progress">En progreso</option>
              <option value="pending">Pendiente</option>
            </select>

            {/* View Mode */}
            <div
              className="flex rounded-2xl p-1.5"
              style={{
                backgroundColor: '#F6F6F6',
                border: '1px solid #E6E6E6'
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                className="p-2.5 rounded-xl transition-all"
                style={{
                  background: viewMode === 'grid'
                    ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
                    : 'transparent',
                  color: viewMode === 'grid' ? 'white' : '#646464',
                  boxShadow: viewMode === 'grid' ? '0px 2px 6px rgba(201, 183, 243, 0.3)' : 'none'
                }}
              >
                <Grid className="size-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="p-2.5 rounded-xl transition-all"
                style={{
                  background: viewMode === 'list'
                    ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
                    : 'transparent',
                  color: viewMode === 'list' ? 'white' : '#646464',
                  boxShadow: viewMode === 'list' ? '0px 2px 6px rgba(201, 183, 243, 0.3)' : 'none'
                }}
              >
                <List className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {Object.keys(groupedByArea).length === 0 ? (
          <div
            className="rounded-3xl p-12 text-center"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#E6DEF9' }}
            >
              <FolderOpen className="size-10" style={{ color: '#C9B7F3' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E1E1E' }}>
              No se encontraron conceptos
            </h3>
            <p className="mb-6" style={{ color: '#646464' }}>
              Intenta con otros filtros o crea un nuevo concepto
            </p>
            <Link
              href="/new-query"
              className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-2xl transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
              }}
            >
              <Plus className="size-5" />
              Crear concepto
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View - Grouped by Area
          <div className="space-y-8">
            {Object.entries(groupedByArea).map(([areaName, concepts]) => (
              <div key={areaName}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                    style={{
                      backgroundColor: getAreaColor(areaName) + '30',
                      boxShadow: `0px 2px 6px ${getAreaColor(areaName)}20`
                    }}
                  >
                    {areas.find(a => a.name === areaName)?.icon || '📚'}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: '#1E1E1E' }}>{areaName}</h2>
                  <span
                    className="text-sm px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#F6F6F6', color: '#646464' }}
                  >
                    {concepts.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {concepts.map(concept => (
                    <Link
                      key={concept.id}
                      href={`/study?topic=${encodeURIComponent(concept.name)}`}
                      className="rounded-2xl p-5 transition-all hover:scale-[1.02] group"
                      style={{
                        backgroundColor: 'white',
                        boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
                        border: '1px solid #E6E6E6'
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        {getStatusIcon(concept.status)}
                        <span
                          className="text-xs px-2 py-1 rounded-lg capitalize"
                          style={{ backgroundColor: '#F6F6F6', color: '#646464' }}
                        >
                          {concept.level}
                        </span>
                      </div>
                      <h3
                        className="font-semibold mb-3 group-hover:text-purple-600 transition-colors"
                        style={{ color: '#1E1E1E' }}
                      >
                        {concept.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{
                            backgroundColor: getAreaColor(concept.area, concept) + '20',
                            color: getAreaColor(concept.area, concept)
                          }}
                        >
                          {concept.area.split(' ')[0]}
                        </span>
                        {concept.isGenerated && (
                          <span
                            className="text-xs px-3 py-1.5 rounded-xl font-medium"
                            style={{
                              background: 'linear-gradient(135deg, rgba(201, 183, 243, 0.2) 0%, rgba(214, 201, 245, 0.2) 100%)',
                              color: '#9575CD'
                            }}
                          >
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
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <table className="w-full">
              <thead
                style={{
                  backgroundColor: '#F6F6F6',
                  borderBottom: '1px solid #E6E6E6'
                }}
              >
                <tr>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Concepto</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Area</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Nivel</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Estado</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map(concept => (
                  <tr
                    key={concept.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: '1px solid #E6E6E6' }}
                  >
                    <td className="p-4">
                      <span className="font-semibold" style={{ color: '#1E1E1E' }}>{concept.name}</span>
                      {concept.isGenerated && (
                        <span
                          className="ml-2 text-xs px-2 py-0.5 rounded-lg"
                          style={{
                            background: 'linear-gradient(135deg, rgba(201, 183, 243, 0.2) 0%, rgba(214, 201, 245, 0.2) 100%)',
                            color: '#9575CD'
                          }}
                        >
                          IA
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className="text-sm px-3 py-1.5 rounded-xl font-medium"
                        style={{
                          backgroundColor: getAreaColor(concept.area, concept) + '20',
                          color: getAreaColor(concept.area, concept)
                        }}
                      >
                        {concept.area}
                      </span>
                    </td>
                    <td className="p-4 text-sm capitalize" style={{ color: '#646464' }}>{concept.level}</td>
                    <td className="p-4">{getStatusIcon(concept.status)}</td>
                    <td className="p-4">
                      <Link
                        href={`/study?topic=${encodeURIComponent(concept.name)}`}
                        className="flex items-center gap-1 text-sm font-medium transition-all hover:scale-105"
                        style={{ color: '#C9B7F3' }}
                      >
                        Estudiar
                        <ArrowRight className="size-4" />
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
