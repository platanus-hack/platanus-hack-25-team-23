"use client"

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Network, GitBranch, User, Plus, FolderOpen, Search, LogOut, Flame, Calendar, BookHeart, FileText, X } from 'lucide-react';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { useJournal, formatDate } from '@/lib/store/journal-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SidebarProps {
  isCollapsed?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'note' | 'journal';
  href: string;
  preview?: string;
}

export function Sidebar({ isCollapsed = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Auto-close on mobile when route changes
  useEffect(() => {
    if (isOpen && onClose) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  const { session, notes } = useKnowledge();
  const { entries: journalEntries, getStreak } = useJournal();
  const studyStreak = getStreak();

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
        entry.free_thoughts,
        entry.daily_intention,
        entry.lesson,
        ...(entry.gratitude || []),
        ...(entry.best_moments || []),
        ...(entry.make_great || [])
      ].filter(Boolean).join(' ').toLowerCase();

      if (entryText.includes(query)) {
        const date = new Date(entry.date + 'T00:00:00');
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        results.push({
          id: entry.id,
          title: `Journal - ${dayNames[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`,
          type: 'journal',
          href: `/journal?date=${entry.date}`,
          preview: entry.free_thoughts?.substring(0, 60) || entry.daily_intention?.substring(0, 60) || ''
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
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 h-full bg-card border-r border-border shadow-xl transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:h-screen md:shadow-none
          ${isCollapsed ? 'md:w-16' : 'md:w-64'}
          w-64
        `}
      >
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted md:hidden text-muted-foreground"
        >
          <X className="size-5" />
        </button>
      {/* Logo */}
      <div
        className="p-5 border-b border-border"
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
            <span className="text-lg font-semibold text-foreground font-display tracking-tight">
              BrainFlow
            </span>
          )}
        </Link>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="p-4" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
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
              className="w-full pl-10 pr-8 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-70"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            )}

            {/* Search Results Dropdown */}
            {showResults && searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 bg-card shadow-lg border border-border">
                {searchResults.length > 0 ? (
                  <>
                    {searchResults.map((result) => (
                      <Link
                        key={result.id}
                        href={result.href}
                        onClick={() => {
                          setSearchQuery('');
                          setShowResults(false);
                        }}
                        className="w-full p-3 text-left hover:bg-muted transition-colors flex items-start gap-3 cursor-pointer border-b border-border last:border-0"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            result.type === 'note' ? 'bg-primary/10' : 'bg-emerald-500/10'
                          }`}
                        >
                          {result.type === 'note' ? (
                            <FileText className="size-4 text-primary" />
                          ) : (
                            <BookHeart className="size-4 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">
                            {result.title}
                          </p>
                          {result.preview && (
                            <p className="text-xs truncate text-muted-foreground">
                              {result.preview}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                    <Link
                      href={`/library?search=${encodeURIComponent(searchQuery)}`}
                      onClick={() => {
                        setSearchQuery('');
                        setShowResults(false);
                      }}
                      className="w-full p-3 text-center text-sm font-medium hover:bg-muted transition-colors cursor-pointer block text-muted-foreground hover:text-foreground"
                    >
                      Ver todos en Biblioteca
                    </Link>
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">
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
                  isActive(item.href) 
                    ? 'bg-primary/10 text-foreground font-medium' 
                    : item.highlight && !isActive(item.href)
                    ? 'bg-primary/5 text-foreground hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="size-5" />
                {!isCollapsed && (
                  <span className="text-sm font-sans">
                    {item.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        {!isCollapsed && (
          <>
            {session?.user ? (
              <>
                {/* Study Streak */}
                <div className="rounded-2xl p-4 mb-3 bg-amber-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="size-4 text-amber-500" />
                    <p className="text-sm font-medium text-foreground">
                      Racha de estudio
                    </p>
                  </div>
                  <p className="text-lg font-bold text-amber-500">
                    {studyStreak} dias
                  </p>
                </div>

                {/* User Info */}
                <div className="rounded-2xl p-4 bg-muted/50">
                  <p className="text-xs truncate mb-3 text-muted-foreground">
                    {session.user.email}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 bg-destructive/10 text-destructive"
                  >
                    <LogOut className="size-4" />
                    Cerrar sesion
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="block w-full px-4 py-3 text-center rounded-2xl font-medium text-sm transition-all hover:opacity-90 bg-primary/20 text-foreground"
              >
                Iniciar sesion
              </Link>
            )}
          </>
        )}
      </div>
      </div>
    </>
  );
}
