"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useJournal, formatDate } from '@/lib/store/journal-context'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Loader2,
  BookHeart,
  Target,
  TrendingUp,
  Award,
  Lightbulb,
  Calendar,
  Brain,
  Zap,
  Heart,
  Wallet,
  GraduationCap
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// Get week number and year from date
function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

// Get date range for a week
function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const start = new Date(simple)
  if (dow <= 4) {
    start.setDate(simple.getDate() - simple.getDay() + 1)
  } else {
    start.setDate(simple.getDate() + 8 - simple.getDay())
  }
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

// Format week string (2025-W47)
function formatWeek(year: number, week: number): string {
  return `${year}-W${week.toString().padStart(2, '0')}`
}

// Parse week string
function parseWeek(weekStr: string): { year: number; week: number } | null {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  return { year: parseInt(match[1]), week: parseInt(match[2]) }
}

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function WeeklyJournalPage() {
  const params = useParams()
  const router = useRouter()
  const weekParam = params.week as string

  const {
    isLoading,
    isSaving,
    loadEntry,
    createOrUpdateEntry,
    entries
  } = useJournal()

  // Parse week from URL or use current week
  const parsed = parseWeek(weekParam)
  const now = new Date()
  const currentWeekInfo = getWeekNumber(now)
  const year = parsed?.year || currentWeekInfo.year
  const week = parsed?.week || currentWeekInfo.week
  const weekStr = formatWeek(year, week)
  const { start: weekStart, end: weekEnd } = getWeekDateRange(year, week)

  // Form state
  const [weeklyGratitude, setWeeklyGratitude] = useState<string[]>(['', '', '', '', ''])
  const [highlights, setHighlights] = useState<string[]>(['', '', ''])
  const [kpis, setKpis] = useState({
    mindset: 5,
    energy: 5,
    relationships: 5,
    finances: 5,
    learning: 5
  })
  const [weeklyLesson, setWeeklyLesson] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const kpiConfig = [
    { key: 'mindset', label: 'Mentalidad', icon: Brain, color: '#9575CD', bg: '#E6DAFF' },
    { key: 'energy', label: 'Energia', icon: Zap, color: '#F5A962', bg: '#FFF0E6' },
    { key: 'relationships', label: 'Relaciones', icon: Heart, color: '#E57373', bg: '#FFD9D9' },
    { key: 'finances', label: 'Finanzas', icon: Wallet, color: '#10B981', bg: '#D4F5E9' },
    { key: 'learning', label: 'Aprendizaje', icon: GraduationCap, color: '#5A8FCC', bg: '#CFE4FF' }
  ]

  // Load entry
  useEffect(() => {
    const loadData = async () => {
      const entry = await loadEntry(weekStr, 'weekly')
      if (entry) {
        setWeeklyGratitude(entry.weekly_gratitude || ['', '', '', '', ''])
        setHighlights(entry.highlights || ['', '', ''])
        setKpis(entry.kpis || { mindset: 5, energy: 5, relationships: 5, finances: 5, learning: 5 })
        setWeeklyLesson(entry.weekly_lesson || '')
        setToImprove(entry.to_improve || '')
        setIsComplete(entry.is_complete)
      } else {
        setWeeklyGratitude(['', '', '', '', ''])
        setHighlights(['', '', ''])
        setKpis({ mindset: 5, energy: 5, relationships: 5, finances: 5, learning: 5 })
        setWeeklyLesson('')
        setToImprove('')
        setIsComplete(false)
      }
      setHasChanges(false)
    }
    loadData()
  }, [weekStr, loadEntry])

  // Auto-save
  const saveEntry = useCallback(async () => {
    await createOrUpdateEntry(weekStr, {
      weekly_gratitude: weeklyGratitude,
      highlights,
      kpis,
      weekly_lesson: weeklyLesson,
      to_improve: toImprove,
      is_complete: isComplete
    }, 'weekly')
    setHasChanges(false)
  }, [weekStr, weeklyGratitude, highlights, kpis, weeklyLesson, toImprove, isComplete, createOrUpdateEntry])

  useEffect(() => {
    if (hasChanges) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveEntry()
      }, 2000)
    }
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [hasChanges, saveEntry])

  const markChange = () => setHasChanges(true)

  // Navigation
  const goToPrevWeek = () => {
    const newWeek = week === 1 ? 52 : week - 1
    const newYear = week === 1 ? year - 1 : year
    router.push(`/journal/weekly/${formatWeek(newYear, newWeek)}`)
  }

  const goToNextWeek = () => {
    const newWeek = week === 52 ? 1 : week + 1
    const newYear = week === 52 ? year + 1 : year
    router.push(`/journal/weekly/${formatWeek(newYear, newWeek)}`)
  }

  const handleMarkComplete = async () => {
    const newComplete = !isComplete
    setIsComplete(newComplete)
    await createOrUpdateEntry(weekStr, {
      weekly_gratitude: weeklyGratitude,
      highlights,
      kpis,
      weekly_lesson: weeklyLesson,
      to_improve: toImprove,
      is_complete: newComplete
    }, 'weekly')
    toast.success(newComplete ? 'Semana marcada como completa' : 'Semana marcada como pendiente')
  }

  // Count completed days this week
  const completedDaysThisWeek = entries.filter(e => {
    if (e.type !== 'daily') return false
    const entryDate = new Date(e.date + 'T00:00:00')
    return entryDate >= weekStart && entryDate <= weekEnd && e.is_complete
  }).length

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F6F5F2' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <Link
              href="/journal"
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Diario
            </Link>
            <div
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#E6DAFF', color: '#9575CD' }}
            >
              Semanal
            </div>
            <Link
              href={`/journal/monthly/${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}`}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Mensual
            </Link>
            <Link
              href={`/journal/yearly/${year}`}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Anual
            </Link>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevWeek}
              className="p-2 rounded-xl hover:bg-white transition-all"
            >
              <ChevronLeft className="size-5" style={{ color: '#6D6D6D' }} />
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center gap-3 justify-center" style={{ color: '#222222' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                  <Calendar className="size-5" style={{ color: '#9575CD' }} />
                </div>
                Semana {week}
              </h1>
              <p className="text-sm mt-1" style={{ color: '#6D6D6D' }}>
                {weekStart.getDate()} {MONTHS_ES[weekStart.getMonth()]} - {weekEnd.getDate()} {MONTHS_ES[weekEnd.getMonth()]} {year}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              className="p-2 rounded-xl hover:bg-white transition-all"
            >
              <ChevronRight className="size-5" style={{ color: '#6D6D6D' }} />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="px-4 py-2 rounded-xl" style={{ backgroundColor: 'white' }}>
              <span className="text-sm" style={{ color: '#6D6D6D' }}>
                {completedDaysThisWeek}/7 dias completados
              </span>
            </div>
            {isComplete && (
              <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#D4F5E9', color: '#10B981' }}>
                Semana Completa
              </div>
            )}
          </div>
        </div>

        {/* Weekly Gratitude */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0E6' }}>
              <Sparkles className="size-5" style={{ color: '#F5A962' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Gratitud Semanal</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>5 cosas por las que estas agradecido esta semana</p>
            </div>
          </div>
          <div className="space-y-3">
            {weeklyGratitude.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: '#9A9A9A' }}>{index + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newGratitude = [...weeklyGratitude]
                    newGratitude[index] = e.target.value
                    setWeeklyGratitude(newGratitude)
                    markChange()
                  }}
                  placeholder="Escribe aqui..."
                  className="flex-1 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                  style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D4F5E9' }}>
              <Award className="size-5" style={{ color: '#10B981' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Momentos Destacados</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>Los 3 mejores momentos de la semana</p>
            </div>
          </div>
          <div className="space-y-3">
            {highlights.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: '#9A9A9A' }}>{index + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newHighlights = [...highlights]
                    newHighlights[index] = e.target.value
                    setHighlights(newHighlights)
                    markChange()
                  }}
                  placeholder="Escribe aqui..."
                  className="flex-1 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                  style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* KPIs - Auto-evaluacion */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
              <Target className="size-5" style={{ color: '#5A8FCC' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Auto-evaluacion (1-10)</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>Como te fue en cada area esta semana?</p>
            </div>
          </div>
          <div className="space-y-4">
            {kpiConfig.map(({ key, label, icon: Icon, color, bg }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <Icon className="size-5" style={{ color }} />
                </div>
                <span className="text-sm font-medium w-28" style={{ color: '#222222' }}>{label}</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={kpis[key as keyof typeof kpis]}
                  onChange={(e) => {
                    setKpis(prev => ({ ...prev, [key]: parseInt(e.target.value) }))
                    markChange()
                  }}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{ backgroundColor: '#F6F5F2' }}
                />
                <span className="text-lg font-bold w-8 text-center" style={{ color }}>{kpis[key as keyof typeof kpis]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Lesson */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
              <Lightbulb className="size-5" style={{ color: '#5A8FCC' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Leccion de la Semana</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>Que aprendiste esta semana?</p>
            </div>
          </div>
          <textarea
            value={weeklyLesson}
            onChange={(e) => { setWeeklyLesson(e.target.value); markChange() }}
            placeholder="Escribe tu reflexion..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
            style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
          />
        </div>

        {/* To Improve */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFD9D9' }}>
              <TrendingUp className="size-5" style={{ color: '#E57373' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>A Mejorar</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>En que puedes mejorar la proxima semana?</p>
            </div>
          </div>
          <textarea
            value={toImprove}
            onChange={(e) => { setToImprove(e.target.value); markChange() }}
            placeholder="Escribe aqui..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
            style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#9A9A9A' }}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : hasChanges ? (
              'Sin guardar'
            ) : (
              <>
                <Check className="size-4" style={{ color: '#10B981' }} />
                Guardado
              </>
            )}
          </div>
          <button
            onClick={handleMarkComplete}
            className="px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90 flex items-center gap-2"
            style={{
              backgroundColor: isComplete ? '#D4F5E9' : '#FFD9D9',
              color: isComplete ? '#10B981' : '#222222'
            }}
          >
            {isComplete ? <Check className="size-4" /> : <BookHeart className="size-4" />}
            {isComplete ? 'Completada' : 'Marcar Completa'}
          </button>
        </div>
      </div>
    </div>
  )
}
