"use client"

import { useEffect, useState } from "react"
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { BookOpen, TrendingUp, Clock, Target, ArrowRight, Plus, MapPin, Flame, Lightbulb, Star } from "lucide-react"
import Link from "next/link"

interface Area {
  id: string
  name: string
  color: string
  icon: string
  progress?: number
  total?: number
  understood?: number
  hours?: number
}

interface DashboardStats {
  total_concepts: number
  understood_concepts: number
  in_progress_concepts: number
  total_study_time: number
}

// Circular progress component
function CircularProgress({ percentage, color, size = 100, strokeWidth = 8 }: { percentage: number; color: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>
          {percentage}%
        </span>
      </div>
    </div>
  )
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
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    async function loadDashboardData() {
      if (!session?.user) {
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Load study streak
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('study_streak')
        .eq('user_id', session.user.id)
        .order('study_streak', { ascending: false })
        .limit(1)
        .single()

      if (progressData?.study_streak) {
        setStreak(progressData.study_streak)
      }

      // Load areas with progress
      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)
        .order('sort_order')

      if (areasData) {
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
              progress: total ? Math.round(((understood || 0) / total) * 100) : 0,
              hours: (total || 0) * 2 // Estimated 2 hours per concept
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
        total_study_time: (totalConcepts || 0) * 2
      })

      setLoading(false)
    }

    loadDashboardData()
  }, [session])

  const progressPercent = stats.total_concepts > 0
    ? Math.round((stats.understood_concepts / stats.total_concepts) * 100)
    : 0

  const completedHours = stats.understood_concepts * 2
  const remainingHours = (stats.total_concepts - stats.understood_concepts) * 2

  const recentNotes = notes.slice(-3).reverse()
  const lastStudiedNote = recentNotes[0]

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      <div className="max-w-7xl mx-auto p-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold mb-2" style={{ color: '#1E1E1E' }}>
              Hola! 👋
            </h1>
            <p className="text-lg" style={{ color: '#646464' }}>
              Continua tu camino de aprendizaje con calma y enfoque
            </p>
          </div>

          <Link
            href="/new-query"
            className="flex items-center gap-2 px-6 py-3 text-white rounded-3xl hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
            }}
          >
            <Plus className="size-5" />
            Nueva Consulta
          </Link>
        </div>

        {/* Hero Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Progress Card */}
          <div
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 relative overflow-hidden"
            style={{
              backgroundColor: '#E6DEF9',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #D6C9F5'
            }}
          >
            <div
              className="absolute top-0 right-0 w-20 h-20"
              style={{
                backgroundColor: '#D6C9F5',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 rounded-2xl bg-white">
                <Target className="size-6" style={{ color: '#C9B7F3' }} />
              </div>
              <span className="text-4xl font-bold" style={{ color: '#6B5B95' }}>
                {loading ? '-' : `${progressPercent}%`}
              </span>
            </div>
            <h3 className="font-semibold mb-1 relative z-10" style={{ color: '#1E1E1E' }}>Progreso Global</h3>
            <p className="text-sm relative z-10" style={{ color: '#646464' }}>
              {loading ? '-' : `${stats.understood_concepts} de ${stats.total_concepts} temas`}
            </p>
            <div className="mt-4 h-2.5 rounded-full overflow-hidden relative z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000 relative"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: '#C9B7F3'
                }}
              />
            </div>
          </div>

          {/* In Progress Card */}
          <div
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 relative overflow-hidden"
            style={{
              backgroundColor: '#FFF4D4',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #FFE9A9'
            }}
          >
            <div
              className="absolute top-0 right-0 w-20 h-20"
              style={{
                backgroundColor: '#FFE9A9',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 rounded-2xl bg-white">
                <BookOpen className="size-6" style={{ color: '#F8C94E' }} />
              </div>
              <span className="text-4xl font-bold" style={{ color: '#B89C3C' }}>
                {loading ? '-' : stats.in_progress_concepts}
              </span>
            </div>
            <h3 className="font-semibold mb-1 relative z-10" style={{ color: '#1E1E1E' }}>En Progreso</h3>
            <p className="text-sm relative z-10" style={{ color: '#646464' }}>Temas activos ahora</p>
            {stats.in_progress_concepts > 0 && (
              <Link
                href="/tree"
                className="mt-4 text-sm font-medium hover:underline relative z-10 block"
                style={{ color: '#B89C3C' }}
              >
                Ver detalles →
              </Link>
            )}
          </div>

          {/* Time Card */}
          <div
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 relative overflow-hidden"
            style={{
              backgroundColor: '#CADFFF',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #A3D4FF'
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  backgroundColor: '#A3D4FF',
                  opacity: 0.2,
                  top: `${20 + i * 12}%`,
                  right: `${10 + (i % 3) * 5}%`
                }}
              />
            ))}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 rounded-2xl bg-white">
                <Clock className="size-6" style={{ color: '#7FBFFF' }} />
              </div>
              <span className="text-4xl font-bold" style={{ color: '#5A8FCC' }}>
                {loading ? '-' : `${remainingHours}h`}
              </span>
            </div>
            <h3 className="font-semibold mb-1 relative z-10" style={{ color: '#1E1E1E' }}>Tiempo Restante</h3>
            <p className="text-sm relative z-10" style={{ color: '#646464' }}>{completedHours}h completadas</p>
            <div className="mt-4 h-2.5 rounded-full overflow-hidden relative z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000 relative"
                style={{
                  width: `${stats.total_study_time > 0 ? (completedHours / stats.total_study_time) * 100 : 0}%`,
                  backgroundColor: '#7FBFFF'
                }}
              />
            </div>
          </div>

          {/* Streak Card */}
          <div
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 relative overflow-hidden"
            style={{
              backgroundColor: '#FFE8CC',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #FFD5A5'
            }}
          >
            <div className="absolute top-2 right-2 text-3xl opacity-10">🔥</div>
            <div className="absolute bottom-4 right-6 text-2xl opacity-10">✨</div>

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 rounded-2xl bg-white">
                <Flame className="size-6" style={{ color: '#FF9D5D' }} />
              </div>
              <span className="text-4xl font-bold" style={{ color: '#CC7E4A' }}>
                {loading ? '-' : streak}
              </span>
            </div>
            <h3 className="font-semibold mb-1 relative z-10" style={{ color: '#1E1E1E' }}>Racha Actual</h3>
            <p className="text-sm relative z-10" style={{ color: '#646464' }}>dias consecutivos 🔥</p>
            <Link
              href="/profile"
              className="mt-4 text-sm font-medium hover:underline relative z-10 block"
              style={{ color: '#CC7E4A' }}
            >
              Ver perfil →
            </Link>
          </div>
        </div>

        {/* Continue Studying - Hero Section */}
        {lastStudiedNote && (
          <div
            className="relative rounded-3xl p-8 text-white overflow-hidden"
            style={{
              backgroundColor: '#C9B7F3',
              boxShadow: '0px 8px 24px rgba(201, 183, 243, 0.4)'
            }}
          >
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-32 translate-x-32"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            />
            <div
              className="absolute top-1/4 right-1/4 w-32 h-32 rotate-45"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '20px'
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-48 h-48 rounded-full translate-y-24 -translate-x-24"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="size-6" />
                  <span className="text-sm font-medium opacity-90">Continuar donde dejaste</span>
                </div>
                <h3 className="text-4xl font-bold mb-3">{lastStudiedNote.title}</h3>
                <p className="opacity-90 mb-6 text-lg">
                  General • Intermedio
                </p>
                <Link
                  href={`/study?topic=${encodeURIComponent(lastStudiedNote.title)}`}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white rounded-3xl hover:scale-105 transition-all duration-300 font-semibold shadow-lg"
                  style={{ color: '#C9B7F3' }}
                >
                  <span>Continuar Estudiando</span>
                  <ArrowRight className="size-5" />
                </Link>
              </div>
              <div className="hidden lg:block">
                <div
                  className="w-40 h-40 backdrop-blur-sm rounded-3xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  <BookOpen className="size-20 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress by Area - Circular Progress */}
        {areas.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold mb-2" style={{ color: '#1E1E1E' }}>
                  Progreso por Area
                </h2>
                <p style={{ color: '#646464' }}>
                  Visualiza tu avance en cada area de conocimiento
                </p>
              </div>
              <Link
                href="/tree"
                className="px-6 py-3 font-medium flex items-center gap-2 rounded-2xl hover:scale-105 transition-all duration-300"
                style={{
                  color: '#C9B7F3',
                  backgroundColor: 'rgba(201, 183, 243, 0.1)'
                }}
              >
                Ver ruta completa
                <MapPin className="size-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-6">
              {areas.map(area => (
                <Link
                  key={area.id}
                  href="/tree"
                  className="rounded-3xl p-6 cursor-pointer group transition-all duration-300 hover:scale-105"
                  style={{
                    backgroundColor: 'white',
                    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
                    border: `2px solid ${area.color}20`
                  }}
                >
                  <div className="flex justify-center mb-4">
                    <CircularProgress
                      percentage={area.progress || 0}
                      color={area.color}
                      size={80}
                      strokeWidth={6}
                    />
                  </div>

                  <div className="text-center">
                    <div className="text-3xl mb-2">{area.icon || '📚'}</div>
                    <h3 className="font-semibold mb-2 text-xs leading-tight" style={{ color: '#1E1E1E' }}>
                      {area.name}
                    </h3>
                    <p className="text-xs mb-2" style={{ color: '#646464' }}>
                      {area.understood || 0}/{area.total || 0} temas
                    </p>

                    <div
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                      style={{
                        backgroundColor: `${area.color}20`,
                        color: area.color
                      }}
                    >
                      <Clock className="size-3" />
                      {area.hours || 0}h
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {(stats.in_progress_concepts > 0 || recentNotes.length > 0) && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ color: '#1E1E1E' }}>
              Recomendaciones para ti
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* In Progress Reminder */}
              {stats.in_progress_concepts > 0 && (
                <div
                  className="rounded-3xl p-6 hover:scale-105 transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #FFE9A9 0%, #FFF4D4 100%)',
                    boxShadow: '0px 4px 14px rgba(255, 233, 169, 0.3)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="p-3 rounded-2xl backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
                    >
                      <TrendingUp className="size-7" style={{ color: '#B89C3C' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2 text-lg" style={{ color: '#1E1E1E' }}>
                        Temas en progreso
                      </h3>
                      <p className="text-sm mb-4" style={{ color: '#646464' }}>
                        Tienes {stats.in_progress_concepts} tema(s) en progreso. Continua para completarlos!
                      </p>
                      <Link
                        href="/tree"
                        className="inline-block px-5 py-3 bg-white rounded-2xl hover:scale-105 transition-all duration-300"
                        style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)' }}
                      >
                        <span className="font-medium" style={{ color: '#1E1E1E' }}>Ver todos</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Topics */}
              {recentNotes.length > 0 && (
                <div
                  className="rounded-3xl p-6 hover:scale-105 transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #CADFFF 0%, #E6F0FF 100%)',
                    boxShadow: '0px 4px 14px rgba(202, 223, 255, 0.3)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="p-3 rounded-2xl backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
                    >
                      <Star className="size-7" style={{ color: '#5A8FCC' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2 text-lg" style={{ color: '#1E1E1E' }}>
                        Tus notas recientes
                      </h3>
                      <p className="text-sm mb-4" style={{ color: '#646464' }}>
                        Revisa lo que has aprendido recientemente
                      </p>
                      <div className="space-y-2">
                        {recentNotes.slice(0, 2).map(note => (
                          <Link
                            key={note.slug}
                            href={`/study?topic=${encodeURIComponent(note.title)}`}
                            className="block px-5 py-3 bg-white rounded-2xl hover:scale-105 transition-all duration-300"
                            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)' }}
                          >
                            <span className="font-medium" style={{ color: '#1E1E1E' }}>{note.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/graph"
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 text-left group"
            style={{
              background: 'linear-gradient(135deg, #D6C9F5 0%, #E6DEF9 100%)',
              boxShadow: '0px 4px 14px rgba(214, 201, 245, 0.3)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="p-3 rounded-2xl backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
              >
                <MapPin className="size-7" style={{ color: '#9575CD' }} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1" style={{ color: '#1E1E1E' }}>
                  Explorar Grafo
                </h3>
                <p className="text-sm" style={{ color: '#646464' }}>
                  Visualiza conexiones
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/library"
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 text-left group"
            style={{
              background: 'linear-gradient(135deg, #A3D4FF 0%, #CADFFF 100%)',
              boxShadow: '0px 4px 14px rgba(163, 212, 255, 0.3)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="p-3 rounded-2xl backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
              >
                <BookOpen className="size-7" style={{ color: '#5A8FCC' }} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1" style={{ color: '#1E1E1E' }}>
                  Biblioteca
                </h3>
                <p className="text-sm" style={{ color: '#646464' }}>
                  Gestiona areas y temas
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/tree"
            className="rounded-3xl p-6 hover:scale-105 transition-all duration-300 text-left group"
            style={{
              background: 'linear-gradient(135deg, #B9E2B1 0%, #D4F0CE 100%)',
              boxShadow: '0px 4px 14px rgba(185, 226, 177, 0.3)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="p-3 rounded-2xl backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
              >
                <Target className="size-7" style={{ color: '#5FA857' }} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1" style={{ color: '#1E1E1E' }}>
                  Ver Ruta
                </h3>
                <p className="text-sm" style={{ color: '#646464' }}>
                  Planifica tu progreso
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Empty State */}
        {recentNotes.length === 0 && !loading && (
          <div
            className="rounded-3xl p-8 text-center"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#E6DEF9' }}
            >
              <BookOpen className="size-10" style={{ color: '#C9B7F3' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E1E1E' }}>Sin notas aun</h3>
            <p className="mb-6" style={{ color: '#646464' }}>Empieza a aprender creando tu primera nota</p>
            <Link
              href="/new-query"
              className="inline-flex items-center gap-2 px-8 py-4 text-white rounded-3xl hover:scale-105 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
              }}
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
