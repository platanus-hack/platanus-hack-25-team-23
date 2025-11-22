import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get progress events from analytics
    const { data: events } = await supabase
      .from('analytics_events')
      .select('event_type, event_data, created_at')
      .eq('user_id', user.id)
      .in('event_type', ['concept_understood', 'note_created', 'study_session'])
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    // Group by date
    const timeline: Record<string, { date: string; understood: number; notes: number; sessions: number }> = {}

    events?.forEach(event => {
      const date = event.created_at.split('T')[0]
      if (!timeline[date]) {
        timeline[date] = { date, understood: 0, notes: 0, sessions: 0 }
      }

      if (event.event_type === 'concept_understood') {
        timeline[date].understood++
      } else if (event.event_type === 'note_created') {
        timeline[date].notes++
      } else if (event.event_type === 'study_session') {
        timeline[date].sessions++
      }
    })

    // Get completed concepts by date
    const { data: completedConcepts } = await supabase
      .from('user_progress')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'understood')
      .gte('completed_at', startDate.toISOString())

    completedConcepts?.forEach(progress => {
      if (progress.completed_at) {
        const date = progress.completed_at.split('T')[0]
        if (!timeline[date]) {
          timeline[date] = { date, understood: 0, notes: 0, sessions: 0 }
        }
        timeline[date].understood++
      }
    })

    return NextResponse.json({
      timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)),
      summary: {
        totalDays: days,
        activeDays: Object.keys(timeline).length,
        totalUnderstood: Object.values(timeline).reduce((sum, t) => sum + t.understood, 0),
        totalNotes: Object.values(timeline).reduce((sum, t) => sum + t.notes, 0),
      },
    })
  } catch (error) {
    console.error('Get timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
