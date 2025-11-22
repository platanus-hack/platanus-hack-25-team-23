import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Badge definitions
const BADGES = [
  {
    id: 'first-concept',
    name: 'Primer Paso',
    description: 'Marca tu primer concepto como entendido',
    icon: '🌱',
    condition: (stats: { understood: number }) => stats.understood >= 1,
  },
  {
    id: 'five-concepts',
    name: 'Curioso',
    description: 'Entiende 5 conceptos',
    icon: '🔍',
    condition: (stats: { understood: number }) => stats.understood >= 5,
  },
  {
    id: 'ten-concepts',
    name: 'Estudiante',
    description: 'Entiende 10 conceptos',
    icon: '📚',
    condition: (stats: { understood: number }) => stats.understood >= 10,
  },
  {
    id: 'twenty-five-concepts',
    name: 'Conocedor',
    description: 'Entiende 25 conceptos',
    icon: '🎓',
    condition: (stats: { understood: number }) => stats.understood >= 25,
  },
  {
    id: 'fifty-concepts',
    name: 'Experto',
    description: 'Entiende 50 conceptos',
    icon: '🏆',
    condition: (stats: { understood: number }) => stats.understood >= 50,
  },
  {
    id: 'hundred-concepts',
    name: 'Maestro',
    description: 'Entiende 100 conceptos',
    icon: '👑',
    condition: (stats: { understood: number }) => stats.understood >= 100,
  },
  {
    id: 'first-note',
    name: 'Escritor',
    description: 'Genera tu primera nota',
    icon: '✍️',
    condition: (stats: { notes: number }) => stats.notes >= 1,
  },
  {
    id: 'ten-notes',
    name: 'Prolífico',
    description: 'Genera 10 notas',
    icon: '📝',
    condition: (stats: { notes: number }) => stats.notes >= 10,
  },
  {
    id: 'streak-3',
    name: 'Consistente',
    description: 'Mantén una racha de 3 días',
    icon: '🔥',
    condition: (stats: { streakDays: number }) => stats.streakDays >= 3,
  },
  {
    id: 'streak-7',
    name: 'Dedicado',
    description: 'Mantén una racha de 7 días',
    icon: '⚡',
    condition: (stats: { streakDays: number }) => stats.streakDays >= 7,
  },
  {
    id: 'streak-30',
    name: 'Imparable',
    description: 'Mantén una racha de 30 días',
    icon: '💎',
    condition: (stats: { streakDays: number }) => stats.streakDays >= 30,
  },
  {
    id: 'all-areas',
    name: 'Equilibrado',
    description: 'Aprende algo en todas las 7 áreas',
    icon: '🌈',
    condition: (stats: { areasWithProgress: number }) => stats.areasWithProgress >= 7,
  },
]

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days')
      .eq('id', user.id)
      .single()

    const { data: concepts } = await supabase
      .from('concepts')
      .select('status, area_id')
      .eq('user_id', user.id)

    const { count: notesCount } = await supabase
      .from('study_content')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Calculate stats
    const understood = concepts?.filter(c => c.status === 'understood').length || 0
    const areasWithProgress = new Set(
      concepts?.filter(c => c.status === 'understood').map(c => c.area_id)
    ).size

    const stats = {
      understood,
      notes: notesCount || 0,
      streakDays: profile?.streak_days || 0,
      areasWithProgress,
    }

    // Check which badges are earned
    const badges = BADGES.map(badge => ({
      ...badge,
      earned: badge.condition(stats),
    }))

    const earnedCount = badges.filter(b => b.earned).length

    return NextResponse.json({
      badges,
      stats: {
        earned: earnedCount,
        total: BADGES.length,
        percentage: Math.round((earnedCount / BADGES.length) * 100),
      },
    })
  } catch (error) {
    console.error('Get badges error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
