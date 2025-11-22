"use client"

import { useState, useEffect } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'
import { User, Mail, Calendar, Award, BookOpen, Clock, TrendingUp, Settings, LogOut, Moon, Sun, Bell, Flame, Download, Share2 } from "lucide-react"
import { toast } from "sonner"
import Link from 'next/link'

interface Area {
  id: string
  name: string
  color: string
  icon: string
  progress?: number
  total?: number
  understood?: number
}

interface ProfileStats {
  total_concepts: number
  understood_concepts: number
  study_streak: number
  total_study_time: number
}

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  bgColor: string
  color: string
  unlocked_at?: string
}

export default function ProfilePage() {
  const { session, notes } = useKnowledge()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [stats, setStats] = useState<ProfileStats>({
    total_concepts: 0,
    understood_concepts: 0,
    study_streak: 0,
    total_study_time: 0
  })
  const [areas, setAreas] = useState<Area[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function loadProfileData() {
      if (!session?.user) {
        setLoading(false)
        return
      }

      const supabase = createClient()

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setDarkMode(profileData.preferences?.dark_mode || false)
        setNotifications(profileData.preferences?.notifications || true)
      }

      const { count: totalConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      const { count: understoodConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'understood')

      const { data: progressData } = await supabase
        .from('user_progress')
        .select('study_streak, total_study_time')
        .eq('user_id', session.user.id)

      let studyStreak = 0
      let totalStudyTime = 0
      if (progressData && progressData.length > 0) {
        studyStreak = Math.max(...progressData.map(p => p.study_streak || 0))
        totalStudyTime = progressData.reduce((sum, p) => sum + (p.total_study_time || 0), 0)
      }

      setStats({
        total_concepts: (totalConcepts || 0) + notes.length,
        understood_concepts: (understoodConcepts || 0) + notes.filter(n => n.status === 'understood').length,
        study_streak: studyStreak,
        total_study_time: totalStudyTime
      })

      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', session.user.id)

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
              progress: total ? Math.round(((understood || 0) / total) * 100) : 0
            }
          })
        )
        setAreas(areasWithProgress.filter(a => a.total > 0))
      }

      const badgesList: Badge[] = [
        { id: '1', name: 'Primer Concepto', description: 'Dominaste tu primer concepto', icon: '🏆', unlocked: (understoodConcepts || 0) >= 1, bgColor: '#E6DEF9', color: '#9575CD' },
        { id: '2', name: 'Racha de 5 dias', description: 'Estudiaste 5 dias seguidos', icon: '🔥', unlocked: studyStreak >= 5, bgColor: '#FFE8CC', color: '#CC7E4A' },
        { id: '3', name: 'Explorador', description: 'Visitaste el grafo 10 veces', icon: '🧭', unlocked: false, bgColor: '#CADFFF', color: '#5A8FCC' },
        { id: '4', name: 'Maestro del Area', description: 'Domina un area completa', icon: '⭐', unlocked: false, bgColor: '#FFF4D4', color: '#B89C3C' },
        { id: '5', name: 'Maratonista', description: 'Estudia 100 horas', icon: '⏱️', unlocked: totalStudyTime >= 6000, bgColor: '#D4F0CE', color: '#5FA857' },
        { id: '6', name: 'Enciclopedista', description: 'Crea 50 notas', icon: '📚', unlocked: (totalConcepts || 0) >= 50, bgColor: '#FDD4DD', color: '#D88BA0' },
      ]
      setBadges(badgesList)

      setLoading(false)
    }

    loadProfileData()
  }, [session, notes])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Sesion cerrada")
    router.push('/')
  }

  const handleUpdatePreferences = async (key: string, value: boolean) => {
    if (!session?.user) return

    const supabase = createClient()
    const newPreferences = {
      ...(profile?.preferences || {}),
      [key]: value
    }

    await supabase
      .from('profiles')
      .update({ preferences: newPreferences })
      .eq('id', session.user.id)

    setProfile((prev: any) => ({ ...prev, preferences: newPreferences }))
  }

  const progressPercent = stats.total_concepts > 0
    ? Math.round((stats.understood_concepts / stats.total_concepts) * 100)
    : 0

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      <div className="max-w-4xl mx-auto p-8">
        {/* Profile Header */}
        <div
          className="rounded-3xl p-8 mb-8 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
            boxShadow: '0px 8px 24px rgba(201, 183, 243, 0.4)'
          }}
        >
          {/* Decorative elements */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-32 translate-x-32"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 rounded-full translate-y-24 -translate-x-24"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          />

          <div className="flex items-start gap-6 relative z-10">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <User className="size-12 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                {session?.user?.email?.split('@')[0] || 'Usuario'}
              </h1>
              <p className="text-white/80 flex items-center gap-2 mb-4">
                <Mail className="size-4" />
                {session?.user?.email || 'usuario@ejemplo.com'}
              </p>
              <div className="flex items-center gap-4 text-sm text-white/80">
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <Calendar className="size-4" />
                  Miembro desde Nov 2024
                </span>
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <Award className="size-4" />
                  {badges.filter(a => a.unlocked).length} logros
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div
            className="rounded-3xl p-5 relative overflow-hidden hover:scale-105 transition-all"
            style={{
              backgroundColor: '#E6DEF9',
              border: '2px solid #D6C9F5',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div
              className="absolute top-0 right-0 w-12 h-12"
              style={{
                backgroundColor: '#D6C9F5',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="p-2 rounded-xl bg-white">
                <BookOpen className="size-4" style={{ color: '#C9B7F3' }} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: '#6B5B95' }}>
              {loading ? '-' : stats.total_concepts}
            </p>
            <p className="text-sm" style={{ color: '#646464' }}>Conceptos</p>
          </div>

          <div
            className="rounded-3xl p-5 relative overflow-hidden hover:scale-105 transition-all"
            style={{
              backgroundColor: '#D4F0CE',
              border: '2px solid #B9E2B1',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div
              className="absolute top-0 right-0 w-12 h-12"
              style={{
                backgroundColor: '#B9E2B1',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="p-2 rounded-xl bg-white">
                <TrendingUp className="size-4" style={{ color: '#5FA857' }} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: '#4A8B44' }}>
              {loading ? '-' : stats.understood_concepts}
            </p>
            <p className="text-sm" style={{ color: '#646464' }}>Dominados</p>
          </div>

          <div
            className="rounded-3xl p-5 relative overflow-hidden hover:scale-105 transition-all"
            style={{
              backgroundColor: '#CADFFF',
              border: '2px solid #A3D4FF',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div
              className="absolute top-0 right-0 w-12 h-12"
              style={{
                backgroundColor: '#A3D4FF',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="p-2 rounded-xl bg-white">
                <Clock className="size-4" style={{ color: '#5A8FCC' }} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: '#4A7AB5' }}>
              {loading ? '-' : `${Math.floor(stats.total_study_time / 60)}h`}
            </p>
            <p className="text-sm" style={{ color: '#646464' }}>Tiempo Total</p>
          </div>

          <div
            className="rounded-3xl p-5 relative overflow-hidden hover:scale-105 transition-all"
            style={{
              backgroundColor: '#FFE8CC',
              border: '2px solid #FFD5A5',
              boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div className="absolute top-2 right-2 text-2xl opacity-10">🔥</div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="p-2 rounded-xl bg-white">
                <Flame className="size-4" style={{ color: '#FF9D5D' }} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: '#CC7E4A' }}>
              {loading ? '-' : stats.study_streak}
            </p>
            <p className="text-sm" style={{ color: '#646464' }}>Racha dias</p>
          </div>
        </div>

        {/* Area Progress */}
        <div
          className="rounded-3xl p-6 mb-8"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ color: '#1E1E1E' }}>Progreso por Area</h2>
            <Link
              href="/tree"
              className="text-sm font-medium px-4 py-2 rounded-xl transition-all hover:scale-105"
              style={{
                backgroundColor: 'rgba(201, 183, 243, 0.1)',
                color: '#C9B7F3'
              }}
            >
              Ver ruta completa
            </Link>
          </div>
          {areas.length > 0 ? (
            <div className="space-y-4">
              {areas.map(area => (
                <div key={area.id} className="p-4 rounded-2xl" style={{ backgroundColor: '#F6F6F6' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ backgroundColor: area.color + '30' }}
                      >
                        {area.icon || '📚'}
                      </div>
                      <span className="font-semibold" style={{ color: '#1E1E1E' }}>{area.name}</span>
                    </div>
                    <span
                      className="text-sm px-3 py-1 rounded-full font-medium"
                      style={{ backgroundColor: area.color + '20', color: area.color }}
                    >
                      {area.progress || 0}%
                    </span>
                  </div>
                  <div
                    className="h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: '#E6E6E6' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${area.progress || 0}%`,
                        background: `linear-gradient(90deg, ${area.color} 0%, ${area.color}CC 100%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs" style={{ color: '#646464' }}>
                    <span>{area.understood || 0} dominados</span>
                    <span>{area.total || 0} total</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: '#646464' }}>
              No hay areas con conceptos aun
            </div>
          )}
        </div>

        {/* Achievements */}
        <div
          className="rounded-3xl p-6 mb-8"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1E1E1E' }}>Logros</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {badges.map(badge => (
              <div
                key={badge.id}
                className="p-5 rounded-2xl transition-all hover:scale-105"
                style={{
                  backgroundColor: badge.unlocked ? badge.bgColor : '#F6F6F6',
                  border: badge.unlocked ? `2px solid ${badge.color}30` : '2px solid #E6E6E6',
                  opacity: badge.unlocked ? 1 : 0.5
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3"
                  style={{
                    backgroundColor: badge.unlocked ? 'white' : '#E6E6E6',
                    boxShadow: badge.unlocked ? '0px 2px 8px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  {badge.icon}
                </div>
                <h3 className="font-semibold mb-1" style={{ color: '#1E1E1E' }}>{badge.name}</h3>
                <p className="text-sm" style={{ color: '#646464' }}>{badge.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Export Options */}
        <div
          className="rounded-3xl p-6 mb-8"
          style={{
            background: 'linear-gradient(135deg, #E6DEF9 0%, #F0EAF9 100%)',
            border: '2px solid #D6C9F5'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'white' }}>
              <Share2 className="size-5" style={{ color: '#C9B7F3' }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: '#1E1E1E' }}>Exportar</h2>
          </div>
          <p className="mb-4" style={{ color: '#646464' }}>Descarga tu progreso y conocimientos</p>
          <div className="flex gap-3">
            <Link
              href="/graph"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: 'white',
                color: '#1E1E1E',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <Download className="size-5" />
              Exportar Grafo
            </Link>
            <button
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: 'white',
                color: '#1E1E1E',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <Download className="size-5" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* Settings */}
        <div
          className="rounded-3xl p-6"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1E1E1E' }}>Configuracion</h2>
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
                onClick={() => {
                  setDarkMode(!darkMode)
                  handleUpdatePreferences('dark_mode', !darkMode)
                }}
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
                onClick={() => {
                  setNotifications(!notifications)
                  handleUpdatePreferences('notifications', !notifications)
                }}
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
