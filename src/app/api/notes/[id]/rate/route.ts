import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rating } = await request.json()

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a number between 1 and 5' },
        { status: 400 }
      )
    }

    const { data: note, error } = await supabase
      .from('study_content')
      .update({ quality_rating: rating })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log analytics event
    await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_type: 'note_rated',
        study_content_id: id,
        event_data: { rating },
      })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Rate note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
