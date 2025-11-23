"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Clock, TrendingUp, ArrowRight, BookOpen, Network, X } from 'lucide-react';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { SUGGESTED_TOPICS } from '@/lib/data/types';
import { NoteRenderer, StreamingIndicator } from '@/components/NoteRenderer';



export function NewQueryView() {
  const router = useRouter();
  const { generateNote, isLoading, streamingNote, currentNote, clearStreaming, notes, session } = useKnowledge();
  const [query, setQuery] = useState('');

  const [showResults, setShowResults] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Get recent topics from user's notes (last 3)
  const recentTopics = notes
    .slice(-3)
    .reverse()
    .map(note => note.title)
    .filter(title => title && title.length > 0);

  // Auto-scroll to results ONLY once when streaming starts
  useEffect(() => {
    if (isLoading && !hasScrolled && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasScrolled(true);
    }
    // Reset scroll flag when loading stops
    if (!isLoading) {
      setHasScrolled(false);
    }
  }, [isLoading, hasScrolled]);

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
      className="flex-1 overflow-y-auto transition-colors duration-300"
      style={{ backgroundColor: '#F6F5F2' }}
    >
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#E6DAFF' }}
          >
            <Sparkles className="size-8" style={{ color: '#9575CD' }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#222222' }}>
            Que quieres aprender hoy?
          </h1>
          <p className="text-sm mb-6" style={{ color: '#6D6D6D' }}>
            Escribe cualquier tema y la IA generara una nota pedagogica
          </p>


        </div>

        {/* Search Input */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 size-5" style={{ color: '#6D6D6D' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="Ej: Machine Learning, Fotosintesis, Marketing Digital..."
              className="w-full pl-12 pr-4 py-4 text-sm rounded-xl focus:outline-none transition-all"
              style={{
                backgroundColor: 'white',
                color: '#222222',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)'
              }}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!query.trim() || isLoading}
            className="w-full mt-4 px-6 py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium hover:scale-[1.02] duration-300"
            style={{ backgroundColor: '#FFD9D9', color: '#222222' }}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#222222', borderTopColor: 'transparent' }} />
                <span>Generando mapa de conocimiento...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-5" />
                <span>Generar Mapa de Conocimiento</span>
              </>
            )}
          </button>
        </div>

        {/* Streaming Results Panel */}
        {showResults && (isLoading || displayContent) && (
          <div
            ref={resultRef}
            className="mb-8 rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: '#F6F5F2' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6DAFF' }}>
                  <Sparkles className="size-5" style={{ color: '#9575CD' }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#222222' }}>{displayTitle || 'Generando...'}</h3>
                  {isLoading && <StreamingIndicator />}
                </div>
              </div>
              <button onClick={handleCloseResults} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="size-4" style={{ color: '#6D6D6D' }} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {displayContent ? (
                <NoteRenderer content={displayContent} onLinkClick={handleLinkClick} isStreaming={isLoading} />
              ) : (
                <div className="flex items-center justify-center py-8"><StreamingIndicator /></div>
              )}
            </div>

            {/* Related Terms */}
            {(linkedTerms.length > 0 || prerequisites.length > 0 || nextSteps.length > 0) && !isLoading && (
              <div className="px-5 py-4" style={{ backgroundColor: '#F6F5F2' }}>
                {prerequisites.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2" style={{ color: '#6D6D6D' }}>Prerrequisitos</h4>
                    <div className="flex flex-wrap gap-2">
                      {prerequisites.map((term, i) => (
                        <button key={i} onClick={() => handleLinkClick(term)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: '#FFF0E6', color: '#F59E0B' }}>{term}</button>
                      ))}
                    </div>
                  </div>
                )}
                {nextSteps.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2" style={{ color: '#6D6D6D' }}>Proximos pasos</h4>
                    <div className="flex flex-wrap gap-2">
                      {nextSteps.map((term, i) => (
                        <button key={i} onClick={() => handleLinkClick(term)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1" style={{ backgroundColor: '#D4F5E9', color: '#10B981' }}>
                          {term}<ArrowRight className="size-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={handleViewInStudy} className="flex-1 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors" style={{ backgroundColor: '#FFD9D9', color: '#222222' }}>
                    <BookOpen className="size-4" />Estudiar nota
                  </button>
                  <button onClick={handleViewInGraph} className="flex-1 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors" style={{ backgroundColor: '#F6F5F2', color: '#6D6D6D' }}>
                    <Network className="size-4" />Ver en grafo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suggested Topics - hide when showing results */}
        {!showResults && (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#CFE4FF' }}>
                  <TrendingUp className="size-4" style={{ color: '#3B82F6' }} />
                </div>
                <h3 className="font-semibold" style={{ color: '#222222' }}>Temas populares</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {SUGGESTED_TOPICS.map((topic) => (
                  <button
                    key={topic.title}
                    onClick={() => handleQuickGenerate(topic.title)}
                    disabled={isLoading}
                    className="p-4 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 duration-300"
                    style={{ backgroundColor: 'white', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: topic.bgColor }}>
                        <span className="text-2xl">{topic.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate" style={{ color: '#222222' }}>{topic.title}</h4>
                        <p className="text-xs" style={{ color: '#6D6D6D' }}>{topic.area}</p>
                      </div>
                      {topic.popular && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FFD9D9', color: '#222222' }}>Popular</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Topics */}
            {recentTopics.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F6F5F2' }}>
                    <Clock className="size-4" style={{ color: '#6D6D6D' }} />
                  </div>
                  <h3 className="font-semibold" style={{ color: '#222222' }}>Recientemente estudiado</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleQuickGenerate(topic)}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg text-sm transition-all hover:scale-105 duration-300 disabled:opacity-50"
                      style={{ backgroundColor: 'white', color: '#6D6D6D', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}
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
        <div className="mt-8 p-5 rounded-2xl" style={{ backgroundColor: '#FFF0E6', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFD9D9' }}>
              <span className="text-sm">💡</span>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2" style={{ color: '#222222' }}>Como funciona</h4>
              <ul className="space-y-1.5 text-sm" style={{ color: '#6D6D6D' }}>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#F59E0B' }}>•</span>
                  <span>Genera notas pedagogicas adaptadas a tu nivel</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#F59E0B' }}>•</span>
                  <span>Terminos tecnicos clickeables para expandir conceptos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#F59E0B' }}>•</span>
                  <span>Se guarda automaticamente en tu grafo de conocimiento</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#F59E0B' }}>•</span>
                  <span>Marca tu progreso y recibe recomendaciones personalizadas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
