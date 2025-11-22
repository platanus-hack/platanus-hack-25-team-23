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

    const { x, y } = await request.json()

    if (typeof x !== 'number' || typeof y !== 'number') {
      return NextResponse.json(
        { error: 'x and y coordinates must be numbers' },
        { status: 400 }
      )
    }

    const { data: concept, error } = await supabase
      .from('concepts')
      .update({ position_x: x, position_y: y })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ concept })
  } catch (error) {
    console.error('Update node position error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
