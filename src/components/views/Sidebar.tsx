"use client"

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Network, GitBranch, User, Plus, FolderOpen, Search, Brain, LogOut, Flame, Calendar } from 'lucide-react';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SidebarProps {
  isCollapsed?: boolean;
}

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useKnowledge();
  // Streak disabled - table doesn't exist in Supabase
  const studyStreak = 0;

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
        backgroundColor: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)'
      }}
    >
      {/* Logo */}
      <div
        className="p-6"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
              boxShadow: '0px 2px 8px rgba(201, 183, 243, 0.3)'
            }}
          >
            <Brain className="size-5 text-white" />
          </div>
          {!isCollapsed && (
            <span
              className="text-xl font-bold"
              style={{ color: '#C9B7F3' }}
            >
              KnowledgeFlow
            </span>
          )}
        </Link>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div
          className="p-4"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Buscar concepto..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)'
              }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive(item.href) ? 'scale-[1.02]' : 'hover:scale-[1.02]'
                }`}
                style={{
                  background: isActive(item.href)
                    ? 'linear-gradient(135deg, rgba(201, 183, 243, 0.2) 0%, rgba(214, 201, 245, 0.2) 100%)'
                    : item.highlight && !isActive(item.href)
                    ? 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)'
                    : 'transparent',
                  color: isActive(item.href)
                    ? 'var(--sidebar-primary)'
                    : item.highlight && !isActive(item.href)
                    ? 'white'
                    : 'var(--sidebar-foreground)',
                  boxShadow: item.highlight && !isActive(item.href)
                    ? '0px 2px 8px rgba(201, 183, 243, 0.3)'
                    : 'none'
                }}
              >
                <item.icon className="size-5" />
                {!isCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="p-4"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        {!isCollapsed && (
          <>
            {session?.user ? (
              <>
                {/* Study Streak */}
                <div
                  className="rounded-2xl p-4 mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #FFE8CC 0%, #FFF4E6 100%)',
                    border: '2px solid #FFD5A5'
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="size-4" style={{ color: '#FF9D5D' }} />
                    <p className="text-sm font-medium" style={{ color: '#1E1E1E' }}>Racha de estudio</p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: '#CC7E4A' }}>
                    {studyStreak} dias consecutivos 🔥
                  </p>
                </div>

                {/* User Info */}
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: 'var(--sidebar-accent)' }}
                >
                  <p
                    className="text-xs truncate mb-3"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {session.user.email}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: 'rgba(255, 177, 177, 0.2)',
                      color: '#E57373',
                      border: '1px solid rgba(255, 177, 177, 0.5)'
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
                className="block w-full px-4 py-3 text-center rounded-2xl font-medium transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #C9B7F3 0%, #D6C9F5 100%)',
                  color: 'white',
                  boxShadow: '0px 4px 14px rgba(201, 183, 243, 0.3)'
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
