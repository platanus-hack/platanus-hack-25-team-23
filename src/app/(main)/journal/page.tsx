"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useJournal, formatDate, parseDate, JournalTask } from '@/lib/store/journal-context'
import { useKnowledge } from '@/lib/store/knowledge-context'
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Quote,
  Check,
  Loader2,
  BookHeart,
  Sparkles,
  ListTodo,
  Plus,
  Trash2,
  Circle,
  CheckCircle2,
  CalendarDays,
  PenLine
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function JournalPage() {
  const { session } = useKnowledge()
  const {
    currentEntry,
    isLoading,
    isSaving,
    loadEntry,
    createOrUpdateEntry,
    getAdjacentDates,
    fetchDailyQuote,
    getStreak
  } = useJournal()

  const [currentDate, setCurrentDate] = useState(formatDate(new Date()))
  const [gratitude, setGratitude] = useState(['', '', ''])
  const [dailyIntention, setDailyIntention] = useState('')
  const [makeGreat, setMakeGreat] = useState(['', '', ''])
  const [bestMoments, setBestMoments] = useState(['', '', ''])
  const [lesson, setLesson] = useState('')
  const [freeThoughts, setFreeThoughts] = useState('')
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [tasks, setTasks] = useState<JournalTask[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [allowFutureDates, setAllowFutureDates] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load entry for current date
  useEffect(() => {
    const loadData = async () => {
      const entry = await loadEntry(currentDate, 'daily')

      if (entry) {
        setGratitude(entry.gratitude || ['', '', ''])
        setDailyIntention(entry.daily_intention || '')
        setMakeGreat(entry.make_great || ['', '', ''])
        setBestMoments(entry.best_moments || ['', '', ''])
        setLesson(entry.lesson || '')
        setFreeThoughts(entry.free_thoughts || '')
        setQuote(entry.quote)
        setMood(entry.mood)
        setTasks(entry.tasks || [])
        setIsComplete(entry.is_complete)
      } else {
        // Reset form for new entry
        setGratitude(['', '', ''])
        setDailyIntention('')
        setMakeGreat(['', '', ''])
        setBestMoments(['', '', ''])
        setLesson('')
        setFreeThoughts('')
        setMood(null)
        setIsComplete(false)

        // Check for incomplete tasks from yesterday to carry over
        const yesterday = new Date(parseDate(currentDate))
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = formatDate(yesterday)
        const yesterdayEntry = await loadEntry(yesterdayStr, 'daily')

        if (yesterdayEntry?.tasks && yesterdayEntry.tasks.length > 0) {
          const incompleteTasks = yesterdayEntry.tasks
            .filter((t: JournalTask) => !t.completed)
            .map((t: JournalTask) => ({
              ...t,
              id: crypto.randomUUID() // New ID for carried over task
            }))

          if (incompleteTasks.length > 0) {
            setTasks(incompleteTasks)
            toast.info(`${incompleteTasks.length} tarea(s) pendiente(s) de ayer agregadas`)
          } else {
            setTasks([])
          }
        } else {
          setTasks([])
        }

        // Fetch new quote for new entries
        const newQuote = await fetchDailyQuote()
        setQuote(newQuote)
      }
      setHasChanges(false)
    }

    if (session?.user) {
      loadData()
    }
  }, [currentDate, session, loadEntry, fetchDailyQuote])

  // Auto-save with debounce
  const saveEntry = useCallback(async () => {
    if (!session?.user) return

    await createOrUpdateEntry(currentDate, {
      gratitude,
      daily_intention: dailyIntention,
      make_great: makeGreat,
      best_moments: bestMoments,
      lesson,
      free_thoughts: freeThoughts,
      quote,
      mood,
      tasks,
      is_complete: isComplete
    }, 'daily')

    setHasChanges(false)
  }, [session, currentDate, gratitude, dailyIntention, makeGreat, bestMoments, lesson, freeThoughts, quote, mood, tasks, isComplete, createOrUpdateEntry])

  // Trigger auto-save on changes
  useEffect(() => {
    if (!hasChanges || !session?.user) return

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveEntry()
    }, 2000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [hasChanges, gratitude, dailyIntention, makeGreat, bestMoments, lesson, freeThoughts, mood, tasks, isComplete, session?.user, saveEntry])

  // Navigation
  const { prev, next } = getAdjacentDates(currentDate, allowFutureDates)

  // Task helpers
  const addTask = () => {
    if (!newTaskText.trim()) return
    const newTask: JournalTask = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      completed: false,
      priority: 'medium'
    }
    setTasks([...tasks, newTask])
    setNewTaskText('')
    handleChange()
  }

  const toggleTask = (taskId: string) => {
    setTasks(tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ))
    handleChange()
  }

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId))
    handleChange()
  }

  const updateTaskPriority = (taskId: string, priority: JournalTask['priority']) => {
    setTasks(tasks.map(t =>
      t.id === taskId ? { ...t, priority } : t
    ))
    handleChange()
  }

  // Check if current date is in the future
  const today = formatDate(new Date())
  const isFutureDate = currentDate > today

  const goToDate = (date: string | null) => {
    if (date) {
      setCurrentDate(date)
    }
  }

  const goToToday = () => {
    setCurrentDate(formatDate(new Date()))
  }

  // Format display date
  const displayDate = parseDate(currentDate)
  const dayName = DAYS_ES[displayDate.getDay()]
  const monthName = MONTHS_ES[displayDate.getMonth()]
  const isToday = currentDate === formatDate(new Date())

  // Mark changes
  const handleChange = () => {
    setHasChanges(true)
  }

  // Mark as complete
  const handleMarkComplete = async () => {
    setIsComplete(true)
    setHasChanges(true)
    toast.success('Journal marcado como completado!')
  }

  // Check if user is logged in
  if (!session?.user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-primary/80 to-primary text-white shadow-lg shadow-primary/20">
            <BookHeart className="size-10" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-foreground">
            Journal Personal
          </h2>
          <p className="mb-6 text-muted-foreground">
            Inicia sesion para acceder a tu journal personal y llevar un registro de tu crecimiento diario.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-[1.02] bg-gradient-to-br from-primary/80 to-primary shadow-lg shadow-primary/20"
          >
            Iniciar Sesion
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading && !currentEntry) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // Get current week and month for navigation links
  const currentYear = displayDate.getFullYear()
  const currentMonth = displayDate.getMonth() + 1
  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }
  const currentWeek = getWeekNumber(displayDate)

  return (
    <div className="flex-1 overflow-y-auto transition-colors duration-300 bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="px-4 py-2 rounded-xl text-sm font-medium bg-primary/10 text-primary">
            Diario
          </div>
          <Link
            href={`/journal/weekly/${currentYear}-W${currentWeek.toString().padStart(2, '0')}`}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-muted bg-card text-muted-foreground border border-border"
          >
            Semanal
          </Link>
          <Link
            href={`/journal/monthly/${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-muted bg-card text-muted-foreground border border-border"
          >
            Mensual
          </Link>
          <Link
            href={`/journal/yearly/${currentYear}`}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-muted bg-card text-muted-foreground border border-border"
          >
            Anual
          </Link>
        </div>

        {/* Header with Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 md:mb-8 gap-4">
          <button
            onClick={() => goToDate(prev)}
            className="p-3 rounded-xl transition-all hover:scale-[1.05] bg-card border border-border hover:bg-muted"
          >
            <ChevronLeft className="size-5 text-foreground" />
          </button>

          <div className="text-center">
            <button
              onClick={goToToday}
              className={`text-sm px-3 py-1 rounded-full mb-2 transition-all bg-primary/10 text-primary ${isToday ? 'opacity-0' : 'hover:scale-[1.05]'}`}
              disabled={isToday}
            >
              Ir a Hoy
            </button>
            <h1 className="text-3xl font-bold text-foreground">
              {dayName}, {displayDate.getDate()} de {monthName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {displayDate.getFullYear()} {isToday && '(Hoy)'}
            </p>
          </div>

          <button
            onClick={() => goToDate(next)}
            disabled={!next}
            className={`p-3 rounded-xl transition-all bg-card border border-border ${next ? 'hover:scale-[1.05] hover:bg-muted' : 'opacity-30 cursor-not-allowed'}`}
          >
            <ChevronRight className="size-5 text-foreground" />
          </button>
        </div>

        {/* Streak Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-orange-500/10 text-orange-500">
            <Sparkles className="size-4" />
            Racha: {getStreak()} dias
          </div>
        </div>

        {/* Morning Section */}
        <div className="rounded-3xl p-6 mb-6 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Sun className="size-5 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Morning
            </h2>
          </div>

          {/* Gratitude */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span>🙏</span> Gratitud (3)
            </h3>
            <div className="space-y-2">
              {gratitude.map((item, index) => (
                <input
                  key={index}
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newGratitude = [...gratitude]
                    newGratitude[index] = e.target.value
                    setGratitude(newGratitude)
                    handleChange()
                  }}
                  placeholder={`${index + 1}. Estoy agradecido por...`}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background border border-border text-foreground placeholder:text-muted-foreground"
                />
              ))}
            </div>
          </div>

          {/* Daily Intention */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span>🎯</span> Intencion del Dia
            </h3>
            <input
              type="text"
              value={dailyIntention}
              onChange={(e) => {
                setDailyIntention(e.target.value)
                handleChange()
              }}
              placeholder="Mi enfoque principal de hoy es..."
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background border border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* What will make today great */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span>✨</span> Que hara genial el dia de hoy? (3)
            </h3>
            <div className="space-y-2">
              {makeGreat.map((item, index) => (
                <input
                  key={index}
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newMakeGreat = [...makeGreat]
                    newMakeGreat[index] = e.target.value
                    setMakeGreat(newMakeGreat)
                    handleChange()
                  }}
                  placeholder={`${index + 1}. Hoy sera genial si...`}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background border border-border text-foreground placeholder:text-muted-foreground"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="rounded-3xl p-6 mb-6 bg-card border border-border shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <ListTodo className="size-5 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Tareas del Dia {isFutureDate && <span className="text-sm font-normal text-muted-foreground">(Planificacion)</span>}
              </h2>
            </div>
            <button
              onClick={() => setAllowFutureDates(!allowFutureDates)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${allowFutureDates ? 'bg-emerald-500/10 text-emerald-500 ring-2 ring-emerald-400' : 'bg-background text-muted-foreground'}`}
            >
              <CalendarDays className="size-4" />
              Planificar
            </button>
          </div>

          {/* Add new task */}
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Agregar nueva tarea..."
              className="flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-background border border-border text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={addTask}
              className="px-4 py-3 rounded-xl transition-all hover:scale-[1.05] bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Plus className="size-5" />
            </button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              No hay tareas para este dia. Agrega una tarea arriba.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-background border ${task.completed ? 'opacity-60' : ''} ${task.priority === 'high' ? 'border-red-500/40' : task.priority === 'medium' ? 'border-amber-500/40' : 'border-border'}`}
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="flex-shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-foreground ${task.completed ? 'line-through' : ''}`}
                  >
                    {task.text}
                  </span>
                  <select
                    value={task.priority}
                    onChange={(e) => updateTaskPriority(task.id, e.target.value as JournalTask['priority'])}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border-none ${
                      task.priority === 'high' ? 'bg-red-100 text-red-500 dark:bg-red-500/10' : 
                      task.priority === 'medium' ? 'bg-amber-100 text-amber-500 dark:bg-amber-500/10' : 
                      'bg-gray-100 text-gray-500 dark:bg-muted dark:text-muted-foreground'
                    }`}
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Task stats */}
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 flex items-center justify-between border-t border-border">
              <span className="text-sm text-muted-foreground">
                {tasks.filter(t => t.completed).length} de {tasks.length} completadas
              </span>
              <div className="h-2 flex-1 mx-4 rounded-full overflow-hidden bg-background">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                  style={{
                    width: `${(tasks.filter(t => t.completed).length / tasks.length) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Free Thoughts Section */}
        <div className="rounded-3xl p-6 mb-6 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <PenLine className="size-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Pensamientos Libres
            </h2>
          </div>

          <textarea
            value={freeThoughts}
            onChange={(e) => {
              setFreeThoughts(e.target.value)
              handleChange()
            }}
            placeholder="Escribe lo que quieras... ideas, reflexiones, notas mentales, lo que sea que pase por tu mente hoy."
            rows={6}
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-background border border-border text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-xs mt-2 text-muted-foreground">
            Un espacio para escribir sin estructura. Solo tu y tus pensamientos.
          </p>
        </div>

        {/* Quote Section */}
        {quote && (
          <div className="rounded-3xl p-6 mb-6 bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Quote className="size-6 mt-1 text-primary" />
              <div>
                <p className="text-lg italic mb-2 text-foreground">
                  &ldquo;{quote.text}&rdquo;
                </p>
                <p className="text-sm font-medium text-primary">
                  — {quote.author}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Night Section */}
        <div className="rounded-3xl p-6 mb-6 bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Moon className="size-5 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Night
            </h2>
          </div>

          {/* Best Moments */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span>💎</span> Mejores momentos del dia (3)
            </h3>
            <div className="space-y-2">
              {bestMoments.map((item, index) => (
                <input
                  key={index}
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newBestMoments = [...bestMoments]
                    newBestMoments[index] = e.target.value
                    setBestMoments(newBestMoments)
                    handleChange()
                  }}
                  placeholder={`${index + 1}. Un momento increible fue...`}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 bg-background border border-border text-foreground placeholder:text-muted-foreground"
                />
              ))}
            </div>
          </div>

          {/* Lesson Learned */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span>📌</span> Leccion aprendida
            </h3>
            <textarea
              value={lesson}
              onChange={(e) => {
                setLesson(e.target.value)
                handleChange()
              }}
              placeholder="Hoy aprendi que..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none bg-background border border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Mood Selector */}
        <div className="rounded-3xl p-6 mb-6 bg-card border border-border shadow-sm">
          <h3 className="font-semibold mb-4 text-center text-foreground">
            Como te sientes hoy?
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { value: 1, emoji: '😢', label: 'Mal' },
              { value: 2, emoji: '😕', label: 'Regular' },
              { value: 3, emoji: '😐', label: 'Neutral' },
              { value: 4, emoji: '🙂', label: 'Bien' },
              { value: 5, emoji: '😄', label: 'Genial' },
            ].map(({ value, emoji, label }) => (
              <button
                key={value}
                onClick={() => {
                  setMood(value)
                  handleChange()
                }}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all hover:scale-[1.1] ${
                  mood === value ? 'ring-2 ring-purple-400 bg-primary/20' : 'bg-background hover:bg-muted'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs text-muted-foreground">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </span>
            ) : hasChanges ? (
              <span>Cambios sin guardar</span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="size-4 text-green-500" />
                Guardado
              </span>
            )}
          </div>

          {!isComplete && (
            <button
              onClick={handleMarkComplete}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-[1.02] bg-gradient-to-br from-primary/80 to-primary shadow-lg shadow-primary/20"
            >
              <Check className="size-5" />
              Marcar como Completado
            </button>
          )}

          {isComplete && (
            <div
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
              style={{
                backgroundColor: 'rgba(134, 239, 172, 0.2)',
                color: '#22C55E'
              }}
            >
              <Check className="size-5" />
              Completado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
