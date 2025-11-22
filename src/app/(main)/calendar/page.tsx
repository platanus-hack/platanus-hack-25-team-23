"use client"

import { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Settings, RefreshCw, Check, X, Clock, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  color: string
  isStudySession?: boolean
}

interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  colorId?: string
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const COLOR_MAP: Record<string, string> = {
  '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73',
  '5': '#F6BF26', '6': '#F4511E', '7': '#039BE5', '8': '#616161',
  '9': '#3F51B5', '10': '#0B8043', '11': '#D50000', 'default': '#C9B7F3'
}

export default function CalendarPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventTime, setNewEventTime] = useState('09:00')
  const [newEventDuration, setNewEventDuration] = useState('60')

  // Check if Google Calendar is connected
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const token = localStorage.getItem('google_calendar_token')
        if (token) {
          setIsConnected(true)
          await fetchEvents()
        }
      } catch (error) {
        console.error('Error checking connection:', error)
      } finally {
        setIsLoading(false)
      }
    }
    checkConnection()
  }, [])

  const fetchEvents = useCallback(async () => {
    const token = localStorage.getItem('google_calendar_token')
    if (!token) return

    setIsSyncing(true)
    try {
      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString()
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.status === 401) {
        // Token expired
        localStorage.removeItem('google_calendar_token')
        setIsConnected(false)
        toast.error('Sesión expirada. Por favor, reconecta tu calendario.')
        return
      }

      const data = await response.json()

      if (data.items) {
        const calendarEvents: CalendarEvent[] = data.items.map((event: GoogleCalendarEvent) => ({
          id: event.id,
          title: event.summary || 'Sin título',
          description: event.description,
          start: new Date(event.start.dateTime || event.start.date || ''),
          end: new Date(event.end.dateTime || event.end.date || ''),
          color: COLOR_MAP[event.colorId || 'default'] || COLOR_MAP['default'],
          isStudySession: event.summary?.toLowerCase().includes('estudio') || event.summary?.toLowerCase().includes('study')
        }))
        setEvents(calendarEvents)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Error al cargar eventos')
    } finally {
      setIsSyncing(false)
    }
  }, [currentDate])

  useEffect(() => {
    if (isConnected) {
      fetchEvents()
    }
  }, [isConnected, currentDate, fetchEvents])

  const handleGoogleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      toast.error('Google Calendar no está configurado. Contacta al administrador.')
      return
    }

    const redirectUri = `${window.location.origin}/api/auth/callback/google`
    const scope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=consent`

    window.location.href = authUrl
  }

  const handleDisconnect = () => {
    localStorage.removeItem('google_calendar_token')
    setIsConnected(false)
    setEvents([])
    toast.success('Calendario desconectado')
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (number | null)[] = []

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const getEventsForDay = (day: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate.getDate() === day &&
             eventDate.getMonth() === currentDate.getMonth() &&
             eventDate.getFullYear() === currentDate.getFullYear()
    })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(clickedDate)
    setShowEventModal(true)
  }

  const handleCreateStudySession = async () => {
    if (!newEventTitle.trim()) {
      toast.error('Ingresa un título para la sesión')
      return
    }

    const token = localStorage.getItem('google_calendar_token')
    if (!token || !selectedDate) return

    try {
      const [hours, minutes] = newEventTime.split(':').map(Number)
      const startDate = new Date(selectedDate)
      startDate.setHours(hours, minutes, 0, 0)

      const endDate = new Date(startDate)
      endDate.setMinutes(endDate.getMinutes() + parseInt(newEventDuration))

      const event = {
        summary: `📚 Estudio: ${newEventTitle}`,
        description: 'Sesión de estudio creada desde BrainFlow',
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        colorId: '2' // Green for study sessions
      }

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

      if (response.ok) {
        toast.success('Sesión de estudio creada!')
        setShowEventModal(false)
        setNewEventTitle('')
        fetchEvents()
      } else {
        throw new Error('Failed to create event')
      }
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Error al crear la sesión')
    }
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() &&
           currentDate.getMonth() === today.getMonth() &&
           currentDate.getFullYear() === today.getFullYear()
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-500" />
      </div>
    )
  }

  // Setup screen when not connected
  if (!isConnected) {
    return (
      <div className="flex-1 overflow-y-auto transition-colors duration-300" style={{ backgroundColor: 'var(--background)' }}>
        <div className="max-w-2xl mx-auto p-8">
          <div className="text-center mb-8">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)' }}
            >
              <CalendarIcon className="size-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
              Calendario de Estudio
            </h1>
            <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>
              Sincroniza tu Google Calendar para organizar tus sesiones de estudio
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 mb-8">
            {[
              { icon: '📅', title: 'Sincronización automática', desc: 'Tus eventos se sincronizan en tiempo real' },
              { icon: '📚', title: 'Sesiones de estudio', desc: 'Crea sesiones de estudio directamente desde aquí' },
              { icon: '🔔', title: 'Recordatorios', desc: 'Recibe notificaciones para tus sesiones' },
              { icon: '📊', title: 'Seguimiento', desc: 'Visualiza tu progreso de estudio semanal' },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <span className="text-3xl">{feature.icon}</span>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>{feature.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Connect Button */}
          <button
            onClick={handleGoogleConnect}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.4)'
            }}
          >
            <svg className="size-6" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Conectar con Google Calendar
          </button>

          <p className="text-center text-sm mt-4" style={{ color: 'var(--muted-foreground)' }}>
            Solo accedemos a tu calendario para mostrar y crear eventos.
            Puedes desconectarlo en cualquier momento.
          </p>
        </div>
      </div>
    )
  }

  // Calendar view when connected
  return (
    <div className="flex-1 overflow-y-auto transition-colors duration-300" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Calendario
            </h1>
            <p style={{ color: 'var(--muted-foreground)' }}>
              Organiza tus sesiones de estudio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchEvents}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: 'rgba(255, 177, 177, 0.2)', color: '#E57373' }}
            >
              <Settings className="size-4" />
              Desconectar
            </button>
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-xl transition-all hover:scale-[1.05]"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-xl transition-all hover:scale-[1.05]"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Days Header */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {DAYS.map(day => (
              <div key={day} className="text-center py-2 font-semibold text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {getDaysInMonth(currentDate).map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : []
              const hasStudySession = dayEvents.some(e => e.isStudySession)

              return (
                <div
                  key={index}
                  onClick={() => day && handleDayClick(day)}
                  className={`min-h-[100px] p-2 rounded-xl transition-all ${day ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                  style={{
                    backgroundColor: day
                      ? isToday(day)
                        ? 'rgba(201, 183, 243, 0.2)'
                        : 'var(--background)'
                      : 'transparent',
                    border: day && isToday(day) ? '2px solid #C9B7F3' : '1px solid transparent'
                  }}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-medium ${isToday(day) ? 'text-purple-600' : ''}`}
                          style={{ color: isToday(day) ? '#C9B7F3' : 'var(--foreground)' }}
                        >
                          {day}
                        </span>
                        {hasStudySession && (
                          <BookOpen className="size-3" style={{ color: '#33B679' }} />
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className="text-xs px-1.5 py-0.5 rounded truncate"
                            style={{ backgroundColor: event.color, color: 'white' }}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            +{dayEvents.length - 3} más
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's Events */}
        <div
          className="rounded-3xl p-6"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
            Eventos de Hoy
          </h3>
          {events.filter(e => {
            const today = new Date()
            const eventDate = new Date(e.start)
            return eventDate.toDateString() === today.toDateString()
          }).length > 0 ? (
            <div className="space-y-3">
              {events
                .filter(e => {
                  const today = new Date()
                  const eventDate = new Date(e.start)
                  return eventDate.toDateString() === today.toDateString()
                })
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 rounded-2xl"
                    style={{ backgroundColor: 'var(--background)' }}
                  >
                    <div
                      className="w-1 h-12 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1">
                      <h4 className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        <Clock className="size-3" />
                        {event.start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} -
                        {event.end.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {event.isStudySession && (
                      <div
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'rgba(51, 182, 121, 0.2)', color: '#33B679' }}
                      >
                        Estudio
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
              <CalendarIcon className="size-12 mx-auto mb-3 opacity-50" />
              <p>No tienes eventos para hoy</p>
              <p className="text-sm">Haz clic en un día para crear una sesión de estudio</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showEventModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-md rounded-3xl p-6"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                Nueva Sesión de Estudio
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Fecha
                </label>
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  {selectedDate.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  ¿Qué vas a estudiar?
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Ej: JavaScript, Matemáticas, etc."
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                  style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                    Hora de inicio
                  </label>
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                    style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                    Duración
                  </label>
                  <select
                    value={newEventDuration}
                    onChange={(e) => setNewEventDuration(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
                    style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="30">30 min</option>
                    <option value="60">1 hora</option>
                    <option value="90">1.5 horas</option>
                    <option value="120">2 horas</option>
                    <option value="180">3 horas</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateStudySession}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                  boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.4)'
                }}
              >
                <Plus className="size-5" />
                Crear Sesión de Estudio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
