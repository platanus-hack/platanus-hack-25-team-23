import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { areaIds } = await request.json()

    if (!Array.isArray(areaIds)) {
      return NextResponse.json(
        { error: 'areaIds must be an array of area IDs in the desired order' },
        { status: 400 }
      )
    }

    // Update each area's order position
    const updates = areaIds.map((id: string, index: number) =>
      supabase
        .from('areas')
        .update({ order_position: index })
        .eq('id', id)
        .eq('user_id', user.id)
    )

    await Promise.all(updates)

    // Fetch updated areas
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
    console.error('Reorder areas error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
