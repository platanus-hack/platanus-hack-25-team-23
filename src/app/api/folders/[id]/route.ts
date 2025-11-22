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

    // Get folder with contents
    const { data: folder, error } = await supabase
      .from('folders')
      .select(`
        *,
        area:areas(id, name, color, icon),
        parent:folders!parent_id(id, name)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Get folder contents (notes)
    const { data: contents } = await supabase
      .from('folder_contents')
      .select(`
        id, order_position, added_at,
        study_content:study_content(id, title, created_at, word_count, estimated_read_time)
      `)
      .eq('folder_id', id)
      .order('order_position', { ascending: true })

    // Get subfolders
    const { data: subfolders } = await supabase
      .from('folders')
      .select('id, name, icon, color')
      .eq('parent_id', id)
      .eq('user_id', user.id)
      .order('order_position', { ascending: true })

    return NextResponse.json({
      folder,
      contents: contents?.map(c => c.study_content) || [],
      subfolders: subfolders || [],
    })
  } catch (error) {
    console.error('Get folder error:', error)
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
    const { name, description, color, icon, area_id } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (area_id !== undefined) updateData.area_id = area_id

    const { data: folder, error } = await supabase
      .from('folders')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('Update folder error:', error)
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
      .from('folders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Folder deleted successfully' })
  } catch (error) {
    console.error('Delete folder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
