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
  Star,
  Compass,
  Target,
  Award,
  Heart,
  Lightbulb,
  Rocket,
  Plus,
  Trash2,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function YearlyJournalPage() {
  const params = useParams()
  const router = useRouter()
  const yearParam = params.year as string

  const {
    isLoading,
    isSaving,
    loadEntry,
    createOrUpdateEntry,
    entries
  } = useJournal()

  const now = new Date()
  const year = parseInt(yearParam) || now.getFullYear()
  const yearStr = year.toString()

  // Form state
  const [wordOfYear, setWordOfYear] = useState('')
  const [visionStatement, setVisionStatement] = useState('')
  const [smartGoals, setSmartGoals] = useState<{ area: string; goal: string; metric: string }[]>([
    { area: '', goal: '', metric: '' }
  ])
  const [yearlyReflection, setYearlyReflection] = useState({
    grateful_people: '',
    achievements: '',
    lessons_learned: '',
    next_year_intentions: ''
  })
  const [isComplete, setIsComplete] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load entry
  useEffect(() => {
    const loadData = async () => {
      const entry = await loadEntry(yearStr, 'yearly')
      if (entry) {
        setWordOfYear(entry.word_of_year || '')
        setVisionStatement(entry.vision_statement || '')
        setSmartGoals(entry.smart_goals || [{ area: '', goal: '', metric: '' }])
        setYearlyReflection(entry.yearly_reflection || {
          grateful_people: '',
          achievements: '',
          lessons_learned: '',
          next_year_intentions: ''
        })
        setIsComplete(entry.is_complete)
      } else {
        setWordOfYear('')
        setVisionStatement('')
        setSmartGoals([{ area: '', goal: '', metric: '' }])
        setYearlyReflection({
          grateful_people: '',
          achievements: '',
          lessons_learned: '',
          next_year_intentions: ''
        })
        setIsComplete(false)
      }
      setHasChanges(false)
    }
    loadData()
  }, [yearStr, loadEntry])

  // Auto-save
  const saveEntry = useCallback(async () => {
    await createOrUpdateEntry(yearStr, {
      word_of_year: wordOfYear,
      vision_statement: visionStatement,
      smart_goals: smartGoals,
      yearly_reflection: yearlyReflection,
      is_complete: isComplete
    }, 'yearly')
    setHasChanges(false)
  }, [yearStr, wordOfYear, visionStatement, smartGoals, yearlyReflection, isComplete, createOrUpdateEntry])

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
  const goToPrevYear = () => router.push(`/journal/yearly/${year - 1}`)
  const goToNextYear = () => router.push(`/journal/yearly/${year + 1}`)

  const handleMarkComplete = async () => {
    const newComplete = !isComplete
    setIsComplete(newComplete)
    await createOrUpdateEntry(yearStr, {
      word_of_year: wordOfYear,
      vision_statement: visionStatement,
      smart_goals: smartGoals,
      yearly_reflection: yearlyReflection,
      is_complete: newComplete
    }, 'yearly')
    toast.success(newComplete ? 'Ano marcado como completo' : 'Ano marcado como pendiente')
  }

  // Add/remove SMART goals
  const addGoal = () => {
    setSmartGoals([...smartGoals, { area: '', goal: '', metric: '' }])
    markChange()
  }

  const removeGoal = (index: number) => {
    const newGoals = smartGoals.filter((_, i) => i !== index)
    setSmartGoals(newGoals.length > 0 ? newGoals : [{ area: '', goal: '', metric: '' }])
    markChange()
  }

  const updateGoal = (index: number, field: 'area' | 'goal' | 'metric', value: string) => {
    const newGoals = [...smartGoals]
    newGoals[index][field] = value
    setSmartGoals(newGoals)
    markChange()
  }

  // Count completed months this year
  const completedMonthsThisYear = entries.filter(e => {
    if (e.type !== 'monthly') return false
    return e.date.startsWith(yearStr) && e.is_complete
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
            <Link
              href={`/journal/weekly/${year}-W${Math.ceil(now.getDate() / 7).toString().padStart(2, '0')}`}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Semanal
            </Link>
            <Link
              href={`/journal/monthly/${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}`}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'white', color: '#6D6D6D' }}
            >
              Mensual
            </Link>
            <div
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#E6DAFF', color: '#9575CD' }}
            >
              Anual
            </div>
          </div>

          {/* Year Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevYear}
              className="p-2 rounded-xl hover:bg-white transition-all"
            >
              <ChevronLeft className="size-5" style={{ color: '#6D6D6D' }} />
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center gap-3 justify-center" style={{ color: '#222222' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                  <Calendar className="size-5" style={{ color: '#9575CD' }} />
                </div>
                {year}
              </h1>
              <p className="text-sm mt-1" style={{ color: '#6D6D6D' }}>Reflexion y planificacion anual</p>
            </div>
            <button
              onClick={goToNextYear}
              className="p-2 rounded-xl hover:bg-white transition-all"
            >
              <ChevronRight className="size-5" style={{ color: '#6D6D6D' }} />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="px-4 py-2 rounded-xl" style={{ backgroundColor: 'white' }}>
              <span className="text-sm" style={{ color: '#6D6D6D' }}>
                {completedMonthsThisYear}/12 meses completados
              </span>
            </div>
            {isComplete && (
              <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#D4F5E9', color: '#10B981' }}>
                Ano Completo
              </div>
            )}
          </div>
        </div>

        {/* Word of the Year */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0E6' }}>
              <Star className="size-5" style={{ color: '#F5A962' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Palabra del Ano</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>Una palabra que guiara tu ano</p>
            </div>
          </div>
          <input
            type="text"
            value={wordOfYear}
            onChange={(e) => { setWordOfYear(e.target.value); markChange() }}
            placeholder="Ej: Crecimiento, Equilibrio, Valentia..."
            className="w-full px-4 py-3 rounded-xl text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-purple-200"
            style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
          />
        </div>

        {/* Vision Statement */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
              <Compass className="size-5" style={{ color: '#9575CD' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Vision del Ano</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>Como te ves al final de este ano?</p>
            </div>
          </div>
          <textarea
            value={visionStatement}
            onChange={(e) => { setVisionStatement(e.target.value); markChange() }}
            placeholder="Describe tu vision ideal para el final del ano..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
            style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
          />
        </div>

        {/* SMART Goals */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D4F5E9' }}>
                <Target className="size-5" style={{ color: '#10B981' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Metas SMART</h2>
                <p className="text-xs" style={{ color: '#6D6D6D' }}>Objetivos especificos y medibles</p>
              </div>
            </div>
            <button
              onClick={addGoal}
              className="p-2 rounded-xl hover:bg-gray-50 transition-all"
              style={{ color: '#10B981' }}
            >
              <Plus className="size-5" />
            </button>
          </div>
          <div className="space-y-4">
            {smartGoals.map((goal, index) => (
              <div key={index} className="p-4 rounded-xl" style={{ backgroundColor: '#F6F5F2' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: '#6D6D6D' }}>Meta {index + 1}</span>
                  {smartGoals.length > 1 && (
                    <button
                      onClick={() => removeGoal(index)}
                      className="p-1 rounded hover:bg-red-50 transition-all"
                      style={{ color: '#E57373' }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={goal.area}
                    onChange={(e) => updateGoal(index, 'area', e.target.value)}
                    placeholder="Area (Ej: Salud, Carrera, Finanzas)"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    style={{ backgroundColor: 'white', color: '#222222' }}
                  />
                  <input
                    type="text"
                    value={goal.goal}
                    onChange={(e) => updateGoal(index, 'goal', e.target.value)}
                    placeholder="Objetivo (Ej: Perder 10kg)"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    style={{ backgroundColor: 'white', color: '#222222' }}
                  />
                  <input
                    type="text"
                    value={goal.metric}
                    onChange={(e) => updateGoal(index, 'metric', e.target.value)}
                    placeholder="Metrica (Ej: Peso en kg cada mes)"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    style={{ backgroundColor: 'white', color: '#222222' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Yearly Reflection */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
              <Lightbulb className="size-5" style={{ color: '#5A8FCC' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#222222' }}>Reflexion Anual</h2>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>Llena esto al final del ano</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: '#6D6D6D' }}>
                <Heart className="size-4" style={{ color: '#E57373' }} />
                Personas por las que estoy agradecido
              </label>
              <textarea
                value={yearlyReflection.grateful_people}
                onChange={(e) => { setYearlyReflection(prev => ({ ...prev, grateful_people: e.target.value })); markChange() }}
                placeholder="Quienes hicieron diferencia en tu ano?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: '#6D6D6D' }}>
                <Award className="size-4" style={{ color: '#10B981' }} />
                Logros del ano
              </label>
              <textarea
                value={yearlyReflection.achievements}
                onChange={(e) => { setYearlyReflection(prev => ({ ...prev, achievements: e.target.value })); markChange() }}
                placeholder="De que estas mas orgulloso?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: '#6D6D6D' }}>
                <Lightbulb className="size-4" style={{ color: '#F5A962' }} />
                Lecciones aprendidas
              </label>
              <textarea
                value={yearlyReflection.lessons_learned}
                onChange={(e) => { setYearlyReflection(prev => ({ ...prev, lessons_learned: e.target.value })); markChange() }}
                placeholder="Que aprendiste este ano?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: '#6D6D6D' }}>
                <Rocket className="size-4" style={{ color: '#9575CD' }} />
                Intenciones para el proximo ano
              </label>
              <textarea
                value={yearlyReflection.next_year_intentions}
                onChange={(e) => { setYearlyReflection(prev => ({ ...prev, next_year_intentions: e.target.value })); markChange() }}
                placeholder="Como quieres que sea el proximo ano?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                style={{ backgroundColor: '#F6F5F2', color: '#222222' }}
              />
            </div>
          </div>
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
