"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'

export default function GoogleCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleCallback = () => {
      try {
        // Get the hash fragment from the URL (contains the access token)
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)

        const accessToken = params.get('access_token')
        const error = params.get('error')

        if (error) {
          setStatus('error')
          setErrorMessage(error === 'access_denied'
            ? 'Acceso denegado. Por favor, autoriza el acceso a tu calendario.'
            : `Error: ${error}`)
          return
        }

        if (accessToken) {
          // Store the token in localStorage
          localStorage.setItem('google_calendar_token', accessToken)

          // Also store the expiration time if provided
          const expiresIn = params.get('expires_in')
          if (expiresIn) {
            const expirationTime = Date.now() + parseInt(expiresIn) * 1000
            localStorage.setItem('google_calendar_token_expiry', expirationTime.toString())
          }

          setStatus('success')

          // Redirect to calendar page after a short delay
          setTimeout(() => {
            router.push('/calendar')
          }, 2000)
        } else {
          setStatus('error')
          setErrorMessage('No se recibió el token de acceso')
        }
      } catch (err) {
        console.error('Error processing callback:', err)
        setStatus('error')
        setErrorMessage('Error al procesar la autenticación')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="text-center max-w-md p-8">
        {status === 'loading' && (
          <>
            <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="size-10 animate-spin text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Conectando con Google Calendar...
            </h2>
            <p style={{ color: 'var(--muted-foreground)' }}>
              Por favor espera mientras procesamos tu autorización
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <Check className="size-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              ¡Conectado exitosamente!
            </h2>
            <p style={{ color: 'var(--muted-foreground)' }}>
              Tu Google Calendar ha sido vinculado. Redirigiendo al calendario...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
              <X className="size-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Error de conexión
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
    </div>
  )
}
