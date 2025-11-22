"use client"

import { useState, useEffect, useMemo } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { useTheme } from "@/lib/store/theme-context"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'
import {
  Download,
  TrendingUp,
  Award,
  Clock,
  Target,
  Calendar,
  User,
  Mail,
  Settings,
  LogOut,
  Moon,
  Sun,
  Bell
} from "lucide-react"
import { toast } from "sonner"
import Link from 'next/link'

interface ProfileStats {
  totalNotes: number
  understoodNotes: number
  studyStreak: number
  totalStudyTime: number
}

interface AreaProgress {
  name: string
  progress: number
  color: string
}

interface Badge {
  name: string
  description: string
  earned: boolean
  icon: string
}

interface ActivityItem {
  type: 'completed' | 'started' | 'badge'
  title: string
  time: string
}

export default function ProfilePage() {
  const { session, notes } = useKnowledge()
  const { isDark, toggleTheme } = useTheme()
  const router = useRouter()
  const [notifications, setNotifications] = useState(true)
  const [loading, setLoading] = useState(true)
  const [memberSince, setMemberSince] = useState('Noviembre 2024')

  // Calculate stats from notes
  const stats: ProfileStats = useMemo(() => {
    const totalNotes = notes.length
    const understoodNotes = notes.filter(n => n.status === 'understood').length
    return {
      totalNotes,
      understoodNotes,
      studyStreak: 5, // Mock for now
      totalStudyTime: totalNotes * 15 // Estimate 15 min per note
    }
  }, [notes])

  // Calculate area progress
  const areasProgress: AreaProgress[] = useMemo(() => {
    const areaMap: Record<string, { total: number; understood: number }> = {}

    notes.forEach(note => {
      const area = detectArea(note.title, note.content)
      if (!areaMap[area]) {
        areaMap[area] = { total: 0, understood: 0 }
      }
      areaMap[area].total++
      if (note.status === 'understood') {
        areaMap[area].understood++
      }
    })

    const areaColors: Record<string, string> = {
      'Programacion': '#3b82f6',
      'Matematicas': '#8b5cf6',
      'Ciencias': '#22c55e',
      'Historia': '#f97316',
      'Idiomas': '#ec4899',
      'Arte': '#8b5cf6',
      'Finanzas': '#eab308',
      'Humanidades': '#ec4899',
      'General': '#C9B7F3'
    }

    return Object.entries(areaMap).map(([name, data]) => ({
      name,
      progress: data.total > 0 ? Math.round((data.understood / data.total) * 100) : 0,
      color: areaColors[name] || '#C9B7F3'
    }))
  }, [notes])

  // Learning paths (mock data based on notes)
  const learningPaths = useMemo(() => {
    return [
      { id: '1', name: 'Fundamentos de Programacion', progress: stats.totalNotes > 0 ? Math.min(100, stats.understoodNotes * 20) : 0 },
      { id: '2', name: 'Matematicas Basicas', progress: Math.min(100, stats.totalNotes * 10) },
      { id: '3', name: 'Desarrollo Personal', progress: Math.min(100, stats.understoodNotes * 15) }
    ]
  }, [stats])

  // Weekly activity (mock data)
  const weekDays = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
  const weekActivity = [45, 60, 30, 75, 50, 0, 20]

  // Central topics mastered
  const centralTopicsMastered = useMemo(() => {
    return notes
      .filter(n => n.status === 'understood')
      .slice(0, 6)
      .map(n => ({
        id: n.id || n.slug,
        name: n.title,
        area: detectArea(n.title, n.content)
      }))
  }, [notes])

  // Badges
  const badges: Badge[] = useMemo(() => [
    { name: 'Primeros Pasos', description: 'Completo su primer nodo', earned: stats.understoodNotes >= 1, icon: '🎯' },
    { name: 'Explorador', description: 'Estudio 5 conceptos', earned: stats.totalNotes >= 5, icon: '🗺️' },
    { name: 'Maestro de Fundamentos', description: 'Completo un area al 100%', earned: areasProgress.some(a => a.progress === 100), icon: '🏆' },
    { name: 'Racha Ardiente', description: '7 dias consecutivos', earned: stats.studyStreak >= 7, icon: '🔥' },
    { name: 'Enciclopedia', description: 'Completo 20 nodos', earned: stats.understoodNotes >= 20, icon: '📚' },
    { name: 'Leyenda', description: 'Completo todas las rutas', earned: false, icon: '⭐' }
  ], [stats, areasProgress])

  // Recent activity (mock based on notes)
  const recentActivity: ActivityItem[] = useMemo(() => {
    const activities: ActivityItem[] = []
    const recentNotes = notes.slice(0, 4)

    recentNotes.forEach((note, i) => {
      if (note.status === 'understood') {
        activities.push({
          type: 'completed',
          title: `Completaste "${note.title}"`,
          time: i === 0 ? 'Hace 2 horas' : i === 1 ? 'Hace 3 horas' : 'Ayer'
        })
      } else {
        activities.push({
          type: 'started',
          title: `Comenzaste "${note.title}"`,
          time: i === 0 ? 'Hace 1 hora' : 'Hace 4 horas'
        })
      }
    })

    if (badges.some(b => b.earned)) {
      activities.push({
        type: 'badge',
        title: 'Desbloqueaste "Primeros Pasos"',
        time: 'Hace 2 dias'
      })
    }

    return activities.slice(0, 4)
  }, [notes, badges])

  useEffect(() => {
    setLoading(false)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Sesion cerrada")
    router.push('/')
  }

  const handleExportGraph = () => {
    toast.success("Exportando grafo...")
    router.push('/graph')
  }

  const handleExportPDF = () => {
    toast.success("Generando PDF...")
    // TODO: Implement PDF export
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: '#C9B7F3' }} />
          <p style={{ color: 'var(--muted-foreground)' }}>Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto transition-colors duration-300" style={{ backgroundColor: '#F6F5F2' }}>
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3" style={{ color: '#222222' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                <User className="size-5" style={{ color: '#9575CD' }} />
              </div>
              Tu Perfil de Aprendizaje
            </h2>
            <p className="text-sm mt-2" style={{ color: '#6D6D6D' }}>Miembro desde: {memberSince}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportGraph}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
              style={{ backgroundColor: 'white', color: '#6D6D6D', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}
            >
              <Download className="size-4" />
              Exportar Grafo
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
              style={{ backgroundColor: '#FFD9D9', color: '#222222' }}
            >
              <Download className="size-4" />
              Resumen PDF
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                <Target className="size-5" style={{ color: '#9575CD' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>{stats.understoodNotes}</p>
                <p className="text-xs" style={{ color: '#6D6D6D' }}>Completados</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
                <Clock className="size-5" style={{ color: '#3B82F6' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</p>
                <p className="text-xs" style={{ color: '#6D6D6D' }}>Tiempo Total</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0E6' }}>
                <TrendingUp className="size-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>{stats.studyStreak} dias</p>
                <p className="text-xs" style={{ color: '#6D6D6D' }}>Racha Actual</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Progress by Area */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                <Target className="size-5" style={{ color: '#9575CD' }} />
              </div>
              <h3 className="font-semibold" style={{ color: '#222222' }}>Progreso por Area</h3>
            </div>
            <div className="space-y-4">
              {areasProgress.length > 0 ? areasProgress.map((area) => (
                <div key={area.name}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: '#222222' }}>{area.name}</span>
                    <span className="text-sm font-semibold" style={{ color: '#9575CD' }}>{area.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F6F5F2' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${area.progress}%`, backgroundColor: '#9575CD' }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-center py-4 text-sm" style={{ color: '#6D6D6D' }}>Crea notas para ver tu progreso</p>
              )}
            </div>
          </div>

          {/* Learning Paths Progress */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
                <TrendingUp className="size-5" style={{ color: '#3B82F6' }} />
              </div>
              <h3 className="font-semibold" style={{ color: '#222222' }}>Rutas de Aprendizaje</h3>
            </div>
            <div className="space-y-4">
              {learningPaths.map(path => (
                <div key={path.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: '#222222' }}>{path.name}</span>
                    <span className="text-sm font-semibold" style={{ color: '#3B82F6' }}>{path.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F6F5F2' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${path.progress}%`, backgroundColor: '#3B82F6' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link href="/tree" className="mt-4 text-sm font-medium hover:underline transition-colors block" style={{ color: '#3B82F6' }}>
              Ver todas las rutas →
            </Link>
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0E6' }}>
              <Calendar className="size-5" style={{ color: '#F59E0B' }} />
            </div>
            <h3 className="font-semibold" style={{ color: '#222222' }}>Actividad Esta Semana</h3>
          </div>
          <div className="flex items-end justify-between gap-3 h-32">
            {weekDays.map((day, index) => {
              const height = (weekActivity[index] / Math.max(...weekActivity)) * 100
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className="w-full rounded-t-lg relative group transition-all duration-300 hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        minHeight: weekActivity[index] > 0 ? '16px' : '0',
                        backgroundColor: '#FFD9D9'
                      }}
                    >
                      <div
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        style={{ backgroundColor: '#222222', color: 'white' }}
                      >
                        {weekActivity[index]} min
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#6D6D6D' }}>{day}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm" style={{ color: '#6D6D6D' }}>
            <Clock className="size-4" />
            <span>Total: {weekActivity.reduce((a, b) => a + b, 0)} min</span>
          </div>
        </div>

        {/* Central Topics Mastered */}
        {centralTopicsMastered.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D4F5E9' }}>
                <Award className="size-5" style={{ color: '#10B981' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#222222' }}>Temas Dominados</h3>
                <p className="text-xs" style={{ color: '#6D6D6D' }}>{centralTopicsMastered.length} completados</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {centralTopicsMastered.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center gap-2 p-3 rounded-xl transition-all hover:scale-105 cursor-pointer"
                  style={{ backgroundColor: '#D4F5E9' }}
                >
                  <span className="text-lg">⭐</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: '#222222' }}>{topic.name}</p>
                    <p className="text-xs" style={{ color: '#10B981' }}>{topic.area}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/graph" className="mt-4 text-sm font-medium hover:underline transition-colors block" style={{ color: '#9575CD' }}>
              Ver en el grafo →
            </Link>
          </div>
        )}

        {/* Badges */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
              <Award className="size-5" style={{ color: '#9575CD' }} />
            </div>
            <h3 className="font-semibold" style={{ color: '#222222' }}>Logros y Badges</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.name}
                className={`p-4 rounded-xl transition-all ${badge.earned ? 'hover:scale-105 cursor-pointer' : 'opacity-50'}`}
                style={{ backgroundColor: badge.earned ? '#FFF0E6' : '#F6F5F2' }}
              >
                <div className="text-3xl mb-2 text-center">{badge.icon}</div>
                <h4 className="text-center mb-1 font-semibold text-sm" style={{ color: badge.earned ? '#222222' : '#9A9A9A' }}>
                  {badge.name}
                </h4>
                <p className="text-xs text-center mb-2" style={{ color: badge.earned ? '#6D6D6D' : '#9A9A9A' }}>
                  {badge.description}
                </p>
                {badge.earned && (
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FFD9D9', color: '#222222' }}>
                      <Award className="size-3" />
                      Desbloqueado
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
                <Clock className="size-5" style={{ color: '#3B82F6' }} />
              </div>
              <h3 className="font-semibold" style={{ color: '#222222' }}>Actividad Reciente</h3>
            </div>
            <div className="space-y-2">
              {recentActivity.map((activity, index) => {
                const colors = {
                  completed: { bg: '#D4F5E9', accent: '#10B981' },
                  started: { bg: '#FFF0E6', accent: '#F59E0B' },
                  badge: { bg: '#E6DAFF', accent: '#9575CD' }
                }
                const style = colors[activity.type]

                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                    style={{ backgroundColor: style.bg }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.accent }} />
                    <div className="flex-1">
                      <p className="font-medium text-sm" style={{ color: '#222222' }}>{activity.title}</p>
                      <p className="text-xs" style={{ color: style.accent }}>{activity.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F6F5F2' }}>
              <Settings className="size-5" style={{ color: '#6D6D6D' }} />
            </div>
            <h3 className="font-semibold" style={{ color: '#222222' }}>Configuracion</h3>
          </div>
          <div className="space-y-3">
            {/* Dark Mode */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#F6F5F2' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'white' }}>
                  {isDark ? <Moon className="size-4" style={{ color: '#6D6D6D' }} /> : <Sun className="size-4" style={{ color: '#6D6D6D' }} />}
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#222222' }}>Modo Oscuro</p>
                  <p className="text-xs" style={{ color: '#6D6D6D' }}>Cambiar apariencia</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="w-12 h-6 rounded-full transition-all p-0.5"
                style={{ backgroundColor: isDark ? '#9575CD' : '#E6E6E6' }}
              >
                <div
                  className="w-5 h-5 bg-white rounded-full transition-transform"
                  style={{ transform: isDark ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#F6F5F2' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'white' }}>
                  <Bell className="size-4" style={{ color: '#6D6D6D' }} />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#222222' }}>Notificaciones</p>
                  <p className="text-xs" style={{ color: '#6D6D6D' }}>Recordatorios de estudio</p>
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className="w-12 h-6 rounded-full transition-all p-0.5"
                style={{ backgroundColor: notifications ? '#9575CD' : '#E6E6E6' }}
              >
                <div
                  className="w-5 h-5 bg-white rounded-full transition-transform"
                  style={{ transform: notifications ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#FFD9D9', color: '#222222' }}
            >
              <LogOut className="size-4" />
              Cerrar Sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function
function detectArea(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()
  if (text.includes('matemat') || text.includes('algebra') || text.includes('calcul')) return 'Matematicas'
  if (text.includes('program') || text.includes('codigo') || text.includes('algoritm')) return 'Programacion'
  if (text.includes('fisica') || text.includes('quimica') || text.includes('biolog')) return 'Ciencias'
  if (text.includes('histor') || text.includes('geograf')) return 'Historia'
  if (text.includes('idioma') || text.includes('ingles')) return 'Idiomas'
  if (text.includes('arte') || text.includes('musica')) return 'Arte'
  if (text.includes('econom') || text.includes('finanz')) return 'Finanzas'
  if (text.includes('filosof') || text.includes('psicolog')) return 'Humanidades'
  return 'General'
}
