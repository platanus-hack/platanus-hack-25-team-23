'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Check, Loader2, X, Phone, Bell, Clock, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface ConnectionStatus {
  connected: boolean
  phoneNumber?: string
  isActive?: boolean
  connectedAt?: string
  connectionId?: string
}

interface ReminderSettings {
  morning_enabled: boolean
  morning_time: string
  night_enabled: boolean
  night_time: string
  weekly_enabled: boolean
}

export function WhatsAppConnect() {
  const [step, setStep] = useState<'loading' | 'input' | 'verify' | 'connected'>('loading')
  const [phone, setPhone] = useState('')
  const [reminders, setReminders] = useState<ReminderSettings>({
    morning_enabled: true,
    morning_time: '08:00',
    night_enabled: true,
    night_time: '21:00',
    weekly_enabled: true
  })
  const [savingReminders, setSavingReminders] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)

  // Check current connection status on mount
  useEffect(() => {
    checkConnectionStatus()
  }, [])

  const checkConnectionStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/connect')
      if (res.ok) {
        const data = await res.json()
        setConnectionStatus(data)
        if (data.connected) {
          setStep('connected')
          setPhone(data.phoneNumber || '')
        } else {
          setStep('input')
        }
      } else {
        setStep('input')
      }
    } catch {
      setStep('input')
    }
  }

  const handleSendCode = async () => {
    if (!phone) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      })

      const data = await res.json()

      if (res.ok) {
        setStep('verify')
      } else {
        setError(data.error || 'Error al enviar el código')
      }
    } catch {
      setError('Error de conexión')
    }

    setLoading(false)
  }

  const handleVerify = async () => {
    if (code.length !== 6) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/whatsapp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })

      const data = await res.json()

      if (res.ok) {
        setStep('connected')
        setConnectionStatus({ connected: true, phoneNumber: phone })
      } else {
        setError(data.error || 'Código inválido')
      }
    } catch {
      setError('Error de conexión')
    }

    setLoading(false)
  }

  const handleDisconnect = async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'DELETE' })

      if (res.ok) {
        setStep('input')
        setPhone('')
        setCode('')
        setConnectionStatus(null)
      }
    } catch {
      setError('Error al desconectar')
    }

    setLoading(false)
  }

  if (step === 'loading') {
    return (
      <Card className="border-2">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </CardContent>
      </Card>
    )
  }

  if (step === 'connected') {
    return (
      <Card className="border-2 border-green-200 bg-green-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-green-800">WhatsApp Conectado</CardTitle>
                <CardDescription className="text-green-600">
                  {connectionStatus?.phoneNumber || phone}
                </CardDescription>
              </div>
            </div>
            <Check className="h-6 w-6 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Reminder Settings */}
            <div className="rounded-lg bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-gray-600" />
                <p className="font-medium text-gray-800">Recordatorios</p>
              </div>

              {/* Morning Reminder */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-gray-700">Journal Matutino</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={reminders.morning_time}
                    onChange={(e) => setReminders({ ...reminders, morning_time: e.target.value })}
                    disabled={!reminders.morning_enabled}
                    className="text-sm border rounded px-2 py-1 disabled:opacity-50"
                  />
                  <button
                    onClick={() => setReminders({ ...reminders, morning_enabled: !reminders.morning_enabled })}
                    className={`w-10 h-5 rounded-full transition-all p-0.5 ${reminders.morning_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reminders.morning_enabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Night Reminder */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm text-gray-700">Reflexion Nocturna</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={reminders.night_time}
                    onChange={(e) => setReminders({ ...reminders, night_time: e.target.value })}
                    disabled={!reminders.night_enabled}
                    className="text-sm border rounded px-2 py-1 disabled:opacity-50"
                  />
                  <button
                    onClick={() => setReminders({ ...reminders, night_enabled: !reminders.night_enabled })}
                    className={`w-10 h-5 rounded-full transition-all p-0.5 ${reminders.night_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reminders.night_enabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Weekly Check-in */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-gray-700">Check-in Semanal (Dom)</span>
                </div>
                <button
                  onClick={() => setReminders({ ...reminders, weekly_enabled: !reminders.weekly_enabled })}
                  className={`w-10 h-5 rounded-full transition-all p-0.5 ${reminders.weekly_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reminders.weekly_enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <Button
                onClick={async () => {
                  setSavingReminders(true)
                  try {
                    const res = await fetch('/api/whatsapp/reminders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(reminders)
                    })
                    if (res.ok) {
                      toast.success('Recordatorios guardados')
                    } else {
                      toast.error('Error al guardar')
                    }
                  } catch {
                    toast.error('Error de conexion')
                  }
                  setSavingReminders(false)
                }}
                disabled={savingReminders}
                className="w-full mt-3 bg-green-500 hover:bg-green-600"
                size="sm"
              >
                {savingReminders ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Recordatorios
              </Button>
            </div>

            {/* Commands */}
            <div className="rounded-lg bg-white p-4 text-sm">
              <p className="font-medium text-gray-800 mb-2">Escribe naturalmente:</p>
              <ul className="space-y-1 text-gray-600">
                <li>📝 "journal" o "quiero hacer mi journal"</li>
                <li>📊 "estadisticas" o "como voy"</li>
                <li>💭 "/nota [texto]" - Nota rapida</li>
                <li>🎯 "metas" - Ver progreso de metas</li>
                <li>📚 "estudiar" - Repasar notas</li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Desconectar WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <CardTitle>Conectar WhatsApp</CardTitle>
            <CardDescription>
              Recibe recordatorios y haz journal desde WhatsApp
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Número de WhatsApp
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={handleSendCode}
                  disabled={loading || !phone}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Enviar Código'
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Incluye el código de país (ej: +56 para Chile)
              </p>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enviamos un código de 6 dígitos a <strong>{phone}</strong>
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="flex-1 text-center text-2xl tracking-widest"
              />
              <Button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="bg-green-500 hover:bg-green-600"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Verificar'
                )}
              </Button>
            </div>
            <Button
              variant="link"
              onClick={() => {
                setStep('input')
                setCode('')
                setError(null)
              }}
              className="text-gray-500"
            >
              ← Cambiar número
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
