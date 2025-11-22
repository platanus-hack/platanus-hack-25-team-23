"use client"

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Network, GitBranch, User, Plus, FolderOpen, Search, LogOut, Flame, Calendar, BookHeart } from 'lucide-react';
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
        <div className="p-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4"
              style={{ color: '#9A9A9A' }}
            />
            <input
              type="text"
              placeholder="Buscar concepto..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
              style={{
                backgroundColor: '#F6F5F2',
                border: '1px solid #EEEBE6',
                color: '#222222',
                fontFamily: 'Inter, sans-serif'
              }}
            />
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
