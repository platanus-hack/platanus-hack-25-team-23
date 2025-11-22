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

    // Update concept status
    const { data: concept, error } = await supabase
      .from('concepts')
      .update({ status: 'understood' })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update or create progress record
    await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        concept_id: id,
        status: 'understood',
        completed_at: new Date().toISOString(),
        confidence_level: 3, // Default confidence
      }, {
        onConflict: 'user_id,concept_id',
      })

    // Log analytics event
    await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_type: 'concept_understood',
        concept_id: id,
        event_data: { concept_name: concept.name },
      })

    return NextResponse.json({
      concept,
      message: 'Concept marked as understood!',
    })
  } catch (error) {
    console.error('Mark understood error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
