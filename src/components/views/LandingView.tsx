"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ArrowRight, CheckCircle, BookOpen, Network, Lightbulb, Calendar, Target } from 'lucide-react';

export function LandingView() {
  const features = [
    {
      icon: <BookOpen className="size-8" style={{ color: '#A0B9FF' }} />,
      title: 'Notas Inteligentes',
      description: 'Crea y organiza conocimiento que se conecta automaticamente entre si.'
    },
    {
      icon: <Network className="size-8" style={{ color: '#D6C3FF' }} />,
      title: 'Grafo de Conocimiento',
      description: 'Visualiza tus ideas en un mapa interactivo que crece contigo.'
    },
    {
      icon: <Calendar className="size-8" style={{ color: '#B0F2B4' }} />,
      title: 'Diario Personal',
      description: 'Reflexiona cada dia con un journal que te ayuda a crecer.'
    },
    {
      icon: <Target className="size-8" style={{ color: '#FFB7B7' }} />,
      title: 'Seguimiento de Metas',
      description: 'Organiza tus tareas y ve tu progreso con claridad.'
    }
  ];

  const steps = [
    {
      number: '1',
      title: 'Escribe lo que aprendes',
      description: 'Cualquier concepto, idea o reflexion'
    },
    {
      number: '2',
      title: 'BrainFlow conecta todo',
      description: 'La IA encuentra relaciones automaticamente'
    },
    {
      number: '3',
      title: 'Visualiza y crece',
      description: 'Tu segundo cerebro evoluciona contigo'
    }
  ];

  return (
    <div
      className="flex-1 overflow-y-auto min-h-screen"
      style={{ backgroundColor: '#F5F7FB' }}
    >
      {/* Header/Navbar */}
      <header className="max-w-6xl mx-auto px-8 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BrainFlow"
              width={48}
              height={48}
              className="object-contain"
            />
            <span className="text-2xl font-bold" style={{ color: '#5B4B8A' }}>
              BrainFlow
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-xl font-medium transition-all hover:scale-105"
              style={{
                color: '#5B4B8A',
                backgroundColor: 'transparent'
              }}
            >
              Iniciar Sesion
            </Link>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-xl font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #D6C3FF 0%, #A0B9FF 100%)',
                color: 'white',
                boxShadow: '0px 4px 14px rgba(214, 195, 255, 0.4)'
              }}
            >
              Registrarse
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          {/* Mascot */}
          <div className="mb-8">
            <Image
              src="/logo.png"
              alt="BrainFlow Mascot"
              width={140}
              height={140}
              className="object-contain mx-auto"
            />
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: '#2D2D2D' }}
          >
            Tu segundo cerebro,
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #D6C3FF 0%, #A0B9FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              simple y poderoso
            </span>
          </h1>

          <p
            className="text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#6B6B6B' }}
          >
            Organiza tus ideas, conecta tu conocimiento y crece cada dia
            con un espacio diseñado para la claridad mental.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #D6C3FF 0%, #A0B9FF 100%)',
                color: 'white',
                boxShadow: '0px 8px 24px rgba(214, 195, 255, 0.4)'
              }}
            >
              <Sparkles className="size-5" />
              Comenzar Gratis
              <ArrowRight className="size-5" />
            </Link>

            <Link
              href="/new-query"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all hover:scale-105"
              style={{
                backgroundColor: 'white',
                color: '#5B4B8A',
                border: '2px solid #D6C3FF',
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)'
              }}
            >
              Explorar Demo
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: '#8B8B8B' }}>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5" style={{ color: '#B0F2B4' }} />
              <span>100% Gratis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5" style={{ color: '#B0F2B4' }} />
              <span>Sin tarjeta de credito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5" style={{ color: '#B0F2B4' }} />
              <span>Privado y seguro</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#2D2D2D' }}>
            Todo lo que necesitas para pensar mejor
          </h2>
          <p style={{ color: '#6B6B6B' }}>
            Herramientas simples pero poderosas para tu crecimiento personal
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="rounded-3xl p-8 transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: 'white',
                border: '1px solid #E8E0FF',
                boxShadow: '0px 4px 20px rgba(214, 195, 255, 0.15)'
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ backgroundColor: '#F5F7FB' }}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: '#2D2D2D' }}>
                {feature.title}
              </h3>
              <p style={{ color: '#6B6B6B' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <div
          className="rounded-3xl p-12"
          style={{
            background: 'linear-gradient(135deg, #E8E0FF 0%, #D6E4FF 100%)',
            boxShadow: '0px 8px 32px rgba(214, 195, 255, 0.2)'
          }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#2D2D2D' }}>
              Como funciona?
            </h2>
            <p style={{ color: '#5B4B8A' }}>
              Simple como deberia ser
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{
                    background: 'linear-gradient(135deg, #D6C3FF 0%, #A0B9FF 100%)',
                    boxShadow: '0px 4px 14px rgba(214, 195, 255, 0.4)'
                  }}
                >
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#2D2D2D' }}>
                  {step.title}
                </h3>
                <p style={{ color: '#5B4B8A' }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <div
          className="rounded-3xl p-12 text-center"
          style={{
            backgroundColor: 'white',
            border: '2px solid #D6C3FF',
            boxShadow: '0px 8px 32px rgba(214, 195, 255, 0.15)'
          }}
        >
          <div className="mb-6">
            <Image
              src="/logo.png"
              alt="BrainFlow"
              width={80}
              height={80}
              className="object-contain mx-auto"
            />
          </div>

          <h2 className="text-3xl font-bold mb-4" style={{ color: '#2D2D2D' }}>
            Listo para empezar?
          </h2>
          <p className="mb-8 max-w-lg mx-auto" style={{ color: '#6B6B6B' }}>
            Dale claridad a tu mente. Comienza tu segundo cerebro hoy.
          </p>

          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl font-semibold text-lg transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #D6C3FF 0%, #A0B9FF 100%)',
              color: 'white',
              boxShadow: '0px 8px 24px rgba(214, 195, 255, 0.4)'
            }}
          >
            <Sparkles className="size-5" />
            Crear mi cuenta gratis
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: '1px solid #E8E0FF' }}>
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="BrainFlow"
              width={24}
              height={24}
              className="object-contain"
            />
            <span className="font-medium" style={{ color: '#5B4B8A' }}>
              BrainFlow
            </span>
          </div>
          <p className="text-sm" style={{ color: '#8B8B8B' }}>
            Tu segundo cerebro, simple y poderoso
          </p>
        </div>
      </footer>
    </div>
  );
}
