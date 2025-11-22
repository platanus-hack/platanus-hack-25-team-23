import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: areas, error } = await supabase
      .from('areas')
      .select('*')
      .eq('user_id', user.id)
      .order('order_position', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ areas })
  } catch (error) {
    console.error('Get areas error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, color, icon } = body

    if (!name || !color || !icon) {
      return NextResponse.json(
        { error: 'Name, color, and icon are required' },
        { status: 400 }
      )
    }

    // Get max order position
    const { data: existing } = await supabase
      .from('areas')
      .select('order_position')
      .eq('user_id', user.id)
      .order('order_position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].order_position + 1 : 0

    const { data: area, error } = await supabase
      .from('areas')
      .insert({
        user_id: user.id,
        name,
        description,
        color,
        icon,
        order_position: nextPosition,
        is_default: false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An area with this name already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ area }, { status: 201 })
  } catch (error) {
    console.error('Create area error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
