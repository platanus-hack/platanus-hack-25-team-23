"use client"

import { useMemo } from "react"
import { useKnowledge } from "@/lib/store/knowledge-context"
import { useAreas } from "@/lib/store/areas-context"
import { useJournal, formatDate } from "@/lib/store/journal-context"
import { BookOpen, TrendingUp, Clock, Target, ArrowRight, Plus, MapPin, Flame, Lightbulb, Star, BookHeart, Sun, Moon, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { detectAreaFromContent } from "@/lib/data/areas-config"

interface AreaWithProgress {
  id: string
  name: string
  color: string
  icon: string
  progress: number
  total: number
  understood: number
  inProgress: number
  hours: number
}

interface DashboardStats {
  total_notes: number
  understood_notes: number
  in_progress_notes: number
  total_study_time: number
}

// Circular progress component
function CircularProgress({ percentage, color, size = 100, strokeWidth = 8 }: { percentage: number; color: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>
          {percentage}%
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { notes, currentNote } = useKnowledge()
  const { areas: contextAreas } = useAreas()
  const { getEntry, getStreak: getJournalStreak } = useJournal()
  // No async loading needed - all data comes from context
  const loading = false
  // Get streak from journal entries
  const streak = getJournalStreak()

  // Journal data
  const todayDate = formatDate(new Date())
  const todayEntry = getEntry(todayDate)
  const journalStreak = getJournalStreak()
  const hasMorningComplete = todayEntry && todayEntry.gratitude.some(g => g.trim() !== '') && todayEntry.daily_intention.trim() !== ''
  const hasNightComplete = todayEntry && todayEntry.best_moments.some(m => m.trim() !== '') && todayEntry.lesson.trim() !== ''

  // Calculate stats from notes in context (works without authentication)
  // Note status: 'new' | 'read' | 'understood'
  // 'read' = en progreso, 'understood' = completado, 'new' = pendiente
  const stats = useMemo<DashboardStats>(() => {
    const understood = notes.filter(n => n.status === 'understood').length
    const inProgress = notes.filter(n => n.status === 'read').length
    return {
      total_notes: notes.length,
      understood_notes: understood,
      in_progress_notes: inProgress,
      total_study_time: notes.length * 2 // Estimated 2 hours per note
    }
  }, [notes])

  // Calculate areas with progress based on notes
  const areasWithProgress = useMemo<AreaWithProgress[]>(() => {
    // Group notes by area
    const notesByArea: Record<string, typeof notes> = {}

    notes.forEach(note => {
      const detectedArea = detectAreaFromContent(note.title, note.content)
      const areaName = detectedArea?.name || contextAreas[0]?.name || 'General'

      if (!notesByArea[areaName]) {
        notesByArea[areaName] = []
      }
      notesByArea[areaName].push(note)
    })

    // Map context areas with their note counts
    return contextAreas
      .map(area => {
        const areaNotes = notesByArea[area.name] || []
        const understood = areaNotes.filter(n => n.status === 'understood').length
        const inProgress = areaNotes.filter(n => n.status === 'read').length
        const total = areaNotes.length

        // Progress: understood = 100%, in progress = 50% credit
        const progressValue = total > 0
          ? Math.round(((understood + inProgress * 0.5) / total) * 100)
          : 0

        return {
          id: area.id,
          name: area.name,
          color: area.color,
          icon: area.icon,
          total,
          understood,
          inProgress,
          progress: progressValue,
          hours: total * 2
        }
      })
      .filter(a => a.total > 0)
  }, [notes, contextAreas])

  // Progress: understood = 100%, in progress = 50% credit (same as area progress)
  const progressPercent = stats.total_notes > 0
    ? Math.round(((stats.understood_notes + stats.in_progress_notes * 0.5) / stats.total_notes) * 100)
    : 0

  const completedHours = stats.understood_notes * 2
  const remainingHours = (stats.total_notes - stats.understood_notes) * 2

  const recentNotes = notes.slice(-3).reverse()
  // Use currentNote (last viewed) if available, otherwise fall back to most recent note
  const lastStudiedNote = currentNote || recentNotes[0]
  // Get the area of the last studied note
  const lastStudiedArea = lastStudiedNote ? detectAreaFromContent(lastStudiedNote.title, lastStudiedNote.content) : null

  return (
    <div
      className="flex-1 overflow-y-auto transition-colors duration-300"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="max-w-7xl mx-auto p-8 space-y-8">

        {/* Header - Clean Style */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: '#222222' }}>
              Hola! 👋
            </h1>
            <p className="text-sm" style={{ color: '#6D6D6D' }}>
              Continua tu camino de aprendizaje con calma y enfoque
            </p>
          </div>

          <Link
            href="/new-query"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: '#FFD9D9',
              color: '#222222'
            }}
          >
            <Plus className="size-4" />
            Nueva Consulta
          </Link>
        </div>

        {/* Hero Stats Cards - Clean Minimal Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Progress Card */}
          <div
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#E6DAFF' }}
              >
                <Target className="size-5" style={{ color: '#9575CD' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>Progreso Global</p>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>
                  {loading ? '-' : `${progressPercent}%`}
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F6F5F2' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%`, backgroundColor: '#C9B7F3' }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#9A9A9A' }}>
              {loading ? '-' : (
                stats.understood_notes > 0 || stats.in_progress_notes > 0 ? (
                  <>
                    {stats.understood_notes > 0 && <span style={{ color: '#10B981' }}>✓{stats.understood_notes}</span>}
                    {stats.understood_notes > 0 && stats.in_progress_notes > 0 && ' '}
                    {stats.in_progress_notes > 0 && <span style={{ color: '#F59E0B' }}>◐{stats.in_progress_notes}</span>}
                    {' / '}{stats.total_notes} notas
                  </>
                ) : (
                  `${stats.total_notes} notas pendientes`
                )
              )}
            </p>
          </div>

          {/* In Progress Card */}
          <div
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#FFF0E6' }}
              >
                <BookOpen className="size-5" style={{ color: '#F5A962' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>En Progreso</p>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>
                  {loading ? '-' : stats.in_progress_notes}
                </p>
              </div>
            </div>
            <p className="text-xs" style={{ color: '#9A9A9A' }}>Temas activos ahora</p>
            {stats.in_progress_notes > 0 && (
              <Link
                href="/tree"
                className="text-sm font-medium mt-3 inline-block hover:underline"
                style={{ color: '#F5A962' }}
              >
                Ver detalles →
              </Link>
            )}
          </div>

          {/* Time Card */}
          <div
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#CFE4FF' }}
              >
                <Clock className="size-5" style={{ color: '#5A8FCC' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>Tiempo Restante</p>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>
                  {loading ? '-' : `${remainingHours}h`}
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F6F5F2' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${stats.total_study_time > 0 ? (completedHours / stats.total_study_time) * 100 : 0}%`,
                  backgroundColor: '#7FBFFF'
                }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#9A9A9A' }}>{completedHours}h completadas</p>
          </div>

          {/* Streak Card */}
          <div
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#FFD9D9' }}
              >
                <Flame className="size-5" style={{ color: '#E57373' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>Racha Actual</p>
                <p className="text-2xl font-bold" style={{ color: '#222222' }}>
                  {loading ? '-' : streak} <span className="text-base font-normal">dias</span>
                </p>
              </div>
            </div>
            <p className="text-xs" style={{ color: '#9A9A9A' }}>dias consecutivos</p>
            <Link
              href="/profile"
              className="text-sm font-medium mt-3 inline-block hover:underline"
              style={{ color: '#E57373' }}
            >
              Ver perfil →
            </Link>
          </div>
        </div>

        {/* Journal Quick Access - Clean Style */}
        <div
          className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
          style={{
            backgroundColor: 'white',
            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#E6DAFF' }}
              >
                <BookHeart className="size-6" style={{ color: '#9575CD' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#222222' }}>
                  Journal de Hoy
                </h3>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sun className="size-4" style={{ color: hasMorningComplete ? '#10B981' : '#9A9A9A' }} />
                  <span className="text-sm" style={{ color: hasMorningComplete ? '#10B981' : '#6D6D6D' }}>
                    Morning {hasMorningComplete && <CheckCircle2 className="inline size-3 ml-1" />}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="size-4" style={{ color: hasNightComplete ? '#10B981' : '#9A9A9A' }} />
                  <span className="text-sm" style={{ color: hasNightComplete ? '#10B981' : '#6D6D6D' }}>
                    Night {hasNightComplete && <CheckCircle2 className="inline size-3 ml-1" />}
                  </span>
                </div>
              </div>

              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: '#FFF0E6' }}
              >
                <Flame className="size-4" style={{ color: '#F5A962' }} />
                <span className="text-sm font-medium" style={{ color: '#F5A962' }}>{journalStreak} dias</span>
              </div>

              <Link
                href="/journal"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222'
                }}
              >
                Abrir Journal
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Continue Studying - Clean Style */}
        {lastStudiedNote && (
          <div
            className="rounded-2xl p-6 hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: '#FFF0E6',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'white' }}
                >
                  <Lightbulb className="size-7" style={{ color: '#F5A962' }} />
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: '#6D6D6D' }}>Continuar donde dejaste</p>
                  <h3 className="text-xl font-bold" style={{ color: '#222222' }}>{lastStudiedNote.title}</h3>
                  <p className="text-sm" style={{ color: '#9A9A9A' }}>
                    {lastStudiedArea ? `${lastStudiedArea.icon} ${lastStudiedArea.name}` : 'General'} • {lastStudiedNote.status === 'understood' ? 'Completado' : lastStudiedNote.status === 'read' ? 'En progreso' : 'Nuevo'}
                  </p>
                </div>
              </div>
              <Link
                href={`/study?topic=${encodeURIComponent(lastStudiedNote.title)}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222'
                }}
              >
                Continuar Estudiando
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Progress by Area - Clean Style */}
        {areasWithProgress.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#222222' }}>
                  Progreso por Area
                </h2>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>
                  Visualiza tu avance en cada area
                </p>
              </div>
              <Link
                href="/tree"
                className="text-sm font-medium flex items-center gap-1 hover:underline"
                style={{ color: '#9575CD' }}
              >
                Ver todo
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {areasWithProgress.map(area => (
                <Link
                  key={area.id}
                  href="/tree"
                  className="rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:shadow-md"
                  style={{
                    backgroundColor: 'white',
                    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div className="flex justify-center mb-3">
                    <CircularProgress
                      percentage={area.progress || 0}
                      color={area.color}
                      size={64}
                      strokeWidth={5}
                    />
                  </div>

                  <div className="text-center">
                    <div className="text-2xl mb-1">{area.icon || '📚'}</div>
                    <h3 className="font-medium text-xs leading-tight mb-1" style={{ color: '#222222' }}>
                      {area.name}
                    </h3>
                    <p className="text-xs" style={{ color: '#9A9A9A' }}>
                      {area.understood > 0 || area.inProgress > 0 ? (
                        <>
                          {area.understood > 0 && <span style={{ color: '#10B981' }}>✓{area.understood}</span>}
                          {area.understood > 0 && area.inProgress > 0 && ' '}
                          {area.inProgress > 0 && <span style={{ color: '#F59E0B' }}>◐{area.inProgress}</span>}
                          <span> / {area.total}</span>
                        </>
                      ) : (
                        `${area.total} temas`
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations - Clean Style */}
        {(stats.in_progress_notes > 0 || recentNotes.length > 0) && (
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: '#222222' }}>
              Recomendaciones
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* In Progress Reminder */}
              {stats.in_progress_notes > 0 && (
                <div
                  className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
                  style={{
                    backgroundColor: 'white',
                    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#FFF0E6' }}
                    >
                      <TrendingUp className="size-5" style={{ color: '#F5A962' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1" style={{ color: '#222222' }}>
                        Temas en progreso
                      </h3>
                      <p className="text-sm mb-3" style={{ color: '#6D6D6D' }}>
                        Tienes {stats.in_progress_notes} nota(s) en progreso
                      </p>
                      <Link
                        href="/tree"
                        className="text-sm font-medium hover:underline"
                        style={{ color: '#F5A962' }}
                      >
                        Ver todos →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Topics */}
              {recentNotes.length > 0 && (
                <div
                  className="rounded-2xl p-5 hover:shadow-md transition-all duration-300"
                  style={{
                    backgroundColor: 'white',
                    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#CFE4FF' }}
                    >
                      <Star className="size-5" style={{ color: '#5A8FCC' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1" style={{ color: '#222222' }}>
                        Notas recientes
                      </h3>
                      <p className="text-sm mb-3" style={{ color: '#6D6D6D' }}>
                        Revisa lo que aprendiste
                      </p>
                      <div className="space-y-2">
                        {recentNotes.slice(0, 2).map(note => (
                          <Link
                            key={note.slug}
                            href={`/study?topic=${encodeURIComponent(note.title)}`}
                            className="block text-sm font-medium hover:underline"
                            style={{ color: '#5A8FCC' }}
                          >
                            {note.title} →
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions - Clean Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/graph"
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300 text-left"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#E6DAFF' }}
              >
                <MapPin className="size-5" style={{ color: '#9575CD' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#222222' }}>
                  Explorar Grafo
                </h3>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>
                  Visualiza conexiones
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/library"
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300 text-left"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#CFE4FF' }}
              >
                <BookOpen className="size-5" style={{ color: '#5A8FCC' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#222222' }}>
                  Biblioteca
                </h3>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>
                  Gestiona areas y temas
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/tree"
            className="rounded-2xl p-5 hover:shadow-md transition-all duration-300 text-left"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#D4F5E9' }}
              >
                <Target className="size-5" style={{ color: '#10B981' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#222222' }}>
                  Ver Ruta
                </h3>
                <p className="text-sm" style={{ color: '#6D6D6D' }}>
                  Planifica tu progreso
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Empty State - Clean Style */}
        {recentNotes.length === 0 && !loading && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              backgroundColor: 'white',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#E6DAFF' }}
            >
              <BookOpen className="size-8" style={{ color: '#9575CD' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#222222' }}>Sin notas aun</h3>
            <p className="text-sm mb-5" style={{ color: '#6D6D6D' }}>Empieza a aprender creando tu primera nota</p>
            <Link
              href="/new-query"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: '#FFD9D9',
                color: '#222222'
              }}
            >
              <Plus className="size-4" />
              Nueva Consulta
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
