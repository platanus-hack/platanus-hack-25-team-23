import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: progress, error } = await supabase
      .from('user_progress')
      .select(`
        *,
        concept:concepts(id, name, slug, status)
      `)
      .eq('user_id', user.id)
      .eq('concept_id', conceptId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Get concept progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, hours_spent, confidence_level } = body

    const updateData: Record<string, unknown> = {
      user_id: user.id,
      concept_id: conceptId,
    }

    if (status) {
      updateData.status = status
      if (status === 'in-progress' && !updateData.started_at) {
        updateData.started_at = new Date().toISOString()
      }
      if (status === 'understood') {
        updateData.completed_at = new Date().toISOString()
      }
    }
    if (hours_spent !== undefined) updateData.hours_spent = hours_spent
    if (confidence_level !== undefined) updateData.confidence_level = confidence_level

    // Update last reviewed
    updateData.last_reviewed_at = new Date().toISOString()
    updateData.review_count = 1 // Will be incremented via trigger or manually

    const { data: progress, error } = await supabase
      .from('user_progress')
      .upsert(updateData, { onConflict: 'user_id,concept_id' })
      .select(`
        *,
        concept:concepts(id, name, slug, status)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Also update concept status if changed
    if (status) {
      await supabase
        .from('concepts')
        .update({ status })
        .eq('id', conceptId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Update concept progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
