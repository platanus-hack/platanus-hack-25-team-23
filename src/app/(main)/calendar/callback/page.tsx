"use client"

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for authorization code in URL params (new flow)
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        // Also check hash for legacy implicit grant flow
        const hash = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        const hashToken = hashParams.get('access_token')
        const hashError = hashParams.get('error')

        if (error || hashError) {
          setStatus('error')
          const errMsg = error || hashError
          setErrorMessage(errMsg === 'access_denied'
            ? 'Acceso denegado. Por favor, autoriza el acceso a tu calendario.'
            : `Error: ${errMsg}`)
          return
        }

        // Handle authorization code flow (preferred - has refresh tokens)
        if (code) {
          const redirectUri = `${window.location.origin}/calendar/callback`

          const response = await fetch('/api/auth/google-calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: redirectUri }),
          })

          const data = await response.json()

          if (!response.ok || data.error) {
            setStatus('error')
            setErrorMessage(data.error || 'Error al obtener tokens')
            return
          }

          // Store tokens
          localStorage.setItem('google_calendar_token', data.access_token)

          // Store refresh token (this is the key for persistence!)
          if (data.refresh_token) {
            localStorage.setItem('google_calendar_refresh_token', data.refresh_token)
          }

          // Store expiration time
          if (data.expires_in) {
            const expirationTime = Date.now() + data.expires_in * 1000
            localStorage.setItem('google_calendar_token_expiry', expirationTime.toString())
          }

          setStatus('success')
          setTimeout(() => router.push('/calendar'), 2000)
          return
        }

        // Handle legacy implicit grant flow (fallback)
        if (hashToken) {
          localStorage.setItem('google_calendar_token', hashToken)

          const expiresIn = hashParams.get('expires_in')
          if (expiresIn) {
            const expirationTime = Date.now() + parseInt(expiresIn) * 1000
            localStorage.setItem('google_calendar_token_expiry', expirationTime.toString())
          }

          setStatus('success')
          setTimeout(() => router.push('/calendar'), 2000)
          return
        }

        // No code or token found
        setStatus('error')
        setErrorMessage('No se recibio autorizacion de Google')
      } catch (err) {
        console.error('Error processing callback:', err)
        setStatus('error')
        setErrorMessage('Error al procesar la autenticacion')
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="text-center max-w-md p-8">
      {status === 'loading' && (
        <>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#E6DAFF' }}
          >
            <Loader2 className="size-10 animate-spin" style={{ color: '#9575CD' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Conectando con Google Calendar...
          </h2>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Por favor espera mientras procesamos tu autorizacion
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#D4F5E9' }}
          >
            <Check className="size-10" style={{ color: '#10B981' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Conectado exitosamente!
          </h2>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Tu Google Calendar ha sido vinculado permanentemente. Redirigiendo...
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#FFD9D9' }}
          >
            <X className="size-10" style={{ color: '#D46A6A' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Error de conexion
          </h2>
          <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {errorMessage}
          </p>
          <button
            onClick={() => router.push('/calendar')}
            className="px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
            }}
          >
            Volver al calendario
          </button>
        </>
      )}
    </div>
  )
}

export default function GoogleCallbackPage() {
  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <Suspense fallback={
        <div className="text-center max-w-md p-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#E6DAFF' }}
          >
            <Loader2 className="size-10 animate-spin" style={{ color: '#9575CD' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Cargando...
          </h2>
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </div>
  )
}
