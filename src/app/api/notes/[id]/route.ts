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

    const { data: note, error } = await supabase
      .from('study_content')
      .select(`
        *,
        concept:concepts(id, name, slug, status),
        area:areas(id, name, color, icon)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Get note error:', error)
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
    const { title, content, concept_id, area_id, linked_concepts, prerequisites, next_steps } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) {
      updateData.content = content
      updateData.word_count = content.split(/\s+/).length
      updateData.estimated_read_time = Math.ceil(content.split(/\s+/).length / 200)
    }
    if (concept_id !== undefined) updateData.concept_id = concept_id
    if (area_id !== undefined) updateData.area_id = area_id
    if (linked_concepts !== undefined) updateData.linked_concepts = linked_concepts
    if (prerequisites !== undefined) updateData.prerequisites = prerequisites
    if (next_steps !== undefined) updateData.next_steps = next_steps

    const { data: note, error } = await supabase
      .from('study_content')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        *,
        concept:concepts(id, name, slug),
        area:areas(id, name, color, icon)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Update note error:', error)
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
      .from('study_content')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Note deleted successfully' })
  } catch (error) {
    console.error('Delete note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
