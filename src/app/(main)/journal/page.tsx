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
  CalendarDays
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
      quote,
      mood,
      tasks,
      is_complete: isComplete
    }, 'daily')

    setHasChanges(false)
  }, [session, currentDate, gratitude, dailyIntention, makeGreat, bestMoments, lesson, quote, mood, tasks, isComplete, createOrUpdateEntry])

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
  }, [hasChanges, gratitude, dailyIntention, makeGreat, bestMoments, lesson, mood, tasks, isComplete, session?.user, saveEntry])

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
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center max-w-md p-8">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)' }}
          >
            <BookHeart className="size-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
            Journal Personal
          </h2>
          <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Inicia sesion para acceder a tu journal personal y llevar un registro de tu crecimiento diario.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
            }}
          >
            Iniciar Sesion
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading && !currentEntry) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <Loader2 className="size-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto transition-colors duration-300" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto p-8">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => goToDate(prev)}
            className="p-3 rounded-xl transition-all hover:scale-[1.05]"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="text-center">
            <button
              onClick={goToToday}
              className={`text-sm px-3 py-1 rounded-full mb-2 transition-all ${isToday ? 'opacity-0' : 'hover:scale-[1.05]'}`}
              style={{
                backgroundColor: 'rgba(201, 183, 243, 0.2)',
                color: '#C9B7F3'
              }}
              disabled={isToday}
            >
              Ir a Hoy
            </button>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              {dayName}, {displayDate.getDate()} de {monthName}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {displayDate.getFullYear()} {isToday && '(Hoy)'}
            </p>
          </div>

          <button
            onClick={() => goToDate(next)}
            disabled={!next}
            className={`p-3 rounded-xl transition-all ${next ? 'hover:scale-[1.05]' : 'opacity-30 cursor-not-allowed'}`}
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Streak Badge */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'rgba(255, 157, 93, 0.2)',
              color: '#FF9D5D'
            }}
          >
            <Sparkles className="size-4" />
            Racha: {getStreak()} dias
          </div>
        </div>

        {/* Morning Section */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: 'rgba(255, 183, 77, 0.2)' }}
            >
              <Sun className="size-5" style={{ color: '#FFB74D' }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              Morning
            </h2>
          </div>

          {/* Gratitude */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
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
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                  style={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Daily Intention */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
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
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)'
              }}
            />
          </div>

          {/* What will make today great */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
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
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                  style={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-xl"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
              >
                <ListTodo className="size-5" style={{ color: '#10B981' }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                Tareas del Dia {isFutureDate && <span className="text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>(Planificacion)</span>}
              </h2>
            </div>
            <button
              onClick={() => setAllowFutureDates(!allowFutureDates)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${allowFutureDates ? 'ring-2 ring-green-400' : ''}`}
              style={{
                backgroundColor: allowFutureDates ? 'rgba(16, 185, 129, 0.2)' : 'var(--background)',
                color: allowFutureDates ? '#10B981' : 'var(--muted-foreground)'
              }}
            >
              <CalendarDays className="size-4" />
              Planificar
            </button>
          </div>

          {/* Add new task */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Agregar nueva tarea..."
              className="flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)'
              }}
            />
            <button
              onClick={addTask}
              className="px-4 py-3 rounded-xl transition-all hover:scale-[1.05]"
              style={{
                backgroundColor: '#10B981',
                color: 'white'
              }}
            >
              <Plus className="size-5" />
            </button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <p className="text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
              No hay tareas para este dia. Agrega una tarea arriba.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${task.completed ? 'opacity-60' : ''}`}
                  style={{
                    backgroundColor: 'var(--background)',
                    border: `1px solid ${task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#6B7280'}40`
                  }}
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="flex-shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="size-5" style={{ color: '#10B981' }} />
                    ) : (
                      <Circle className="size-5" style={{ color: 'var(--muted-foreground)' }} />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${task.completed ? 'line-through' : ''}`}
                    style={{ color: 'var(--foreground)' }}
                  >
                    {task.text}
                  </span>
                  <select
                    value={task.priority}
                    onChange={(e) => updateTaskPriority(task.id, e.target.value as JournalTask['priority'])}
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: task.priority === 'high' ? '#FEE2E2' : task.priority === 'medium' ? '#FEF3C7' : '#F3F4F6',
                      color: task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#6B7280',
                      border: 'none'
                    }}
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="size-4" style={{ color: '#EF4444' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Task stats */}
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {tasks.filter(t => t.completed).length} de {tasks.length} completadas
              </span>
              <div className="h-2 flex-1 mx-4 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(tasks.filter(t => t.completed).length / tasks.length) * 100}%`,
                    backgroundColor: '#10B981'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quote Section */}
        {quote && (
          <div
            className="rounded-3xl p-6 mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(201, 183, 243, 0.2) 0%, rgba(214, 201, 245, 0.2) 100%)',
              border: '1px solid rgba(201, 183, 243, 0.3)'
            }}
          >
            <div className="flex items-start gap-3">
              <Quote className="size-6 mt-1" style={{ color: '#C9B7F3' }} />
              <div>
                <p className="text-lg italic mb-2" style={{ color: 'var(--foreground)' }}>
                  &ldquo;{quote.text}&rdquo;
                </p>
                <p className="text-sm font-medium" style={{ color: '#C9B7F3' }}>
                  — {quote.author}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Night Section */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: 'rgba(149, 117, 205, 0.2)' }}
            >
              <Moon className="size-5" style={{ color: '#9575CD' }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              Night
            </h2>
          </div>

          {/* Best Moments */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
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
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                  style={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Lesson Learned */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
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
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)'
              }}
            />
          </div>
        </div>

        {/* Mood Selector */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold mb-4 text-center" style={{ color: 'var(--foreground)' }}>
            Como te sientes hoy?
          </h3>
          <div className="flex justify-center gap-4">
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
                  mood === value ? 'ring-2 ring-purple-400' : ''
                }`}
                style={{
                  backgroundColor: mood === value ? 'rgba(201, 183, 243, 0.2)' : 'var(--background)'
                }}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
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
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.4)'
              }}
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
