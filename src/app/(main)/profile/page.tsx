"use client"

import { useState, useEffect } from 'react'
import { useKnowledge } from "@/lib/store/knowledge-context"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'
import { User, Mail, Calendar, Award, BookOpen, Clock, TrendingUp, Settings, LogOut, Moon, Sun, Bell } from "lucide-react"
import { toast } from "sonner"

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

      // Load profile
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

      // Load stats
      const { count: totalConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      const { count: understoodConcepts } = await supabase
        .from('concepts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'understood')

      // Load progress for study streak
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

      // Load areas with progress
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

      // Load badges
      const badgesList: Badge[] = [
        { id: '1', name: 'Primer Concepto', description: 'Dominaste tu primer concepto', icon: '🏆', unlocked: (understoodConcepts || 0) >= 1 },
        { id: '2', name: 'Racha de 5 dias', description: 'Estudiaste 5 dias seguidos', icon: '🔥', unlocked: studyStreak >= 5 },
        { id: '3', name: 'Explorador', description: 'Visitaste el grafo 10 veces', icon: '🧭', unlocked: false },
        { id: '4', name: 'Maestro del Area', description: 'Domina un area completa', icon: '⭐', unlocked: false },
        { id: '5', name: 'Maratonista', description: 'Estudia 100 horas', icon: '⏱️', unlocked: totalStudyTime >= 6000 },
        { id: '6', name: 'Enciclopedista', description: 'Crea 50 notas', icon: '📚', unlocked: (totalConcepts || 0) >= 50 },
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

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="size-12 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {session?.user?.email?.split('@')[0] || 'Usuario'}
              </h1>
              <p className="text-gray-500 flex items-center gap-2 mb-4">
                <Mail className="size-4" />
                {session?.user?.email || 'usuario@ejemplo.com'}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  Miembro desde Nov 2024
                </span>
                <span className="flex items-center gap-1">
                  <Award className="size-4" />
                  {badges.filter(a => a.unlocked).length} logros
                </span>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Settings className="size-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-soft border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="size-5 text-purple-500" />
              <span className="text-sm text-gray-500">Conceptos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '-' : stats.total_concepts}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-soft border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-5 text-green-500" />
              <span className="text-sm text-gray-500">Dominados</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '-' : stats.understood_concepts}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-soft border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="size-5 text-blue-500" />
              <span className="text-sm text-gray-500">Tiempo Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '-' : `${Math.floor(stats.total_study_time / 60)}h ${stats.total_study_time % 60}m`}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-soft border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-5 text-orange-500" />
              <span className="text-sm text-gray-500">Racha</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '-' : `${stats.study_streak} dias`}</p>
          </div>
        </div>

        {/* Area Progress */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Progreso por Area</h2>
          {areas.length > 0 ? (
            <div className="space-y-4">
              {areas.map(area => (
                <div key={area.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{area.icon || '📚'}</span>
                      <span className="text-sm font-medium text-gray-700">{area.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{area.understood || 0}/{area.total || 0}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${area.progress || 0}%`,
                        backgroundColor: area.color || '#C9B7F3'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No hay areas con conceptos aun</p>
          )}
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Logros</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {badges.map(badge => (
              <div
                key={badge.id}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  badge.unlocked
                    ? 'border-purple-200 bg-purple-50'
                    : 'border-gray-100 bg-gray-50 opacity-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 ${
                  badge.unlocked ? 'bg-purple-200' : 'bg-gray-200'
                }`}>
                  {badge.icon}
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{badge.name}</h3>
                <p className="text-sm text-gray-500">{badge.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuracion</h2>
          <div className="space-y-4">
            {/* Dark Mode */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="size-5 text-gray-600" /> : <Sun className="size-5 text-gray-600" />}
                <div>
                  <p className="font-medium text-gray-900">Modo Oscuro</p>
                  <p className="text-sm text-gray-500">Cambiar apariencia de la aplicacion</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDarkMode(!darkMode)
                  handleUpdatePreferences('dark_mode', !darkMode)
                }}
                className={`w-12 h-6 rounded-full transition-colors ${
                  darkMode ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <Bell className="size-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Notificaciones</p>
                  <p className="text-sm text-gray-500">Recordatorios de estudio</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setNotifications(!notifications)
                  handleUpdatePreferences('notifications', !notifications)
                }}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  notifications ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <LogOut className="size-5" />
              <span className="font-medium">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
