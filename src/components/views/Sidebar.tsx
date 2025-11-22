"use client"

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, Network, GitBranch, User, Plus, FolderOpen, Search, Brain, LogOut } from 'lucide-react';
import { useKnowledge } from '@/lib/store/knowledge-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

interface SidebarProps {
  isCollapsed?: boolean;
}

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useKnowledge();
  const [studyStreak, setStudyStreak] = useState(0);

  useEffect(() => {
    async function loadStreak() {
      if (!session?.user) return;

      const supabase = createClient();
      const { data } = await supabase
        .from('user_progress')
        .select('study_streak')
        .eq('user_id', session.user.id)
        .order('study_streak', { ascending: false })
        .limit(1)
        .single();

      if (data?.study_streak) {
        setStudyStreak(data.study_streak);
      }
    }
    loadStreak();
  }, [session]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sesion cerrada");
    router.push('/');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/dashboard' },
    { id: 'new-query', label: 'Nueva Consulta', icon: Plus, href: '/new-query' },
    { id: 'library', label: 'Biblioteca', icon: FolderOpen, href: '/library' },
    { id: 'graph', label: 'Grafo', icon: Network, href: '/graph' },
    { id: 'tree', label: 'Ruta', icon: GitBranch, href: '/tree' },
    { id: 'profile', label: 'Perfil', icon: User, href: '/profile' },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen`}>
      <div className="p-6 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Brain className="size-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              KnowledgeFlow
            </span>
          )}
        </Link>
      </div>

      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
            <input
              type="text"
              placeholder="Buscar concepto..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="size-5" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        {!isCollapsed && (
          <>
            {session?.user ? (
              <>
                <div className="bg-purple-50 rounded-lg p-4 mb-3">
                  <p className="text-sm text-purple-900 mb-2">Racha de estudio</p>
                  <p className="text-purple-700 font-semibold">{studyStreak} dias consecutivos</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 truncate mb-2">{session.user.email}</p>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <LogOut className="size-4" />
                    Cerrar sesion
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="block w-full px-4 py-3 text-center text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
