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
    const area = searchParams.get('area')
    const status = searchParams.get('status')
    const level = searchParams.get('level')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    let query = supabase
      .from('concepts')
      .select(`
        *,
        area:areas(id, name, color, icon)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (area) query = query.eq('area_id', area)
    if (status) query = query.eq('status', status)
    if (level) query = query.eq('level', level)
    if (search) query = query.ilike('name', `%${search}%`)
    if (limit) query = query.limit(parseInt(limit))
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || '10') - 1)

    const { data: concepts, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ concepts })
  } catch (error) {
    console.error('Get concepts error:', error)
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
    const { name, definition, area_id, level, status, parent_id, estimated_hours, difficulty } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const { data: concept, error } = await supabase
      .from('concepts')
      .insert({
        user_id: user.id,
        name,
        slug,
        definition,
        area_id,
        level: level || 'basic',
        status: status || 'pending',
        parent_id,
        estimated_hours,
        difficulty,
      })
      .select(`
        *,
        area:areas(id, name, color, icon)
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A concept with this name already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ concept }, { status: 201 })
  } catch (error) {
    console.error('Create concept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
