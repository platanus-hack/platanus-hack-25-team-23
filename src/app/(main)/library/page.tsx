"use client"

import { useState, useEffect, useCallback } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { Search, Grid, List, CheckCircle, Clock, Circle, Plus, ArrowRight, FolderOpen, Brain, Download, RefreshCw, FileText } from "lucide-react"
import Link from 'next/link'
import { toast } from 'sonner'

interface LibraryNote {
  id: string
  title: string
  slug: string
  content: string
  status: 'new' | 'read' | 'understood'
  area: string
  areaColor: string
  createdAt: string
  wordCount: number
}

// Color palette for auto-assigned areas
const AREA_COLORS = [
  '#C9B7F3', // Purple
  '#A3E4B6', // Green
  '#FFE9A9', // Yellow
  '#F5A3A3', // Red
  '#A3D4F5', // Blue
  '#F5D4A3', // Orange
  '#D4A3F5', // Violet
  '#A3F5E4', // Teal
]

// Helper to categorize notes by keywords
function detectArea(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()

  if (text.includes('matemat') || text.includes('algebra') || text.includes('calcul') || text.includes('geometr')) {
    return 'Matematicas'
  }
  if (text.includes('program') || text.includes('codigo') || text.includes('software') || text.includes('algoritm')) {
    return 'Programacion'
  }
  if (text.includes('fisica') || text.includes('quimica') || text.includes('biolog') || text.includes('ciencia')) {
    return 'Ciencias'
  }
  if (text.includes('histor') || text.includes('geograf') || text.includes('social')) {
    return 'Historia'
  }
  if (text.includes('idioma') || text.includes('ingles') || text.includes('español') || text.includes('lenguaje')) {
    return 'Idiomas'
  }
  if (text.includes('arte') || text.includes('musica') || text.includes('dibujo') || text.includes('diseño')) {
    return 'Arte'
  }
  if (text.includes('econom') || text.includes('finanz') || text.includes('negocio') || text.includes('empresa')) {
    return 'Economia'
  }
  if (text.includes('filosof') || text.includes('psicolog') || text.includes('sociolog')) {
    return 'Humanidades'
  }

  return 'General'
}

function getAreaColor(areaName: string): string {
  const areaIndex = [
    'Matematicas', 'Programacion', 'Ciencias', 'Historia',
    'Idiomas', 'Arte', 'Economia', 'Humanidades', 'General'
  ].indexOf(areaName)

  return AREA_COLORS[areaIndex >= 0 ? areaIndex : 0]
}

