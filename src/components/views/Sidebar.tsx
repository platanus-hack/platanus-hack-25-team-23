"use client"

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Network, GitBranch, User, Plus, FolderOpen, Search, LogOut, Flame, Calendar, BookHeart, FileText, X } from 'lucide-react';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { useJournal } from '@/lib/store/journal-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SidebarProps {
  isCollapsed?: boolean;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'note' | 'journal';
  href: string;
  preview?: string;
}

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, notes } = useKnowledge();
  const { entries: journalEntries } = useJournal();
  const studyStreak = 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search in notes
    notes.forEach(note => {
      if (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      ) {
        results.push({
          id: note.id || note.slug,
          title: note.title,
          type: 'note',
          href: `/study?topic=${encodeURIComponent(note.title)}`,
          preview: note.content.substring(0, 60) + '...'
        });
      }
    });

    // Search in journal entries
    journalEntries.forEach(entry => {
      const entryText = [
        entry.pilesAffirmation,
        entry.freeThoughts,
        ...(entry.gratitude || []),
        ...(entry.pilesItems?.map(i => i.text) || [])
      ].filter(Boolean).join(' ').toLowerCase();

      if (entryText.includes(query)) {
        const date = new Date(entry.date + 'T00:00:00');
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        results.push({
          id: entry.id,
          title: `Journal - ${dayNames[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`,
          type: 'journal',
          href: `/journal?date=${entry.date}`,
          preview: entry.pilesAffirmation?.substring(0, 60) || entry.freeThoughts?.substring(0, 60) || ''
        });
      }
    });

    return results.slice(0, 5); // Limit to 5 results
  }, [searchQuery, notes, journalEntries]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setShowResults(false);
    router.push(result.href);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowResults(false);
      router.push(`/library?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sesion cerrada");
    router.push('/');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/dashboard' },
    { id: 'new-query', label: 'Nueva Consulta', icon: Plus, href: '/new-query', highlight: true },
    { id: 'library', label: 'Biblioteca', icon: FolderOpen, href: '/library' },
    { id: 'journal', label: 'Journal', icon: BookHeart, href: '/journal' },
    { id: 'graph', label: 'Grafo', icon: Network, href: '/graph' },
    { id: 'tree', label: 'Ruta', icon: GitBranch, href: '/tree' },
    { id: 'calendar', label: 'Calendario', icon: Calendar, href: '/calendar' },
    { id: 'profile', label: 'Perfil', icon: User, href: '/profile' },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 flex flex-col h-screen`}
      style={{
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #EEEBE6'
      }}
    >
      {/* Logo */}
      <div
        className="p-5"
        style={{ borderBottom: '1px solid #EEEBE6' }}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="BrainFlow"
            width={44}
            height={44}
            className="object-contain"
          />
          {!isCollapsed && (
            <span
              className="text-lg font-semibold"
              style={{
                color: '#222222',
                fontFamily: 'Manrope, sans-serif',
                letterSpacing: '-0.02em'
              }}
            >
              BrainFlow
            </span>
          )}
        </Link>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="p-4" ref={searchRef}>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4"
              style={{ color: '#9A9A9A' }}
            />
            <input
              type="text"
              placeholder="Buscar concepto..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
              style={{
                backgroundColor: '#F6F5F2',
                border: '1px solid #EEEBE6',
                color: '#222222',
                fontFamily: 'Inter, sans-serif'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-70"
              >
                <X className="size-4" style={{ color: '#9A9A9A' }} />
              </button>
            )}

            {/* Search Results Dropdown */}
            {showResults && searchQuery && (
              <div
                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
                style={{
                  backgroundColor: 'white',
                  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.12)',
                  border: '1px solid #EEEBE6'
                }}
              >
                {searchResults.length > 0 ? (
                  <>
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleResultClick(result);
                        }}
                        className="w-full p-3 text-left hover:bg-[#F6F5F2] transition-colors flex items-start gap-3 cursor-pointer"
                        style={{ borderBottom: '1px solid #EEEBE6' }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            backgroundColor: result.type === 'note' ? '#E6DAFF' : '#D4F5E9'
                          }}
                        >
                          {result.type === 'note' ? (
                            <FileText className="size-4" style={{ color: '#9575CD' }} />
                          ) : (
                            <BookHeart className="size-4" style={{ color: '#10B981' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#222222' }}>
                            {result.title}
                          </p>
                          {result.preview && (
                            <p className="text-xs truncate" style={{ color: '#9A9A9A' }}>
                              {result.preview}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowResults(false);
                        setSearchQuery('');
                        router.push(`/library?search=${encodeURIComponent(searchQuery)}`);
                      }}
                      className="w-full p-3 text-center text-sm font-medium hover:bg-[#FFF0E6] transition-colors cursor-pointer"
                      style={{ color: '#6D6D6D' }}
                    >
                      Ver todos en Biblioteca
                    </button>
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm" style={{ color: '#9A9A9A' }}>
                      No se encontraron resultados
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive(item.href) ? '' : 'hover:bg-[#FFF0E6]'
                }`}
                style={{
                  backgroundColor: isActive(item.href)
                    ? '#FFF0E6'
                    : item.highlight && !isActive(item.href)
                    ? '#FFD9D9'
                    : 'transparent',
                  color: isActive(item.href)
                    ? '#222222'
                    : item.highlight && !isActive(item.href)
                    ? '#222222'
                    : '#6D6D6D',
                  fontWeight: isActive(item.href) ? 500 : 400
                }}
              >
                <item.icon className="size-5" />
                {!isCollapsed && (
                  <span
                    className="text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="p-4"
        style={{ borderTop: '1px solid #EEEBE6' }}
      >
        {!isCollapsed && (
          <>
            {session?.user ? (
              <>
                {/* Study Streak */}
                <div
                  className="rounded-2xl p-4 mb-3"
                  style={{ backgroundColor: '#FFF0E6' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="size-4" style={{ color: '#F5A962' }} />
                    <p
                      className="text-sm font-medium"
                      style={{ color: '#222222' }}
                    >
                      Racha de estudio
                    </p>
                  </div>
                  <p
                    className="text-lg font-bold"
                    style={{ color: '#F5A962' }}
                  >
                    {studyStreak} dias
                  </p>
                </div>

                {/* User Info */}
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: '#F6F5F2' }}
                >
                  <p
                    className="text-xs truncate mb-3"
                    style={{ color: '#6D6D6D' }}
                  >
                    {session.user.email}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{
                      backgroundColor: '#FFEEEE',
                      color: '#D46A6A'
                    }}
                  >
                    <LogOut className="size-4" />
                    Cerrar sesion
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="block w-full px-4 py-3 text-center rounded-2xl font-medium text-sm transition-all hover:opacity-90"
                style={{
                  backgroundColor: '#FFD9D9',
                  color: '#222222'
                }}
              >
                Iniciar sesion
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
