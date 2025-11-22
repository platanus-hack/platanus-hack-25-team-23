import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
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

    const { status } = await request.json()

    if (!['pending', 'in-progress', 'understood'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, in-progress, or understood' },
        { status: 400 }
      )
    }

    const { data: concept, error } = await supabase
      .from('concepts')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update user_progress as well
    await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        concept_id: id,
        status,
        started_at: status === 'in-progress' ? new Date().toISOString() : undefined,
        completed_at: status === 'understood' ? new Date().toISOString() : undefined,
      }, {
        onConflict: 'user_id,concept_id',
      })

    return NextResponse.json({ concept })
  } catch (error) {
    console.error('Update status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
