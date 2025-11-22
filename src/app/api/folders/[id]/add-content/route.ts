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

    const { noteId } = await request.json()

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 })
    }

    // Verify folder belongs to user
    const { data: folder } = await supabase
      .from('folders')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Verify note belongs to user
    const { data: note } = await supabase
      .from('study_content')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single()

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Get max order position
    const { data: existing } = await supabase
      .from('folder_contents')
      .select('order_position')
      .eq('folder_id', id)
      .order('order_position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].order_position + 1 : 0

    // Add to folder
    const { data: content, error } = await supabase
      .from('folder_contents')
      .insert({
        folder_id: id,
        study_content_id: noteId,
        order_position: nextPosition,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Note is already in this folder' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ content }, { status: 201 })
  } catch (error) {
    console.error('Add content to folder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
