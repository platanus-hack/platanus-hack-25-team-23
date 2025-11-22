"use client"

import { useState, useEffect, useMemo } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
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
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
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
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F6F8FA' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: '#C9B7F3' }} />
          <p style={{ color: '#646464' }}>Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}>
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div
          className="rounded-3xl p-8 text-white relative overflow-hidden"
          style={{
            backgroundColor: '#C9B7F3',
            boxShadow: '0px 8px 24px rgba(201, 183, 243, 0.4)'
          }}
        >
          {/* Background decoration - geometric shapes */}
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
          <div
            className="absolute bottom-1/4 left-1/3 w-20 h-20"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '50% 0 50% 0'
            }}
          />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <h2 className="text-4xl font-bold mb-3">
                Tu Perfil de Aprendizaje
              </h2>
              <p className="text-white/90 text-lg mb-8">
                Miembro desde: {memberSince}
              </p>
              <div className="flex gap-8">
                <div>
                  <p className="text-white/80 text-sm mb-2">Nodos Completados</p>
                  <p className="text-4xl font-bold">{stats.understoodNotes}</p>
                </div>
                <div>
                  <p className="text-white/80 text-sm mb-2">Tiempo Total</p>
                  <p className="text-4xl font-bold">{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</p>
                </div>
                <div>
                  <p className="text-white/80 text-sm mb-2">Racha Actual</p>
                  <p className="text-4xl font-bold">{stats.studyStreak} dias 🔥</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportGraph}
                className="px-6 py-3 bg-white rounded-3xl hover:scale-105 transition-all duration-300 flex items-center gap-2 font-semibold relative overflow-hidden group"
                style={{ color: '#C9B7F3', boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.1)' }}
              >
                <div className="absolute inset-0 bg-purple-50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                <Download className="size-5 relative z-10" />
                <span className="relative z-10">Exportar Grafo</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="px-6 py-3 bg-white rounded-3xl hover:scale-105 transition-all duration-300 flex items-center gap-2 font-semibold relative overflow-hidden group"
                style={{ color: '#C9B7F3', boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.1)' }}
              >
                <div className="absolute inset-0 bg-purple-50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                <Download className="size-5 relative z-10" />
                <span className="relative z-10">Resumen PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Progress by Area */}
          <div
            className="rounded-3xl p-6 relative overflow-hidden"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #F0F0F0'
            }}
          >
            {/* Decorative corner accent */}
            <div
              className="absolute top-0 right-0 w-24 h-24"
              style={{
                backgroundColor: '#E6DEF9',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="p-3 rounded-2xl"
                style={{ backgroundColor: '#E6DEF9' }}
              >
                <Target className="size-6" style={{ color: '#9575CD' }} />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
                Progreso por Area
              </h3>
            </div>
            <div className="space-y-5 relative z-10">
              {areasProgress.length > 0 ? areasProgress.map((area) => (
                <div key={area.name}>
                  <div className="flex justify-between mb-2" style={{ color: '#646464' }}>
                    <span className="font-medium">{area.name}</span>
                    <span className="font-semibold">{area.progress}%</span>
                  </div>
                  <div
                    className="h-3 rounded-full overflow-hidden relative"
                    style={{ backgroundColor: '#F6F6F6' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-1000 relative"
                      style={{
                        width: `${area.progress}%`,
                        backgroundColor: '#C9B7F3'
                      }}
                    >
                      {/* Animated stripes pattern */}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 20px)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-center py-4" style={{ color: '#646464' }}>Crea notas para ver tu progreso</p>
              )}
            </div>
          </div>

          {/* Learning Paths Progress */}
          <div
            className="rounded-3xl p-6 relative overflow-hidden"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #F0F0F0'
            }}
          >
            {/* Decorative corner accent - different pattern */}
            <div
              className="absolute top-0 right-0 w-24 h-24"
              style={{
                backgroundColor: '#CADFFF',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div
              className="absolute top-6 right-6 w-12 h-12 rounded-full"
              style={{ backgroundColor: '#A3D4FF', opacity: 0.3 }}
            />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="p-3 rounded-2xl"
                style={{ backgroundColor: '#CADFFF' }}
              >
                <TrendingUp className="size-6" style={{ color: '#5A8FCC' }} />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
                Rutas de Aprendizaje
              </h3>
            </div>
            <div className="space-y-5 relative z-10">
              {learningPaths.map(path => (
                <div key={path.id}>
                  <div className="flex justify-between mb-2" style={{ color: '#646464' }}>
                    <span className="font-medium">{path.name}</span>
                    <span className="font-semibold">{path.progress}%</span>
                  </div>
                  <div
                    className="h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: '#F6F6F6' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${path.progress}%`,
                        backgroundColor: '#7FBFFF'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/tree"
              className="mt-6 font-medium hover:underline transition-colors relative z-10 block"
              style={{ color: '#7FBFFF' }}
            >
              Ver todas las rutas →
            </Link>
          </div>
        </div>

        {/* Weekly Activity */}
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
            border: '3px solid #F0F0F0'
          }}
        >
          {/* Decorative elements - dots pattern */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: '#FFE9A9',
                opacity: 0.2,
                top: `${20 + i * 10}%`,
                right: `${10 + (i % 3) * 5}%`
              }}
            />
          ))}
          <div className="flex items-center gap-3 mb-8 relative z-10">
            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: '#FFF4D4' }}
            >
              <Calendar className="size-6" style={{ color: '#CC7A3C' }} />
            </div>
            <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
              Actividad Esta Semana
            </h3>
          </div>
          <div className="flex items-end justify-between gap-4 h-48 relative z-10">
            {weekDays.map((day, index) => {
              const height = (weekActivity[index] / Math.max(...weekActivity)) * 100
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-3">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className="w-full rounded-t-2xl relative group transition-all duration-300 hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        minHeight: weekActivity[index] > 0 ? '20px' : '0',
                        backgroundColor: '#FFCFA9',
                        boxShadow: weekActivity[index] > 0 ? '0px -2px 8px rgba(255, 207, 169, 0.3)' : 'none'
                      }}
                    >
                      {/* Stripes decoration on bar */}
                      {weekActivity[index] > 0 && (
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(255,255,255,0.8) 5px, rgba(255,255,255,0.8) 10px)'
                          }}
                        />
                      )}
                      <div
                        className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1.5 rounded-2xl text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        style={{
                          backgroundColor: '#1E1E1E',
                          color: 'white'
                        }}
                      >
                        {weekActivity[index]} min
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#646464' }}>{day}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 text-sm relative z-10" style={{ color: '#646464' }}>
            <Clock className="size-5" />
            <span className="font-medium">Total esta semana: {weekActivity.reduce((a, b) => a + b, 0)} minutos</span>
          </div>
        </div>

        {/* Central Topics Mastered */}
        {centralTopicsMastered.length > 0 && (
          <div
            className="rounded-3xl p-6 relative overflow-hidden"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #F0F0F0'
            }}
          >
            {/* Decorative stars pattern */}
            <div className="absolute top-4 right-4 text-4xl opacity-10">⭐</div>
            <div className="absolute top-20 right-12 text-2xl opacity-10">✨</div>
            <div className="absolute bottom-10 right-8 text-3xl opacity-10">💫</div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="p-3 rounded-2xl relative"
                style={{ backgroundColor: '#FFE9D5' }}
              >
                <Award className="size-6" style={{ color: '#FF9900' }} />
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full"
                  style={{ backgroundColor: '#FFD700', border: '2px solid white' }}
                />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
                Temas Centrales Dominados
              </h3>
            </div>
            <p className="mb-6 font-medium relative z-10" style={{ color: '#646464' }}>
              Has completado {centralTopicsMastered.length} temas centrales
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
              {centralTopicsMastered.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-105 hover:rotate-1 cursor-pointer relative overflow-hidden"
                  style={{
                    backgroundColor: '#B9E2B1',
                    boxShadow: '0px 2px 8px rgba(163, 228, 182, 0.3)',
                    border: '2px solid #A3E4B6'
                  }}
                >
                  {/* Diagonal stripe accent */}
                  <div
                    className="absolute top-0 right-0 w-12 h-12"
                    style={{
                      backgroundColor: '#A3E4B6',
                      clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
                    }}
                  />
                  <span className="text-2xl relative z-10">⭐</span>
                  <div className="flex-1 min-w-0 relative z-10">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1E1E1E' }}>
                      {topic.name}
                    </p>
                    <p className="text-xs font-medium" style={{ color: '#2F8F4F' }}>
                      {topic.area}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/graph"
              className="mt-6 font-semibold hover:underline transition-colors relative z-10 block"
              style={{ color: '#C9B7F3' }}
            >
              Ver todos en el grafo →
            </Link>
          </div>
        )}

        {/* Badges */}
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
            border: '3px solid #F0F0F0'
          }}
        >
          {/* Decorative trophy elements */}
          <div className="absolute top-4 left-4 text-5xl opacity-5">🏆</div>
          <div className="absolute bottom-4 right-4 text-5xl opacity-5">🎖️</div>

          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: '#E6DEF9' }}
            >
              <Award className="size-6" style={{ color: '#C9B7F3' }} />
            </div>
            <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
              Logros y Badges
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 relative z-10">
            {badges.map((badge) => (
              <div
                key={badge.name}
                className={`p-5 rounded-3xl transition-all relative overflow-hidden ${
                  badge.earned
                    ? 'hover:scale-105 hover:-rotate-2 cursor-pointer'
                    : 'opacity-50'
                }`}
                style={{
                  backgroundColor: badge.earned ? '#FFF4D4' : '#F5F5F5',
                  boxShadow: badge.earned
                    ? '0px 4px 14px rgba(255, 233, 169, 0.4)'
                    : '0px 2px 8px rgba(0, 0, 0, 0.05)',
                  border: badge.earned ? '3px solid #FFE9A9' : '3px solid #E0E0E0'
                }}
              >
                {/* Corner decoration for earned badges */}
                {badge.earned && (
                  <>
                    <div
                      className="absolute top-0 left-0 w-16 h-16"
                      style={{
                        backgroundColor: '#FFE9A9',
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                        opacity: 0.5
                      }}
                    />
                    <div
                      className="absolute bottom-0 right-0 w-12 h-12 rounded-full"
                      style={{
                        backgroundColor: '#FFD700',
                        opacity: 0.15
                      }}
                    />
                  </>
                )}

                <div className="text-5xl mb-3 text-center relative z-10 transform transition-transform">
                  {badge.icon}
                </div>
                <h4
                  className="text-center mb-2 font-bold relative z-10"
                  style={{ color: badge.earned ? '#1E1E1E' : '#646464' }}
                >
                  {badge.name}
                </h4>
                <p
                  className="text-xs text-center mb-3 relative z-10"
                  style={{ color: badge.earned ? '#646464' : '#969696' }}
                >
                  {badge.description}
                </p>
                {badge.earned && (
                  <div className="flex justify-center relative z-10">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: '#FFD700',
                        color: '#1E1E1E',
                        border: '2px solid rgba(255, 215, 0, 0.5)'
                      }}
                    >
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
          <div
            className="rounded-3xl p-6 relative overflow-hidden"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
              border: '3px solid #F0F0F0'
            }}
          >
            {/* Decorative timeline elements */}
            <div
              className="absolute left-6 top-20 bottom-6 w-0.5"
              style={{
                backgroundColor: '#E6E6E6',
                opacity: 0.3
              }}
            />

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="p-3 rounded-2xl"
                style={{ backgroundColor: '#CADFFF' }}
              >
                <Clock className="size-6" style={{ color: '#5A8FCC' }} />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
                Actividad Reciente
              </h3>
            </div>
            <div className="space-y-3 relative z-10">
              {recentActivity.map((activity, index) => {
                const colors = {
                  completed: { bg: '#B9E2B1', border: '#A3E4B6', accent: '#2F8F4F' },
                  started: { bg: '#FFF4D4', border: '#FFE9A9', accent: '#B89C3C' },
                  badge: { bg: '#E6DEF9', border: '#D6C9F5', accent: '#9575CD' }
                }
                const style = colors[activity.type]

                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.02] hover:translate-x-1 relative"
                    style={{
                      backgroundColor: style.bg,
                      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
                      border: `2px solid ${style.border}`
                    }}
                  >
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                      style={{ backgroundColor: style.accent }}
                    />
                    <div
                      className="w-3 h-3 rounded-full relative"
                      style={{ backgroundColor: style.accent }}
                    >
                      {index === 0 && (
                        <div
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ backgroundColor: style.accent, opacity: 0.3 }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: '#1E1E1E' }}>
                        {activity.title}
                      </p>
                      <p className="text-sm font-medium" style={{ color: style.accent }}>
                        {activity.time}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Settings */}
        <div
          className="rounded-3xl p-6"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
            border: '3px solid #F0F0F0'
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: '#F6F6F6' }}
            >
              <Settings className="size-6" style={{ color: '#646464' }} />
            </div>
            <h3 className="text-xl font-semibold" style={{ color: '#1E1E1E' }}>
              Configuracion
            </h3>
          </div>
          <div className="space-y-4">
            {/* Dark Mode */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{ backgroundColor: '#F6F6F6' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white">
                  {darkMode ? <Moon className="size-5" style={{ color: '#646464' }} /> : <Sun className="size-5" style={{ color: '#646464' }} />}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: '#1E1E1E' }}>Modo Oscuro</p>
                  <p className="text-sm" style={{ color: '#646464' }}>Cambiar apariencia de la app</p>
                </div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="w-14 h-8 rounded-full transition-all p-1"
                style={{
                  background: darkMode ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)' : '#E6E6E6'
                }}
              >
                <div
                  className="w-6 h-6 bg-white rounded-full transition-transform"
                  style={{
                    transform: darkMode ? 'translateX(24px)' : 'translateX(0)',
                    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)'
                  }}
                />
              </button>
            </div>

            {/* Notifications */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{ backgroundColor: '#F6F6F6' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white">
                  <Bell className="size-5" style={{ color: '#646464' }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: '#1E1E1E' }}>Notificaciones</p>
                  <p className="text-sm" style={{ color: '#646464' }}>Recordatorios de estudio</p>
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className="w-14 h-8 rounded-full transition-all p-1"
                style={{
                  background: notifications ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)' : '#E6E6E6'
                }}
              >
                <div
                  className="w-6 h-6 bg-white rounded-full transition-transform"
                  style={{
                    transform: notifications ? 'translateX(24px)' : 'translateX(0)',
                    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)'
                  }}
                />
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-semibold transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: 'rgba(255, 177, 177, 0.2)',
                color: '#E57373',
                border: '1px solid rgba(255, 177, 177, 0.5)'
              }}
            >
              <LogOut className="size-5" />
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
