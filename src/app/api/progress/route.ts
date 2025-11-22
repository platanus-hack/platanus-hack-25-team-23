import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user progress entries
    const { data: progress } = await supabase
      .from('user_progress')
      .select(`
        *,
        concept:concepts(id, name, slug, status, area:areas(name, color))
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    // Get profile stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days, total_study_hours')
      .eq('id', user.id)
      .single()

    // Calculate totals
    const totalHours = progress?.reduce((sum, p) => sum + (p.hours_spent || 0), 0) || 0
    const understood = progress?.filter(p => p.status === 'understood').length || 0
    const inProgress = progress?.filter(p => p.status === 'in-progress').length || 0

    return NextResponse.json({
      progress,
      summary: {
        totalConcepts: progress?.length || 0,
        understood,
        inProgress,
        pending: (progress?.length || 0) - understood - inProgress,
        totalHours,
        streakDays: profile?.streak_days || 0,
        completionRate: progress?.length ? Math.round((understood / progress.length) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('Get progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
