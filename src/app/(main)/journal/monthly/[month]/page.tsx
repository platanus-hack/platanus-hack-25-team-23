"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useJournal, formatDate } from '@/lib/store/journal-context'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  BookHeart,
  Trophy,
  Lightbulb,
  Target,
  TrendingUp,
  Brain,
  Zap,
  Heart,
  Wallet,
  GraduationCap,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Parse month string (2025-11)
function parseMonth(monthStr: string): { year: number; month: number } | null {
  const match = monthStr.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  return { year: parseInt(match[1]), month: parseInt(match[2]) }
}

// Format month string
function formatMonth(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`
}

export default function MonthlyJournalPage() {
  const params = useParams()
  const router = useRouter()
  const monthParam = params.month as string

  const {
    isLoading,
    isSaving,
    loadEntry,
    createOrUpdateEntry,
    entries
  } = useJournal()

  // Parse month from URL or use current month
  const parsed = parseMonth(monthParam)
  const now = new Date()
  const year = parsed?.year || now.getFullYear()
  const month = parsed?.month || now.getMonth() + 1
  const monthStr = formatMonth(year, month)

  // Form state
  const [bigWins, setBigWins] = useState<string[]>(['', '', '', '', ''])
  const [kpis, setKpis] = useState({
    mindset: 5,
    energy: 5,
    relationships: 5,
    finances: 5,
    learning: 5
  })
  const [monthlyLesson, setMonthlyLesson] = useState('')
  const [adjustments, setAdjustments] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load entry
  useEffect(() => {
    const loadData = async () => {
      const entry = await loadEntry(monthStr, 'monthly')
      if (entry) {
        setBigWins(entry.big_wins || ['', '', '', '', ''])
        setKpis(entry.kpis || { mindset: 5, energy: 5, relationships: 5, finances: 5, learning: 5 })
        setMonthlyLesson(entry.monthly_lesson || '')
        setAdjustments(entry.adjustments || '')
        setIsComplete(entry.is_complete)
      } else {
        setBigWins(['', '', '', '', ''])
        setKpis({ mindset: 5, energy: 5, relationships: 5, finances: 5, learning: 5 })
        setMonthlyLesson('')
        setAdjustments('')
        setIsComplete(false)
      }
      setHasChanges(false)
    }
    loadData()
  }, [monthStr, loadEntry])

  // Auto-save
  const saveEntry = useCallback(async () => {
    await createOrUpdateEntry(monthStr, {
      big_wins: bigWins,
      kpis,
      monthly_lesson: monthlyLesson,
      adjustments,
      is_complete: isComplete
    }, 'monthly')
    setHasChanges(false)
  }, [monthStr, bigWins, kpis, monthlyLesson, adjustments, isComplete, createOrUpdateEntry])

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
  const goToPrevMonth = () => {
    const newMonth = month === 1 ? 12 : month - 1
    const newYear = month === 1 ? year - 1 : year
    router.push(`/journal/monthly/${formatMonth(newYear, newMonth)}`)
  }

  const goToNextMonth = () => {
    const newMonth = month === 12 ? 1 : month + 1
    const newYear = month === 12 ? year + 1 : year
    router.push(`/journal/monthly/${formatMonth(newYear, newMonth)}`)
  }

  const handleMarkComplete = async () => {
    const newComplete = !isComplete
    setIsComplete(newComplete)
    await createOrUpdateEntry(monthStr, {
      big_wins: bigWins,
      kpis,
      monthly_lesson: monthlyLesson,
      adjustments,
      is_complete: newComplete
    }, 'monthly')
    toast.success(newComplete ? 'Mes marcado como completo' : 'Mes marcado como pendiente')
  }

  // Count completed days this month
  const completedDaysThisMonth = entries.filter(e => {
    if (e.type !== 'daily') return false
    return e.date.startsWith(monthStr) && e.is_complete
  }).length

  const daysInMonth = new Date(year, month, 0).getDate()

  const kpiConfig = [
    { key: 'mindset', label: 'Mentalidad', icon: Brain, color: '#9575CD', bg: '#E6DAFF' },
    { key: 'energy', label: 'Energía', icon: Zap, color: '#F5A962', bg: '#FFF0E6' },
    { key: 'relationships', label: 'Relaciones', icon: Heart, color: '#E57373', bg: '#FFD9D9' },
    { key: 'finances', label: 'Finanzas', icon: Wallet, color: '#10B981', bg: '#D4F5E9' },
    { key: 'learning', label: 'Aprendizaje', icon: GraduationCap, color: '#5A8FCC', bg: '#CFE4FF' }
  ]

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
            <Link
              href={`/journal/weekly/${year}-W${Math.ceil(now.getDate() / 7).toString().padStart(2, '0')}`}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Semanal
            </Link>
            <div
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#E6DAFF', color: '#9575CD' }}
            >
              Mensual
            </div>
            <Link
              href={`/journal/yearly/${year}`}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Anual
            </Link>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-xl hover:bg-white transition-all"
            >
              <ChevronLeft className="size-5" style={{ color: '#6D6D6D' }} />
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center gap-3 justify-center" style={{ color: '#222222' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                  <Calendar className="size-5" style={{ color: '#9575CD' }} />
                </div>
                {MONTHS_ES[month - 1]} {year}
              </h1>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-xl hover:bg-white transition-all"
            >
              <ChevronRight className="size-5" style={{ color: '#6D6D6D' }} />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="px-4 py-2 rounded-xl" style={{ backgroundColor: 'white' }}>
              <span className="text-sm" style={{ color: '#6D6D6D' }}>
                {completedDaysThisMonth}/{daysInMonth} dias completados
              </span>
            </div>
            {isComplete && (
              <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#D4F5E9', color: '#10B981' }}>
                Mes Completo
              </div>
            )}
          </div>
        </div>

        {/* Big Wins */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D4F5E9' }}>
              <Trophy className="size-5" style={{ color: '#10B981' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Grandes Logros del Mes</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>5 victorias importantes de este mes</p>
            </div>
          </div>
          <div className="space-y-3">
            {bigWins.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: '#9A9A9A' }}>{index + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newWins = [...bigWins]
                    newWins[index] = e.target.value
                    setBigWins(newWins)
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

        {/* KPIs */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
              <Target className="size-5" style={{ color: '#5A8FCC' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Auto-evaluación (1-10)</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>¿Cómo te fue en cada área este mes?</p>
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

        {/* Monthly Lesson */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0E6' }}>
              <Lightbulb className="size-5" style={{ color: '#F5A962' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Lección del Mes</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>La lección más importante de este mes</p>
            </div>
          </div>
          <textarea
            value={monthlyLesson}
            onChange={(e) => { setMonthlyLesson(e.target.value); markChange() }}
            placeholder="Escribe tu reflexión..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
            style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
          />
        </div>

        {/* Adjustments */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFD9D9' }}>
              <TrendingUp className="size-5" style={{ color: '#E57373' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Ajustes para el Próximo Mes</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>¿Qué cambiarás o mejorarás?</p>
            </div>
          </div>
          <textarea
            value={adjustments}
            onChange={(e) => { setAdjustments(e.target.value); markChange() }}
            placeholder="Escribe aquí..."
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
            {isComplete ? 'Completado' : 'Marcar Completo'}
          </button>
        </div>
      </div>
    </div>
  )
}
