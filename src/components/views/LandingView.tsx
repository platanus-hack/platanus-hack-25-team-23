"use client"

import Link from 'next/link';
import { Brain, Lightbulb, Map, Zap, ArrowRight, CheckCircle } from 'lucide-react';

export function LandingView() {
  const features = [
    {
      icon: <Brain className="size-8 text-purple-600" />,
      title: 'IA Pedagogica',
      description: 'No es un resumen. Es una explicacion real adaptada a tu nivel.'
    },
    {
      icon: <Map className="size-8 text-blue-600" />,
      title: 'Mapa de Conocimiento Automatico',
      description: 'Visualiza prerrequisitos y siguiente pasos sin pensar.'
    },
    {
      icon: <Zap className="size-8 text-yellow-600" />,
      title: 'Click = Aprender',
      description: 'Cualquier termino desconocido se abre al instante, sin distracciones.'
    },
    {
      icon: <Lightbulb className="size-8 text-green-600" />,
      title: 'Notas Automaticas',
      description: 'Tipo Obsidian pero se crean solas y ya estan conectadas.'
    }
  ];

  const problems = [
    'Abro mil pestanas cuando estudio algo nuevo',
    'No se que necesito saber primero',
    'Olvido lo que ya aprendi',
    'Obsidian es genial pero muy tecnico'
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-purple-50 via-white to-blue-50 min-h-screen">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full mb-6 shadow-xl">
            <Brain className="size-12 text-white" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Tu Segundo Cerebro con IA
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Deja de perderte en mil pestanas. Aprende cualquier tema con un mapa visual,
            explicaciones pedagogicas y conceptos conectados automaticamente.
          </p>

          <div className="flex gap-4 justify-center mb-12">
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl text-lg"
            >
              Iniciar Sesion
              <ArrowRight className="size-5" />
            </Link>

            <Link
              href="/new-query"
              className="px-8 py-4 border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 transition-all text-lg"
            >
              Probar sin cuenta
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              <span>Sin registrarse</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              <span>100% gratis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              <span>Para cualquier tema</span>
            </div>
          </div>
        </div>

        {/* Problem Statement */}
        <div className="mb-16">
          <h3 className="text-2xl font-semibold text-gray-900 text-center mb-8">El problema que todos tenemos:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {problems.map((problem, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <span className="text-red-600 text-xl">X</span>
                <p className="text-gray-700">{problem}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h3 className="text-2xl font-semibold text-gray-900 text-center mb-8">La solucion:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-purple-600 transition-all hover:shadow-lg">
                <div className="mb-4">{feature.icon}</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-white rounded-2xl p-8 border-2 border-purple-200 shadow-lg">
          <h3 className="text-2xl font-semibold text-gray-900 text-center mb-8">Como funciona?</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Escribe un tema</h4>
              <p className="text-gray-600">Ej: "Machine Learning", "Fotosintesis", "Calculo"</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">La IA genera</h4>
              <p className="text-gray-600">Explicacion + conceptos clickeables + mapa visual</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Aprende expandiendo</h4>
              <p className="text-gray-600">Click en terminos - se abren explicaciones contextuales</p>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="mt-16">
          <h3 className="text-2xl font-semibold text-gray-900 text-center mb-8">No somos como los demas</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3">ChatGPT</h4>
              <p className="text-gray-600 mb-4">Te da respuestas pero sin estructura ni conexiones</p>
              <span className="text-yellow-600">Te pierdes facil</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3">Obsidian</h4>
              <p className="text-gray-600 mb-4">Genial pero manual, tecnico y vacio al inicio</p>
              <span className="text-yellow-600">Solo para expertos</span>
            </div>

            <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg p-6 text-center border-2 border-purple-600">
              <h4 className="font-semibold text-gray-900 mb-3">BrainFlow IA</h4>
              <p className="text-gray-700 mb-4">Automatico, visual, pedagogico y para cualquiera</p>
              <span className="text-green-600 font-medium">El mejor de ambos</span>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">Listo para empezar?</h3>
          <p className="text-gray-600 mb-6">Escribe cualquier tema y mira la magia</p>
          <Link
            href="/new-query"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl text-lg"
          >
            <Brain className="size-5" />
            Crear mi primer mapa de conocimiento
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
