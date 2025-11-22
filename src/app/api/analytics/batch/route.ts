import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { events } = await request.json()

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events must be a non-empty array' }, { status: 400 })
    }

    // Add user_id to all events
    const eventsWithUser = events.map(event => ({
      ...event,
      user_id: user.id,
      event_data: event.event_data || {},
    }))

    const { data: insertedEvents, error } = await supabase
      .from('analytics_events')
      .insert(eventsWithUser)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      inserted: insertedEvents?.length || 0,
      events: insertedEvents,
    }, { status: 201 })
  } catch (error) {
    console.error('Batch log events error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