export default function LibraryPage() {
  const { notes: contextNotes, session } = useKnowledge()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [libraryNotes, setLibraryNotes] = useState<LibraryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [isReorganizing, setIsReorganizing] = useState(false)

  const loadLibraryData = useCallback(async () => {
    setLoading(true)

    // If no session, use notes from context
    if (!session?.user) {
      const notesFromContext: LibraryNote[] = contextNotes.map(note => {
        const area = detectArea(note.title, note.content)
        return {
          id: note.id || note.slug,
          title: note.title,
          slug: note.slug,
          content: note.content,
          status: note.status,
          area,
          areaColor: getAreaColor(area),
          createdAt: new Date().toISOString(),
          wordCount: note.content.split(/\s+/).length
        }
      })
      setLibraryNotes(notesFromContext)
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Load notes from the notes table
    const { data: notesData, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notes:', error)
      toast.error('Error al cargar las notas')
      setLoading(false)
      return
    }

    if (notesData) {
      const loadedNotes: LibraryNote[] = notesData.map(n => {
        const area = detectArea(n.title, n.content || '')
        return {
          id: n.id,
          title: n.title,
          slug: n.slug,
          content: n.content || '',
          status: (n.status || 'new') as 'new' | 'read' | 'understood',
          area,
          areaColor: getAreaColor(area),
          createdAt: n.created_at,
          wordCount: (n.content || '').split(/\s+/).length
        }
      })
      setLibraryNotes(loadedNotes)
    }

    setLoading(false)
  }, [session, contextNotes])

  useEffect(() => {
    loadLibraryData()
  }, [loadLibraryData])

  // Get unique areas from notes
  const uniqueAreas = [...new Set(libraryNotes.map(n => n.area))]

  const filteredNotes = libraryNotes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesArea = !selectedArea || note.area === selectedArea
    const matchesStatus = !selectedStatus || note.status === selectedStatus
    return matchesSearch && matchesArea && matchesStatus
  })

  const groupedByArea = filteredNotes.reduce((acc, note) => {
    if (!acc[note.area]) {
      acc[note.area] = []
    }
    acc[note.area].push(note)
    return acc
  }, {} as Record<string, LibraryNote[]>)

  // Reorganize notes (simulate AI reorganization)
  const handleReorganize = useCallback(async () => {
    setIsReorganizing(true)
    // Simulate reorganization delay
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Re-detect areas for all notes
    const reorganized = libraryNotes.map(note => ({
      ...note,
      area: detectArea(note.title, note.content),
      areaColor: getAreaColor(detectArea(note.title, note.content))
    }))

    setLibraryNotes(reorganized)
    setIsReorganizing(false)
    toast.success('Biblioteca reorganizada')
  }, [libraryNotes])

  // Export notes to Markdown
  const exportToMarkdown = useCallback((notesToExport: LibraryNote[], folderName?: string) => {
    let markdown = folderName
      ? `# ${folderName}\n\nExportado el ${new Date().toLocaleDateString('es-ES')}\n\n---\n\n`
      : `# Mi Biblioteca\n\nExportado el ${new Date().toLocaleDateString('es-ES')}\n\n---\n\n`

    // Group by area if exporting all
    const grouped = notesToExport.reduce((acc, note) => {
      if (!acc[note.area]) acc[note.area] = []
      acc[note.area].push(note)
      return acc
    }, {} as Record<string, LibraryNote[]>)

    for (const [area, notes] of Object.entries(grouped)) {
      markdown += `## ${area}\n\n`
      for (const note of notes) {
        markdown += `### ${note.title}\n\n`
        markdown += `${note.content}\n\n`
        markdown += `---\n\n`
      }
    }

    // Download the file
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = folderName ? `${folderName.toLowerCase().replace(/\s+/g, '-')}.md` : 'mi-biblioteca.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Exportado correctamente')
  }, [])

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
      case 'read':
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

  const getNoteAreaColor = (note: LibraryNote) => {
    return note.areaColor || getAreaColor(note.area)
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
              {libraryNotes.length} notas en tu biblioteca
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Reorganize Button */}
            <button
              onClick={handleReorganize}
              disabled={isReorganizing || libraryNotes.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                backgroundColor: 'white',
                border: '1px solid #E6E6E6',
                color: '#646464',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
              }}
            >
              <Brain className={`size-5 ${isReorganizing ? 'animate-pulse' : ''}`} />
              {isReorganizing ? 'Reorganizando...' : 'Reorganizar'}
            </button>

            {/* Export All Button */}
            <button
              onClick={() => exportToMarkdown(libraryNotes)}
              disabled={libraryNotes.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                backgroundColor: 'white',
                border: '1px solid #E6E6E6',
                color: '#646464',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
              }}
            >
              <Download className="size-5" />
              Exportar Todo
            </button>

            {/* New Note Button */}
            <Link
              href="/new-query"
              className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
              }}
            >
              <Plus className="size-5" />
              Nueva Nota
            </Link>
          </div>
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
              {uniqueAreas.map(area => (
                <option key={area} value={area}>{area}</option>
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
              <option value="read">Leido</option>
              <option value="new">Nuevo</option>
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
              No se encontraron notas
            </h3>
            <p className="mb-6" style={{ color: '#646464' }}>
              Intenta con otros filtros o crea una nueva nota
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
              Crear nota
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View - Grouped by Area
          <div className="space-y-8">
            {Object.entries(groupedByArea).map(([areaName, areaNotes]) => (
              <div key={areaName}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center"
                      style={{
                        backgroundColor: getAreaColor(areaName) + '30',
                        boxShadow: `0px 2px 6px ${getAreaColor(areaName)}20`
                      }}
                    >
                      <FileText className="size-5" style={{ color: getAreaColor(areaName) }} />
                    </div>
                    <h2 className="text-xl font-bold" style={{ color: '#1E1E1E' }}>{areaName}</h2>
                    <span
                      className="text-sm px-3 py-1 rounded-full"
                      style={{ backgroundColor: '#F6F6F6', color: '#646464' }}
                    >
                      {areaNotes.length}
                    </span>
                  </div>
                  {/* Export folder button */}
                  <button
                    onClick={() => exportToMarkdown(areaNotes, areaName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all hover:scale-105"
                    style={{
                      backgroundColor: '#F6F6F6',
                      color: '#646464',
                      border: '1px solid #E6E6E6'
                    }}
                  >
                    <Download className="size-4" />
                    Exportar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {areaNotes.map(note => (
                    <Link
                      key={note.id}
                      href={`/study?topic=${encodeURIComponent(note.title)}`}
                      className="rounded-2xl p-5 transition-all hover:scale-[1.02] group"
                      style={{
                        backgroundColor: 'white',
                        boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
                        border: '1px solid #E6E6E6'
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        {getStatusIcon(note.status)}
                        <span
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ backgroundColor: '#F6F6F6', color: '#646464' }}
                        >
                          {note.wordCount} palabras
                        </span>
                      </div>
                      <h3
                        className="font-semibold mb-2 group-hover:text-purple-600 transition-colors line-clamp-2"
                        style={{ color: '#1E1E1E' }}
                      >
                        {note.title}
                      </h3>
                      <p
                        className="text-sm mb-3 line-clamp-2"
                        style={{ color: '#646464' }}
                      >
                        {note.content.slice(0, 100)}...
                      </p>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{
                            backgroundColor: getNoteAreaColor(note) + '20',
                            color: getNoteAreaColor(note)
                          }}
                        >
                          {note.area}
                        </span>
                        <span
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{
                            background: 'linear-gradient(135deg, rgba(201, 183, 243, 0.2) 0%, rgba(214, 201, 245, 0.2) 100%)',
                            color: '#9575CD'
                          }}
                        >
                          IA
                        </span>
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
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Titulo</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Area</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Palabras</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '#646464' }}>Estado</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map(note => (
                  <tr
                    key={note.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: '1px solid #E6E6E6' }}
                  >
                    <td className="p-4">
                      <span className="font-semibold" style={{ color: '#1E1E1E' }}>{note.title}</span>
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded-lg"
                        style={{
                          background: 'linear-gradient(135deg, rgba(201, 183, 243, 0.2) 0%, rgba(214, 201, 245, 0.2) 100%)',
                          color: '#9575CD'
                        }}
                      >
                        IA
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className="text-sm px-3 py-1.5 rounded-xl font-medium"
                        style={{
                          backgroundColor: getNoteAreaColor(note) + '20',
                          color: getNoteAreaColor(note)
                        }}
                      >
                        {note.area}
                      </span>
                    </td>
                    <td className="p-4 text-sm" style={{ color: '#646464' }}>{note.wordCount}</td>
                    <td className="p-4">{getStatusIcon(note.status)}</td>
                    <td className="p-4">
                      <Link
                        href={`/study?topic=${encodeURIComponent(note.title)}`}
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
