"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Clock, TrendingUp, ArrowRight, BookOpen, Network, X } from 'lucide-react';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { SUGGESTED_TOPICS } from '@/lib/data/types';
import { NoteRenderer, StreamingIndicator } from '@/components/NoteRenderer';

interface LevelSelectorProps {
  currentLevel: 'beginner' | 'intermediate' | 'expert';
  onLevelChange: (level: 'beginner' | 'intermediate' | 'expert') => void;
}

function LevelSelector({ currentLevel, onLevelChange }: LevelSelectorProps) {
  const levels = [
    { id: 'beginner', label: 'Principiante', description: 'Explicaciones simples y basicas', icon: '🌱' },
    { id: 'intermediate', label: 'Intermedio', description: 'Balance entre teoria y practica', icon: '📚' },
    { id: 'expert', label: 'Avanzado', description: 'Contenido tecnico y detallado', icon: '🎓' },
  ] as const;

  return (
    <div
      className="flex gap-2 rounded-3xl p-2"
      style={{
        backgroundColor: 'white',
        boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)',
        border: '1px solid #E6E6E6'
      }}
    >
      {levels.map((level) => (
        <button
          key={level.id}
          onClick={() => onLevelChange(level.id)}
          className="px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
          style={{
            background: currentLevel === level.id
              ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
              : 'transparent',
            color: currentLevel === level.id ? 'white' : '#646464',
            boxShadow: currentLevel === level.id
              ? '0px 2px 8px rgba(201, 183, 243, 0.3)'
              : 'none'
          }}
          title={level.description}
        >
          <span>{level.icon}</span>
          {level.label}
        </button>
      ))}
    </div>
  );
}

