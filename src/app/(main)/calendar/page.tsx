"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, RefreshCw, X, Clock, BookOpen, UserCog, LogOut, CalendarDays, LayoutGrid } from 'lucide-react'
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

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

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
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

  // Refresh access token using refresh token
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('google_calendar_refresh_token')
    if (!refreshToken) {
      return null
    }

    try {
      const response = await fetch('/api/auth/google-calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        console.error('Token refresh failed:', data.error)
        return null
      }

      // Update stored tokens
      localStorage.setItem('google_calendar_token', data.access_token)
      const expirationTime = Date.now() + data.expires_in * 1000
      localStorage.setItem('google_calendar_token_expiry', expirationTime.toString())

      return data.access_token
    } catch (error) {
      console.error('Error refreshing token:', error)
      return null
    }
  }, [])

  // Get valid access token (refresh if needed)
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const token = localStorage.getItem('google_calendar_token')
    const expiry = localStorage.getItem('google_calendar_token_expiry')

    if (!token) {
      return null
    }

    // Check if token is expired or will expire in next 5 minutes
    if (expiry) {
      const expiryTime = parseInt(expiry)
      const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000

      if (expiryTime < fiveMinutesFromNow) {
        // Token expired or expiring soon, try to refresh
        const newToken = await refreshAccessToken()
        return newToken
      }
    }

    return token
  }, [refreshAccessToken])

  // Check connection and get user info
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const token = await getValidToken()

        if (token) {
          setIsConnected(true)

          // Get user info
          try {
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (userResponse.ok) {
              const userData = await userResponse.json()
              setConnectedEmail(userData.email)
            }
          } catch (e) {
            // Ignore user info errors
          }

          await fetchEvents(token)
        } else {
          // Check if we have a refresh token to try
          const refreshToken = localStorage.getItem('google_calendar_refresh_token')
          if (refreshToken) {
            const newToken = await refreshAccessToken()
            if (newToken) {
              setIsConnected(true)
              await fetchEvents(newToken)
            }
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error)
      } finally {
        setIsLoading(false)
      }
    }
    checkConnection()
  }, [getValidToken, refreshAccessToken])

  const fetchEvents = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride || await getValidToken()
    if (!token) return

    setIsSyncing(true)
    try {
      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString()
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (response.status === 401) {
        // Token invalid, try to refresh
        const newToken = await refreshAccessToken()
        if (newToken) {
          // Retry with new token
          await fetchEvents(newToken)
          return
        } else {
          // Refresh failed, disconnect
          handleDisconnect()
          toast.error('Sesion expirada. Por favor, reconecta tu calendario.')
          return
        }
      }

      const data = await response.json()

      if (data.items) {
        const calendarEvents: CalendarEvent[] = data.items.map((event: GoogleCalendarEvent) => ({
          id: event.id,
          title: event.summary || 'Sin titulo',
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
  }, [currentDate, getValidToken, refreshAccessToken])

  useEffect(() => {
    if (isConnected) {
      fetchEvents()
    }
  }, [isConnected, currentDate, fetchEvents])

  const handleGoogleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      toast.error('Google Calendar no esta configurado. Contacta al administrador.')
      return
    }

    // Use authorization code flow for refresh tokens
    const redirectUri = `${window.location.origin}/calendar/callback`
    const scope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` + // Changed from 'token' to 'code'
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` + // Request refresh token
      `&prompt=consent` // Always show consent to get refresh token

    window.location.href = authUrl
  }

  const handleDisconnect = () => {
    localStorage.removeItem('google_calendar_token')
    localStorage.removeItem('google_calendar_refresh_token')
    localStorage.removeItem('google_calendar_token_expiry')
    setIsConnected(false)
    setConnectedEmail(null)
    setEvents([])
    toast.success('Calendario desconectado')
  }

  const handleChangeAccount = () => {
    // Disconnect current and reconnect with new account
    handleDisconnect()
    setTimeout(() => {
      handleGoogleConnect()
    }, 500)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (number | null)[] = []

    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

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

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 7)
      } else {
        newDate.setDate(newDate.getDate() + 7)
      }
      return newDate
    })
  }

  // Get the week's dates (Sunday to Saturday)
  const getWeekDates = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - day)

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }, [currentDate])

  // Get events for a specific day in week view
  const getEventsForWeekDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  // Check if date is today
  const isDateToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Format week range for header
  const weekRangeText = useMemo(() => {
    const start = getWeekDates[0]
    const end = getWeekDates[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} de ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
    }
    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`
  }, [getWeekDates])

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(clickedDate)
    setShowEventModal(true)
  }

  const handleCreateStudySession = async () => {
    if (!newEventTitle.trim()) {
      toast.error('Ingresa un titulo para la sesion')
      return
    }

    const token = await getValidToken()
    if (!token || !selectedDate) return

    try {
      const [hours, minutes] = newEventTime.split(':').map(Number)
      const startDate = new Date(selectedDate)
      startDate.setHours(hours, minutes, 0, 0)

      const endDate = new Date(startDate)
      endDate.setMinutes(endDate.getMinutes() + parseInt(newEventDuration))

      const event = {
        summary: `Estudio: ${newEventTitle}`,
        description: 'Sesion de estudio creada desde BrainFlow',
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        colorId: '2'
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
        toast.success('Sesion de estudio creada!')
        setShowEventModal(false)
        setNewEventTitle('')
        fetchEvents()
      } else {
        throw new Error('Failed to create event')
      }
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Error al crear la sesion')
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
        <div
          className="animate-spin rounded-full h-12 w-12 border-4"
          style={{ borderColor: '#E6DAFF', borderTopColor: '#C9B7F3' }}
        />
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
              { icon: '📅', title: 'Sincronizacion permanente', desc: 'Una vez conectado, nunca expira' },
              { icon: '📚', title: 'Sesiones de estudio', desc: 'Crea sesiones de estudio directamente' },
              { icon: '🔔', title: 'Recordatorios', desc: 'Recibe notificaciones para tus sesiones' },
              { icon: '🔄', title: 'Cambio de cuenta', desc: 'Puedes cambiar de cuenta cuando quieras' },
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
            {/* View Mode Toggle */}
            <div
              className="flex items-center p-1 rounded-xl"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${viewMode === 'month' ? 'shadow-sm' : ''}`}
                style={{
                  backgroundColor: viewMode === 'month' ? 'var(--card)' : 'transparent',
                  color: viewMode === 'month' ? '#C9B7F3' : 'var(--muted-foreground)'
                }}
              >
                <LayoutGrid className="size-4" />
                Mes
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${viewMode === 'week' ? 'shadow-sm' : ''}`}
                style={{
                  backgroundColor: viewMode === 'week' ? 'var(--card)' : 'transparent',
                  color: viewMode === 'week' ? '#C9B7F3' : 'var(--muted-foreground)'
                }}
              >
                <CalendarDays className="size-4" />
                Semana
              </button>
            </div>
            <button
              onClick={() => fetchEvents()}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
            <button
              onClick={handleChangeAccount}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#CFE4FF', color: '#5A8FCC' }}
              title={connectedEmail ? `Conectado como: ${connectedEmail}` : 'Cambiar cuenta'}
            >
              <UserCog className="size-4" />
              Cambiar cuenta
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#FFD9D9', color: '#D46A6A' }}
            >
              <LogOut className="size-4" />
              Desconectar
            </button>
          </div>
        </div>

        {/* Connected account info */}
        {connectedEmail && (
          <div
            className="mb-6 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{ backgroundColor: '#D4F5E9', border: '1px solid #A3E4B6' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10B981' }}>
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#10B981' }}>
                Calendario conectado permanentemente
              </p>
              <p className="text-xs" style={{ color: '#6D6D6D' }}>
                {connectedEmail}
              </p>
            </div>
          </div>
        )}

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => viewMode === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
            className="p-2 rounded-xl transition-all hover:scale-[1.05]"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {viewMode === 'month'
                ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                : weekRangeText
              }
            </h2>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-sm mt-1 px-3 py-1 rounded-full transition-all hover:scale-[1.05]"
              style={{ backgroundColor: 'rgba(201, 183, 243, 0.2)', color: '#C9B7F3' }}
            >
              Ir a hoy
            </button>
          </div>
          <button
            onClick={() => viewMode === 'month' ? navigateMonth('next') : navigateWeek('next')}
            className="p-2 rounded-xl transition-all hover:scale-[1.05]"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Monthly View */}
        {viewMode === 'month' && (
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
                              +{dayEvents.length - 3} mas
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
        )}

        {/* Weekly View */}
        {viewMode === 'week' && (
          <div
            className="rounded-3xl p-6 mb-6 overflow-x-auto"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Week Days Header */}
            <div className="grid grid-cols-8 gap-2 mb-4 min-w-[800px]">
              <div className="w-16" /> {/* Space for time column */}
              {getWeekDates.map((date, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedDate(date)
                    setShowEventModal(true)
                  }}
                  className={`text-center p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${isDateToday(date) ? 'ring-2 ring-purple-400' : ''}`}
                  style={{
                    backgroundColor: isDateToday(date) ? 'rgba(201, 183, 243, 0.2)' : 'var(--background)'
                  }}
                >
                  <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {DAYS_FULL[index]}
                  </div>
                  <div
                    className="text-2xl font-bold mt-1"
                    style={{ color: isDateToday(date) ? '#C9B7F3' : 'var(--foreground)' }}
                  >
                    {date.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Grid */}
            <div className="min-w-[800px]" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {HOURS.slice(6, 23).map(hour => (
                <div key={hour} className="grid grid-cols-8 gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  {/* Time Label */}
                  <div className="w-16 py-2 text-xs text-right pr-2" style={{ color: 'var(--muted-foreground)' }}>
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {/* Day columns */}
                  {getWeekDates.map((date, dayIndex) => {
                    const dayEvents = getEventsForWeekDay(date).filter(event => {
                      const eventHour = event.start.getHours()
                      return eventHour === hour
                    })

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => {
                          const clickedDate = new Date(date)
                          clickedDate.setHours(hour, 0, 0, 0)
                          setSelectedDate(clickedDate)
                          setNewEventTime(`${hour.toString().padStart(2, '0')}:00`)
                          setShowEventModal(true)
                        }}
                        className="min-h-[50px] p-1 rounded-lg cursor-pointer transition-all hover:bg-purple-50 dark:hover:bg-purple-900/10"
                        style={{ backgroundColor: 'transparent' }}
                      >
                        {dayEvents.map(event => {
                          const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60)
                          const height = Math.max(duration / 60 * 50, 24)

                          return (
                            <div
                              key={event.id}
                              className="text-xs px-2 py-1 rounded-lg mb-1 overflow-hidden"
                              style={{
                                backgroundColor: event.color,
                                color: 'white',
                                minHeight: `${height}px`
                              }}
                              title={`${event.title}\n${event.start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} - ${event.end.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`}
                            >
                              <div className="font-medium truncate">{event.title}</div>
                              <div className="text-xs opacity-80">
                                {event.start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

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
              <p className="text-sm">Haz clic en un dia para crear una sesion de estudio</p>
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
                Nueva Sesion de Estudio
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
                  Que vas a estudiar?
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Ej: JavaScript, Matematicas, etc."
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
                    Duracion
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
                Crear Sesion de Estudio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
