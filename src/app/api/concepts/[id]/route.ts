import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
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

    const { data: concept, error } = await supabase
      .from('concepts')
      .select(`
        *,
        area:areas(id, name, color, icon),
        parent:concepts!parent_id(id, name, slug),
        study_content(id, title, created_at)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ concept })
  } catch (error) {
    console.error('Get concept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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

    const body = await request.json()
    const { name, definition, area_id, level, status, parent_id, estimated_hours, difficulty, is_central } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) {
      updateData.name = name
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }
    if (definition !== undefined) updateData.definition = definition
    if (area_id !== undefined) updateData.area_id = area_id
    if (level !== undefined) updateData.level = level
    if (status !== undefined) updateData.status = status
    if (parent_id !== undefined) updateData.parent_id = parent_id
    if (estimated_hours !== undefined) updateData.estimated_hours = estimated_hours
    if (difficulty !== undefined) updateData.difficulty = difficulty
    if (is_central !== undefined) updateData.is_central = is_central

    const { data: concept, error } = await supabase
      .from('concepts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        *,
        area:areas(id, name, color, icon)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ concept })
  } catch (error) {
    console.error('Update concept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from('concepts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Concept deleted successfully' })
  } catch (error) {
    console.error('Delete concept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
