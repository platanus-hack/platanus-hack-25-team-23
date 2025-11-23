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
  Bell,
  MessageCircle,
  Link2,
  Check,
  X
} from "lucide-react"
import { WhatsAppConnect } from "@/components/settings/WhatsAppConnect"
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
  const { isDark, setTheme, theme } = useTheme()
  const router = useRouter()
  const [notifications, setNotifications] = useState(true)
  const [loading, setLoading] = useState(true)
  const [memberSince, setMemberSince] = useState('Noviembre 2024')
  const [calendarConnected, setCalendarConnected] = useState(false)

  // Check Google Calendar connection
  useEffect(() => {
    const token = localStorage.getItem('google_calendar_token')
    setCalendarConnected(!!token)
  }, [])

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
      <div className="flex-1 flex items-center justify-center transition-colors duration-300 bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    )
  }

    return (
    <div className="flex-1 overflow-y-auto transition-colors duration-300 bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3 text-foreground">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                <User className="size-5 text-primary" />
              </div>
              Tu Perfil de Aprendizaje
            </h2>
            <p className="text-sm mt-2 text-muted-foreground">Miembro desde: {memberSince}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportGraph}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2 bg-card text-muted-foreground hover:text-foreground border border-border shadow-sm"
            >
              <Download className="size-4" />
              Exportar Grafo
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Download className="size-4" />
              Resumen PDF
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                <Target className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.understoodNotes}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                <Clock className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</p>
                <p className="text-xs text-muted-foreground">Tiempo Total</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
                <TrendingUp className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.studyStreak} dias</p>
                <p className="text-xs text-muted-foreground">Racha Actual</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Progress by Area */}
          <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                <Target className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Progreso por Area</h3>
            </div>
            <div className="space-y-4">
              {areasProgress.length > 0 ? areasProgress.map((area) => (
                <div key={area.name}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{area.name}</span>
                    <span className="text-sm font-semibold text-primary">{area.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-1000 bg-primary"
                      style={{ width: `${area.progress}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-center py-4 text-sm text-muted-foreground">Crea notas para ver tu progreso</p>
              )}
            </div>
          </div>

          {/* Learning Paths Progress */}
          <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                <TrendingUp className="size-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-foreground">Rutas de Aprendizaje</h3>
            </div>
            <div className="space-y-4">
              {learningPaths.map(path => (
                <div key={path.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{path.name}</span>
                    <span className="text-sm font-semibold text-blue-500">{path.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-1000 bg-blue-500"
                      style={{ width: `${path.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link href="/tree" className="mt-4 text-sm font-medium hover:underline transition-colors block text-blue-500">
              Ver todas las rutas →
            </Link>
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
              <Calendar className="size-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-foreground">Actividad Esta Semana</h3>
          </div>
          <div className="flex items-end justify-between gap-3 h-32">
            {weekDays.map((day, index) => {
              const height = (weekActivity[index] / Math.max(...weekActivity)) * 100
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className="w-full rounded-t-lg relative group transition-all duration-300 hover:opacity-80 bg-primary/20"
                      style={{
                        height: `${height}%`,
                        minHeight: weekActivity[index] > 0 ? '16px' : '0'
                      }}
                    >
                      <div
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-foreground text-background"
                      >
                        {weekActivity[index]} min
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{day}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>Total: {weekActivity.reduce((a, b) => a + b, 0)} min</span>
          </div>
        </div>

        {/* Central Topics Mastered */}
        {centralTopicsMastered.length > 0 && (
          <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10">
                <Award className="size-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Temas Dominados</h3>
                <p className="text-xs text-muted-foreground">{centralTopicsMastered.length} completados</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {centralTopicsMastered.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center gap-2 p-3 rounded-xl transition-all hover:scale-105 cursor-pointer bg-emerald-500/10"
                >
                  <span className="text-lg">⭐</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">{topic.name}</p>
                    <p className="text-xs text-emerald-500">{topic.area}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/graph" className="mt-4 text-sm font-medium hover:underline transition-colors block text-primary">
              Ver en el grafo →
            </Link>
          </div>
        )}

        {/* Badges */}
        <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <Award className="size-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Logros y Badges</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.name}
                className={`p-4 rounded-xl transition-all ${badge.earned ? 'hover:scale-105 cursor-pointer bg-primary/5' : 'opacity-50 bg-muted'}`}
              >
                <div className="text-3xl mb-2 text-center">{badge.icon}</div>
                <h4 className={`text-center mb-1 font-semibold text-sm ${badge.earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {badge.name}
                </h4>
                <p className="text-xs text-center mb-2 text-muted-foreground">
                  {badge.description}
                </p>
                {badge.earned && (
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary">
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
          <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                <Clock className="size-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-foreground">Actividad Reciente</h3>
            </div>
            <div className="space-y-2">
              {recentActivity.map((activity, index) => {
                const colors = {
                  completed: { bg: 'bg-emerald-500/10', accent: 'text-emerald-500', dot: 'bg-emerald-500' },
                  started: { bg: 'bg-amber-500/10', accent: 'text-amber-500', dot: 'bg-amber-500' },
                  badge: { bg: 'bg-primary/10', accent: 'text-primary', dot: 'bg-primary' }
                }
                const style = colors[activity.type]

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01] ${style.bg}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">{activity.title}</p>
                      <p className={`text-xs ${style.accent}`}>{activity.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Integraciones */}
        <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <Link2 className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Integraciones</h3>
              <p className="text-xs text-muted-foreground">Conecta tus servicios para una mejor experiencia</p>
            </div>
          </div>
          <div className="space-y-4">
            {/* WhatsApp */}
            <WhatsAppConnect />

            {/* Google Calendar */}
            <div className={`p-4 rounded-2xl border-2 ${calendarConnected ? 'border-blue-500/20 bg-blue-500/5' : 'border-border'}`}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${calendarConnected ? 'bg-blue-500/10' : 'bg-muted'}`}>
                    <Calendar className={`size-6 ${calendarConnected ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Google Calendar</h4>
                    <p className="text-sm text-muted-foreground">
                      {calendarConnected ? 'Conectado' : 'Sincroniza tus eventos y bloques de estudio'}
                    </p>
                  </div>
                </div>
                {calendarConnected ? (
                  <div className="flex items-center gap-2">
                    <Check className="size-5 text-blue-500" />
                    <button
                      onClick={() => {
                        localStorage.removeItem('google_calendar_token')
                        localStorage.removeItem('google_calendar_refresh_token')
                        localStorage.removeItem('google_calendar_token_expiry')
                        setCalendarConnected(false)
                        toast.success('Google Calendar desconectado')
                      }}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/calendar"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all"
                  >
                    Conectar
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-2xl p-5 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted">
              <Settings className="size-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Configuracion</h3>
          </div>
          <div className="space-y-3">
            {/* Theme Selector */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 rounded-xl bg-muted/50 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-card">
                  {isDark ? <Moon className="size-4 text-muted-foreground" /> : <Sun className="size-4 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">Tema</p>
                  <p className="text-xs text-muted-foreground">Apariencia de la aplicación</p>
                </div>
              </div>
              <div className="flex bg-muted rounded-lg p-1 gap-1">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${theme === 'light' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Claro
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${theme === 'dark' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Oscuro
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${theme === 'system' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Sistema
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 rounded-xl bg-muted/50 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-card">
                  <Bell className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">Notificaciones</p>
                  <p className="text-xs text-muted-foreground">Recordatorios de estudio</p>
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full transition-all p-0.5 ${notifications ? 'bg-primary' : 'bg-muted-foreground/20'}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] bg-destructive/10 text-destructive hover:bg-destructive/20"
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
