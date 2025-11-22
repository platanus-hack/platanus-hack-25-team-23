import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event_type, event_data, concept_id, study_content_id, session_id } = body

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400 })
    }

    const { data: event, error } = await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_type,
        event_data: event_data || {},
        concept_id,
        study_content_id,
        session_id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Log event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
