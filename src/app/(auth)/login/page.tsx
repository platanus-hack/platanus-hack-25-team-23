"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      if (isRegister) {
        // Register
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
            },
          },
        })

        if (error) throw error

        toast.success('Cuenta creada! Revisa tu email para confirmar.')
        setIsRegister(false)
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error

        toast.success('Bienvenido de vuelta!')
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F6F8FA' }}>
      {/* Left side - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12"
        style={{ backgroundColor: '#D6C9F5' }}
      >
        <div className="max-w-md text-center">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8"
            style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
          >
            <Sparkles className="size-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            BrainFlow
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Tu asistente de aprendizaje con IA. Genera notas pedagogicas, conecta conceptos y visualiza tu conocimiento.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Notas con IA', 'Grafo de conocimiento', '7 Areas de vida', 'Progreso visual'].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#D6C9F5' }}
            >
              <Sparkles className="size-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#1E1E1E' }}>
              BrainFlow
            </h1>
          </div>

          {/* Form Card */}
          <div
            className="bg-white rounded-3xl p-8 shadow-lg"
            style={{ border: '3px solid #E6E6E6' }}
          >
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#1E1E1E' }}>
              {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
            </h2>
            <p className="text-gray-500 mb-6">
              {isRegister
                ? 'Comienza tu viaje de aprendizaje'
                : 'Bienvenido de vuelta a BrainFlow'
              }
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Tu nombre"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none transition-colors"
                      required={isRegister}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tu@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contrasena
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none transition-colors"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#C9B7F3' }}
              >
                {isLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
                    <ArrowRight className="size-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                {isRegister
                  ? 'Ya tienes cuenta? Inicia sesion'
                  : 'No tienes cuenta? Registrate'
                }
              </button>
            </div>
          </div>

          {/* Demo mode */}
          <div className="mt-6 text-center">
            <Link
              href="/new-query"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Probar sin cuenta (modo demo)
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
