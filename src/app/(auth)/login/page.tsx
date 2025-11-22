"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
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
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: '#F6F5F2' }}
    >
      {/* Left side - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12"
        style={{ backgroundColor: '#FFF0E6' }}
      >
        <div className="max-w-md text-center">
          <div className="mb-8">
            <Image
              src="/logo.png"
              alt="BrainFlow"
              width={100}
              height={100}
              className="object-contain mx-auto animate-float"
            />
          </div>
          <h1
            className="text-4xl font-bold mb-4"
            style={{
              color: '#222222',
              fontFamily: 'Manrope, sans-serif',
              letterSpacing: '-0.02em'
            }}
          >
            BrainFlow
          </h1>
          <p
            className="text-lg mb-8 leading-relaxed"
            style={{ color: '#6D6D6D' }}
          >
            Tu segundo cerebro, simple y poderoso.
            Organiza tus ideas, conecta tu conocimiento y crece cada dia.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Notas con IA', 'Grafo visual', 'Journal diario', 'Sin ansiedad'].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222'
                }}
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
            <div className="mb-4">
              <Image
                src="/logo.png"
                alt="BrainFlow"
                width={72}
                height={72}
                className="object-contain mx-auto"
              />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif'
              }}
            >
              BrainFlow
            </h1>
          </div>

          {/* Form Card */}
          <div
            className="rounded-3xl p-8"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)'
            }}
          >
            <h2
              className="text-2xl font-bold mb-2"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif'
              }}
            >
              {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
            </h2>
            <p
              className="mb-6"
              style={{ color: '#6D6D6D' }}
            >
              {isRegister
                ? 'Comienza tu viaje de aprendizaje'
                : 'Bienvenido de vuelta a BrainFlow'
              }
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: '#222222' }}
                  >
                    Nombre
                  </label>
                  <div className="relative">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-5"
                      style={{ color: '#9A9A9A' }}
                    />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Tu nombre"
                      className="w-full pl-10 pr-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: '#F6F5F2',
                        border: '1px solid #EEEBE6',
                        color: '#222222'
                      }}
                      required={isRegister}
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: '#222222' }}
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-5"
                    style={{ color: '#9A9A9A' }}
                  />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tu@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: '#F6F5F2',
                      border: '1px solid #EEEBE6',
                      color: '#222222'
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: '#222222' }}
                >
                  Contrasena
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-5"
                    style={{ color: '#9A9A9A' }}
                  />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="********"
                    className="w-full pl-10 pr-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: '#F6F5F2',
                      border: '1px solid #EEEBE6',
                      color: '#222222'
                    }}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222'
                }}
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
                className="font-medium hover:underline"
                style={{ color: '#6D6D6D' }}
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
              className="text-sm hover:underline"
              style={{ color: '#9A9A9A' }}
            >
              Probar sin cuenta (modo demo)
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