export function NewQueryView() {
  const router = useRouter();
  const { generateNote, isLoading, streamingNote, currentNote, clearStreaming, notes, session } = useKnowledge();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'expert'>('beginner');
  const [showResults, setShowResults] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Get recent topics from user's notes (last 3)
  const recentTopics = notes
    .slice(-3)
    .reverse()
    .map(note => note.title)
    .filter(title => title && title.length > 0);

  // Auto-scroll to results when streaming starts
  useEffect(() => {
    if ((isLoading || streamingNote) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isLoading, streamingNote]);

  // Show results panel when we have streaming content
  useEffect(() => {
    if (streamingNote?.content || isLoading) {
      setShowResults(true);
    }
  }, [streamingNote, isLoading]);

  const handleGenerate = async () => {
    if (!query.trim() || isLoading) return;
    setShowResults(true);
    await generateNote(query);
  };

  const handleQuickGenerate = async (topic: string) => {
    if (isLoading) return;
    setQuery(topic);
    setShowResults(true);
    await generateNote(topic);
  };

  const handleLinkClick = async (term: string) => {
    // Generate a new note for the clicked term, with current topic as parent
    setQuery(term);
    setShowResults(true);
    await generateNote(term, currentNote?.title);
  };

  const handleViewInStudy = () => {
    router.push('/study');
  };

  const handleViewInGraph = () => {
    router.push('/graph');
  };

  const handleCloseResults = () => {
    setShowResults(false);
    clearStreaming();
  };

  const displayContent = streamingNote?.content || '';
  const displayTitle = streamingNote?.title || query;
  const linkedTerms = streamingNote?.linkedTerms || [];
  const prerequisites = streamingNote?.prerequisites || [];
  const nextSteps = streamingNote?.nextSteps || [];

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F6F8FA 50%, #F0F4F8 100%)' }}
    >
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 relative overflow-hidden"
            style={{
              backgroundColor: '#D6C9F5',
              boxShadow: '0px 8px 24px rgba(201, 183, 243, 0.4)'
            }}
          >
            {/* Decorative dots */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  top: `${20 + Math.sin(i * Math.PI / 4) * 30}%`,
                  left: `${50 + Math.cos(i * Math.PI / 4) * 30}%`,
                }}
              />
            ))}
            <Sparkles className="size-12 text-white relative z-10" />
          </div>
          <h1 className="text-5xl font-bold mb-4" style={{ color: '#1E1E1E' }}>
            Que quieres aprender hoy?
          </h1>
          <p className="text-xl mb-6" style={{ color: '#646464' }}>
            Escribe cualquier tema y la IA generara una nota pedagogica con mapa de conocimiento
          </p>

          {/* Level Selector */}
          <div className="flex justify-center mb-8">
            <LevelSelector currentLevel={level} onLevelChange={setLevel} />
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-12">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 size-6" style={{ color: '#646464' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="Ej: Machine Learning, Fotosintesis, Marketing Digital, Historia del Arte..."
              className="w-full pl-16 pr-6 py-5 text-lg rounded-3xl focus:outline-none transition-all"
              style={{
                backgroundColor: 'white',
                border: '3px solid #E6E6E6',
                color: '#1E1E1E',
                boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
              }}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!query.trim() || isLoading}
            className="w-full mt-5 px-8 py-5 text-white rounded-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-semibold hover:scale-[1.02] duration-300 relative overflow-hidden"
            style={{
              backgroundColor: '#C9B7F3',
              boxShadow: '0px 8px 24px rgba(201, 183, 243, 0.4)'
            }}
          >
            {/* Decorative corner */}
            <div
              className="absolute top-0 right-0 w-32 h-32"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}
            />

            {isLoading ? (
              <>
                <div
                  className="w-6 h-6 border-3 border-white rounded-full animate-spin relative z-10"
                  style={{ borderTopColor: 'transparent' }}
                />
                <span className="relative z-10">Nodi esta generando tu mapa de conocimiento...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-6 relative z-10" />
                <span className="relative z-10">Generar Mapa de Conocimiento</span>
              </>
            )}
          </button>
        </div>

        {/* Streaming Results Panel */}
        {showResults && (isLoading || displayContent) && (
          <div
            ref={resultRef}
            className="mb-12 rounded-3xl overflow-hidden"
            style={{
              backgroundColor: 'white',
              border: '3px solid #E6E6E6',
              boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{
                backgroundColor: '#F6F8FA',
                borderBottom: '2px solid #E6E6E6'
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#D6C9F5' }}
                >
                  <Sparkles className="size-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: '#1E1E1E' }}>
                    {displayTitle || 'Generando...'}
                  </h3>
                  {isLoading && <StreamingIndicator />}
                </div>
              </div>
              <button
                onClick={handleCloseResults}
                className="p-2 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X className="size-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {displayContent ? (
                <NoteRenderer
                  content={displayContent}
                  onLinkClick={handleLinkClick}
                  isStreaming={isLoading}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <StreamingIndicator />
                </div>
              )}
            </div>

            {/* Related Terms */}
            {(linkedTerms.length > 0 || prerequisites.length > 0 || nextSteps.length > 0) && !isLoading && (
              <div
                className="px-6 py-4"
                style={{
                  backgroundColor: '#F6F8FA',
                  borderTop: '2px solid #E6E6E6'
                }}
              >
                {/* Prerequisites */}
                {prerequisites.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Prerrequisitos</h4>
                    <div className="flex flex-wrap gap-2">
                      {prerequisites.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => handleLinkClick(term)}
                          className="px-3 py-1.5 rounded-xl text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                {nextSteps.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Proximos pasos</h4>
                    <div className="flex flex-wrap gap-2">
                      {nextSteps.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => handleLinkClick(term)}
                          className="px-3 py-1.5 rounded-xl text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center gap-1"
                        >
                          {term}
                          <ArrowRight className="size-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleViewInStudy}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                    style={{
                      backgroundColor: '#D6C9F5',
                      color: '#1E1E1E'
                    }}
                  >
                    <BookOpen className="size-5" />
                    Estudiar nota completa
                  </button>
                  <button
                    onClick={handleViewInGraph}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors bg-gray-100 hover:bg-gray-200"
                    style={{ color: '#1E1E1E' }}
                  >
                    <Network className="size-5" />
                    Ver en el grafo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suggested Topics - hide when showing results */}
        {!showResults && (
          <>
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="p-2 rounded-2xl"
                  style={{ backgroundColor: 'rgba(163, 212, 255, 0.2)' }}
                >
                  <TrendingUp className="size-6" style={{ color: '#5A8FCC' }} />
                </div>
                <h3 className="text-3xl font-bold" style={{ color: '#1E1E1E' }}>
                  Temas populares para empezar
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {SUGGESTED_TOPICS.map((topic) => (
                  <button
                    key={topic.title}
                    onClick={() => handleQuickGenerate(topic.title)}
                    disabled={isLoading}
                    className="relative rounded-3xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group hover:scale-105 duration-300 overflow-hidden"
                    style={{
                      backgroundColor: topic.bgColor,
                      boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)',
                      border: `3px solid ${topic.bgColor}`
                    }}
                  >
                    {/* Decorative corner */}
                    <div
                      className="absolute top-0 right-0 w-20 h-20"
                      style={{
                        backgroundColor: topic.color + '30',
                        clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
                      }}
                    />

                    {/* Content */}
                    <div className="relative z-10 p-6">
                      {topic.popular && (
                        <span
                          className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: 'white',
                            color: topic.color,
                            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          Popular
                        </span>
                      )}

                      {/* Icon background circle */}
                      <div className="mb-4">
                        <div
                          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
                          style={{ backgroundColor: 'white' }}
                        >
                          <span className="text-4xl">{topic.icon}</span>
                        </div>
                      </div>

                      {/* Text content */}
                      <div>
                        <h4 className="font-bold text-lg mb-2" style={{ color: '#1E1E1E' }}>
                          {topic.title}
                        </h4>
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'rgba(30, 30, 30, 0.7)' }}
                        >
                          {topic.area}
                        </p>
                      </div>

                      {/* Hover indicator */}
                      <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div
                          className="h-1 rounded-full"
                          style={{ backgroundColor: topic.color, opacity: 0.5 }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Topics - only show if there are any */}
            {recentTopics.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="size-6" style={{ color: '#646464' }} />
                  <h3 className="text-2xl font-semibold" style={{ color: '#1E1E1E' }}>
                    Recientemente estudiado
                  </h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {recentTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleQuickGenerate(topic)}
                      disabled={isLoading}
                      className="px-5 py-3 rounded-2xl transition-all hover:scale-105 duration-300 disabled:opacity-50"
                      style={{
                        backgroundColor: '#F6F6F6',
                        color: '#646464'
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        <div
          className="mt-12 p-8 rounded-3xl relative overflow-hidden"
          style={{
            backgroundColor: '#E6DEF9',
            border: '3px solid #D6C9F5',
            boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.06)'
          }}
        >
          {/* Decorative elements */}
          <div
            className="absolute bottom-0 left-0 w-32 h-32 rounded-full"
            style={{
              backgroundColor: 'rgba(201, 183, 243, 0.2)',
              opacity: 0.5
            }}
          />
          <div
            className="absolute top-0 right-0 w-20 h-20"
            style={{
              backgroundColor: 'rgba(201, 183, 243, 0.3)',
              clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
            }}
          />

          <h4 className="text-xl font-semibold mb-4 flex items-center gap-3 relative z-10" style={{ color: '#1E1E1E' }}>
            <span className="text-3xl">Tip</span>
            Como funciona
          </h4>
          <ul className="space-y-3 relative z-10" style={{ color: '#1E1E1E' }}>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-xl" style={{ color: '#C9B7F3' }}>-</span>
              <span>Nodi generara una nota pedagogica adaptada a tu nivel</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-xl" style={{ color: '#C9B7F3' }}>-</span>
              <span>Los terminos tecnicos seran clickeables para expandir conceptos</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-xl" style={{ color: '#C9B7F3' }}>-</span>
              <span>La nota se guardara automaticamente en tu grafo de conocimiento</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-xl" style={{ color: '#C9B7F3' }}>-</span>
              <span>Podras marcar tu progreso y recibir recomendaciones personalizadas</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
