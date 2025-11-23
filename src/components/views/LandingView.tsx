"use client"

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Brain, Network, BookOpen, Target } from 'lucide-react';

export function LandingView() {
  const features = [
    {
      icon: '📝',
      iconBg: '#FFF0E6',
      title: 'Seguimiento',
      description: 'Toma el control con un seguimiento intuitivo'
    },
    {
      icon: '🎯',
      iconBg: '#FFD9D9',
      title: 'Puntuación',
      description: 'Tu puntuación de aprendizaje: cada esfuerzo cuenta'
    },
    {
      icon: '📈',
      iconBg: '#E6DAFF',
      title: 'Progreso',
      description: 'Cada paso te acerca más a la maestría'
    },
    {
      icon: '🧠',
      iconBg: '#CFE4FF',
      title: 'Monitoreo',
      description: 'Sigue tu avance y mantente al día'
    }
  ];

  const steps = [
    {
      number: '01',
      title: 'Escribe tu tema',
      description: 'Cualquier concepto que quieras aprender'
    },
    {
      number: '02',
      title: 'BrainFlow conecta',
      description: 'La IA encuentra relaciones y crea tu mapa'
    },
    {
      number: '03',
      title: 'Aprende y crece',
      description: 'Visualiza tu progreso sin ansiedad'
    }
  ];

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#F6F5F2' }}
    >
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-5">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BrainFlow"
              width={44}
              height={44}
              className="object-contain"
            />
            <span
              className="text-xl font-semibold"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif',
                letterSpacing: '-0.02em'
              }}
            >
              BrainFlow
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-[#FFF0E6]"
              style={{ color: '#6D6D6D' }}
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-90"
              style={{
                backgroundColor: '#FFD9D9',
                color: '#222222'
              }}
            >
              Registrarse
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="BrainFlow Mascot"
                width={80}
                height={80}
                className="object-contain animate-float"
              />
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif',
                letterSpacing: '-0.03em'
              }}
            >
              El sistema de conocimiento de
              <br />
              <span style={{ fontStyle: 'italic', fontWeight: 800 }}>BrainFlow</span> ofrece
              <br />
              aprendizaje de vanguardia que
              <br />
              se sincroniza con tu mente.
            </h1>

            <p
              className="text-lg mb-8 leading-relaxed"
              style={{ color: '#6D6D6D' }}
            >
              Tu segundo cerebro, simple y poderoso. Aprende cualquier tema
              con claridad mental y sin ansiedad.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-medium transition-all hover:translate-y-[-2px]"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222',
                  boxShadow: '0px 4px 20px rgba(255, 217, 217, 0.4)'
                }}
              >
                <Sparkles className="size-4" />
                Comenzar Gratis
                <ArrowRight className="size-4" />
              </Link>

              <Link
                href="/new-query"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-medium transition-all hover:bg-[#FFF0E6]"
                style={{
                  backgroundColor: 'transparent',
                  color: '#6D6D6D',
                  border: '1px solid #EEEBE6'
                }}
              >
                Explorar Demo
              </Link>
            </div>
          </div>

          {/* Right - Feature Cards */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-5 rounded-2xl transition-all hover:translate-y-[-2px]"
                style={{
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.03)'
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
                  style={{ backgroundColor: feature.iconBg }}
                >
                  {feature.icon}
                </div>
                <h3
                  className="font-semibold mb-1"
                  style={{
                    color: '#222222',
                    fontSize: '15px',
                    fontFamily: 'Manrope, sans-serif'
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: '#6D6D6D' }}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section
        className="py-20"
        style={{ backgroundColor: '#FFFCF9' }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl font-bold mb-4"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif',
                letterSpacing: '-0.02em'
              }}
            >
              Todo lo que necesitas para aprender mejor
            </h2>
            <p style={{ color: '#6D6D6D' }}>
              Herramientas simples pero poderosas para tu crecimiento personal
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {[
              { icon: <Brain className="size-4" />, label: 'Notas con IA', bg: '#E6DAFF' },
              { icon: <Network className="size-4" />, label: 'Grafo de conocimiento', bg: '#CFE4FF' },
              { icon: <BookOpen className="size-4" />, label: 'Journal diario', bg: '#FFF0E6' },
              { icon: <Target className="size-4" />, label: 'Progreso visual', bg: '#D4F5E9' },
            ].map((pill, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full"
                style={{ backgroundColor: pill.bg }}
              >
                {pill.icon}
                <span
                  className="text-sm font-medium"
                  style={{ color: '#222222' }}
                >
                  {pill.label}
                </span>
              </div>
            ))}
          </div>

          {/* Mobile Previews - Kenko Style */}
          <div className="flex justify-center gap-6 overflow-x-auto pb-4">
            {[1, 2, 3].map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-64 rounded-3xl p-4 pt-8"
                style={{
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.06)'
                }}
              >
                {/* Phone Notch */}
                <div
                  className="w-20 h-6 mx-auto rounded-full mb-6"
                  style={{ backgroundColor: '#222222' }}
                />

                {/* Content */}
                <div className="space-y-4">
                  <div
                    className="h-3 rounded-full"
                    style={{ backgroundColor: '#EEEBE6', width: '60%' }}
                  />
                  <div
                    className="h-16 rounded-2xl"
                    style={{ backgroundColor: i === 0 ? '#FFF0E6' : i === 1 ? '#E6DAFF' : '#D4F5E9' }}
                  />
                  <div className="space-y-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: '#EEEBE6' }}
                    />
                    <div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: '#EEEBE6', width: '80%' }}
                    />
                  </div>
                  <div
                    className="h-12 rounded-xl"
                    style={{ backgroundColor: i === 0 ? '#FFD9D9' : i === 1 ? '#CFE4FF' : '#FFF0E6' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div
            className="rounded-3xl p-10 md:p-16"
            style={{ backgroundColor: '#FFF0E6' }}
          >
            <div className="text-center mb-12">
              <h2
                className="text-3xl font-bold mb-4"
                style={{
                  color: '#222222',
                  fontFamily: 'Manrope, sans-serif'
                }}
              >
                Como funciona?
              </h2>
              <p style={{ color: '#6D6D6D' }}>
                Simple como deberia ser
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: '#FFD9D9' }}
                  >
                    <span
                      className="text-lg font-bold"
                      style={{ color: '#222222' }}
                    >
                      {step.number}
                    </span>
                  </div>
                  <h3
                    className="font-semibold mb-2"
                    style={{
                      color: '#222222',
                      fontFamily: 'Manrope, sans-serif'
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: '#6D6D6D' }}
                  >
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div
            className="rounded-3xl p-10 md:p-16 text-center"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="mb-6">
              <Image
                src="/logo.png"
                alt="BrainFlow"
                width={64}
                height={64}
                className="object-contain mx-auto"
              />
            </div>

            <h2
              className="text-3xl font-bold mb-4"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif'
              }}
            >
              Listo para empezar?
            </h2>
            <p
              className="mb-8 max-w-md mx-auto"
              style={{ color: '#6D6D6D' }}
            >
              Tu mente esta a punto de aprender sin ansiedad.
              Dale claridad a tu segundo cerebro.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-medium transition-all hover:translate-y-[-2px]"
              style={{
                backgroundColor: '#FFD9D9',
                color: '#222222',
                boxShadow: '0px 4px 20px rgba(255, 217, 217, 0.4)'
              }}
            >
              <Sparkles className="size-4" />
              Crear mi cuenta gratis
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6"
            style={{ borderTop: '1px solid #EEEBE6' }}
          >
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="BrainFlow"
                width={24}
                height={24}
                className="object-contain"
              />
              <span
                className="font-medium"
                style={{ color: '#222222' }}
              >
                BrainFlow
              </span>
            </div>
            <p
              className="text-sm"
              style={{ color: '#9A9A9A' }}
            >
              Tu segundo cerebro, simple y poderoso
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
