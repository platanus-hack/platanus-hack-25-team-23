"use client"

import { useEffect, useState } from "react"
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { BookOpen, TrendingUp, Clock, CheckCircle, ArrowRight, Plus, Network } from "lucide-react"
import Link from "next/link"

interface Area {
  id: string
  name: string
  color: string
  icon: string
  progress?: number
  total?: number
  understood?: number
}

interface DashboardStats {
  total_concepts: number
  understood_concepts: number
  in_progress_concepts: number
  total_study_time: number
}

export default function DashboardPage() {
  const { notes, session } = useKnowledge()
  const [areas, setAreas] = useState<Area[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total_concepts: 0,
    understood_concepts: 0,
    in_progress_concepts: 0,
    total_study_time: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      if (!session?.user) {
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Load areas with progress
      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)
        .order('sort_order')

      if (areasData) {
        // Calculate progress for each area
        const areasWithProgress = await Promise.all(
          areasData.map(async (area) => {
            const { count: total } = await supabase
              .from('concepts')
              .select('*', { count: 'exact', head: true })
              .eq('area_id', area.id)

            const { count: understood } = await supabase
              .from('concepts')
              .select('*', { count: 'exact', head: true })
              .eq('area_id', area.id)
              .eq('status', 'understood')

            return {
              ...area,
              total: total || 0,
              understood: understood || 0,
              progress: total ? Math.round(((understood || 0) / total) * 100) : 0
            }
          })
        )
        setAreas(areasWithProgress.filter(a => a.total > 0))
      }

      // Load overall stats
      const { count: totalConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      const { count: understoodConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'understood')

      const { count: inProgressConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'in-progress')

      setStats({
        total_concepts: totalConcepts || 0,
        understood_concepts: understoodConcepts || 0,
        in_progress_concepts: inProgressConcepts || 0,
        total_study_time: 0
      })

      setLoading(false)
    }

    loadDashboardData()
  }, [session])

  // Calculate progress percent
  const progressPercent = stats.total_concepts > 0
    ? Math.round((stats.understood_concepts / stats.total_concepts) * 100)
    : 0

  // Get recent notes
  const recentNotes = notes.slice(-3).reverse()

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: '#F6F8FA' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Tu progreso de aprendizaje</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <BookOpen className="size-5 text-purple-600" />
              </div>
              <span className="text-gray-600">Total Conceptos</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? '-' : stats.total_concepts}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="size-5 text-green-600" />
              </div>
              <span className="text-gray-600">Dominados</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? '-' : stats.understood_concepts}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="size-5 text-yellow-600" />
              </div>
              <span className="text-gray-600">En Progreso</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? '-' : stats.in_progress_concepts}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <TrendingUp className="size-5 text-blue-600" />
              </div>
              <span className="text-gray-600">Progreso Total</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? '-' : `${progressPercent}%`}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            href="/new-query"
            className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">Nueva Consulta</h3>
                <p className="text-purple-100">Aprende un nuevo tema con IA</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <Plus className="size-6" />
              </div>
            </div>
          </Link>

          <Link
            href="/graph"
            className="bg-white rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 transition-all shadow-soft group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Ver Grafo</h3>
                <p className="text-gray-600">Explora tu mapa de conocimiento</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Network className="size-6 text-purple-600" />
              </div>
            </div>
          </Link>
        </div>

        {/* Areas Progress */}
        {areas.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Progreso por Area</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {areas.map((area) => (
                <div key={area.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: (area.color || '#C9B7F3') + '30' }}
                  >
                    {area.icon || '📚'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{area.name}</span>
                      <span className="text-sm text-gray-500">{area.understood || 0}/{area.total || 0}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${area.progress || 0}%`,
                          backgroundColor: area.color || '#C9B7F3'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Notes */}
        {recentNotes.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Notas Recientes</h2>
              <Link href="/library" className="text-purple-600 hover:text-purple-700 flex items-center gap-1">
                Ver todas <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="space-y-4">
              {recentNotes.map((note) => (
                <Link
                  key={note.slug}
                  href={`/study?topic=${encodeURIComponent(note.title)}`}
                  className="block p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <h3 className="font-medium text-gray-900 mb-1">{note.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {note.content.substring(0, 100)}...
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Recent Notes */}
        {recentNotes.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="size-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin notas aun</h3>
            <p className="text-gray-600 mb-4">Empieza a aprender creando tu primera nota</p>
            <Link
              href="/new-query"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
            >
              <Plus className="size-5" />
              Nueva Consulta
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
