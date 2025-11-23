'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Check, Loader2, X, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConnectionStatus {
  connected: boolean
  phoneNumber?: string
  isActive?: boolean
  connectedAt?: string
}

export function WhatsAppConnect() {
  const [step, setStep] = useState<'loading' | 'input' | 'verify' | 'connected'>('loading')
  const [phone, setPhone] = useState('')
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
      <Card className="border-2 border-green-500/20 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                <MessageCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-green-600 dark:text-green-400">WhatsApp Conectado</CardTitle>
                <CardDescription className="text-green-600/80 dark:text-green-400/80">
                  {connectionStatus?.phoneNumber || phone}
                </CardDescription>
              </div>
            </div>
            <Check className="h-6 w-6 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg bg-background p-4 text-sm border border-border">
              <p className="font-medium text-foreground mb-2">Comandos disponibles:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>📝 <code className="bg-muted px-1 rounded text-foreground">/journal</code> - Journal del día</li>
                <li>📊 <code className="bg-muted px-1 rounded text-foreground">/stats</code> - Ver estadísticas</li>
                <li>😊 <code className="bg-muted px-1 rounded text-foreground">/mood [1-5]</code> - Registrar mood</li>
                <li>💭 <code className="bg-muted px-1 rounded text-foreground">/nota [texto]</code> - Nota rápida</li>
                <li>❓ <code className="bg-muted px-1 rounded text-foreground">/ayuda</code> - Ver todos los comandos</li>
              </ul>
            </div>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
    <Card className="border-2 border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
            <MessageCircle className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <CardTitle className="text-foreground">Conectar WhatsApp</CardTitle>
            <CardDescription className="text-muted-foreground">
              Recibe recordatorios y haz journal desde WhatsApp
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Número de WhatsApp
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="pl-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  onClick={handleSendCode}
                  disabled={loading || !phone}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Enviar Código'
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Incluye el código de país (ej: +56 para Chile)
              </p>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enviamos un código de 6 dígitos a <strong className="text-foreground">{phone}</strong>
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="flex-1 text-center text-2xl tracking-widest bg-background border-input text-foreground"
              />
              <Button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="bg-green-500 hover:bg-green-600 text-white"
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
              className="text-muted-foreground hover:text-foreground"
            >
              ← Cambiar número
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
