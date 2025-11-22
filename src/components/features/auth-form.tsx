"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)

  const supabase = createClient()

  const handleAnonLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      toast.success("Sesion iniciada como invitado!")
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al iniciar sesion")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        toast.success("Revisa tu email para confirmar el registro!")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success("Sesion iniciada exitosamente!")
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error de autenticacion")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center h-full p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8"
        style={{
          backgroundColor: 'var(--card)',
          border: '2px solid #EEEBE6',
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.4)'
            }}
          >
            <span className="text-3xl">🧠</span>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#222222' }}>
            Bienvenido a BrainFlow
          </h2>
          <p style={{ color: '#6D6D6D' }}>
            Inicia sesion para comenzar tu viaje de aprendizaje
          </p>
        </div>

        <div className="space-y-4">
          {/* Guest Button */}
          <button
            onClick={handleAnonLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{
              backgroundColor: '#FFF0E6',
              color: '#222222',
              border: '2px solid #FFE4D1'
            }}
          >
            <span>👤</span>
            Continuar como Invitado
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full" style={{ borderTop: '1px solid #EEEBE6' }} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-3" style={{ backgroundColor: 'var(--card)', color: '#9A9A9A' }}>
                O continua con email
              </span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 rounded-xl"
              />
              <Input
                type="password"
                placeholder="Contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.4)'
              }}
            >
              {isSignUp ? "Registrarse" : "Iniciar Sesion"}
            </button>
          </form>

          {/* Toggle Sign Up/Sign In */}
          <div className="text-center text-sm pt-2">
            <button
              type="button"
              className="font-medium transition-colors hover:opacity-80"
              style={{ color: '#C9B7F3' }}
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp
                ? "Ya tienes cuenta? Inicia Sesion"
                : "No tienes cuenta? Registrate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
