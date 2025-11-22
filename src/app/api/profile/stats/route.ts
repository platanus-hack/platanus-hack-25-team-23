import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days, total_study_hours')
      .eq('id', user.id)
      .single()

    // Count concepts by status
    const { data: concepts } = await supabase
      .from('concepts')
      .select('status')
      .eq('user_id', user.id)

    const conceptStats = {
      total: concepts?.length || 0,
      understood: concepts?.filter(c => c.status === 'understood').length || 0,
      inProgress: concepts?.filter(c => c.status === 'in-progress').length || 0,
      pending: concepts?.filter(c => c.status === 'pending').length || 0,
    }

    // Count study content
    const { count: notesCount } = await supabase
      .from('study_content')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Count areas
    const { count: areasCount } = await supabase
      .from('areas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      stats: {
        streakDays: profile?.streak_days || 0,
        totalStudyHours: profile?.total_study_hours || 0,
        concepts: conceptStats,
        notesCount: notesCount || 0,
        areasCount: areasCount || 0,
        completionRate: conceptStats.total > 0
          ? Math.round((conceptStats.understood / conceptStats.total) * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
