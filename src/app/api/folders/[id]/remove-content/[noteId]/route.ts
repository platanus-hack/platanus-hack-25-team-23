import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id, noteId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Remove from folder
    const { error } = await supabase
      .from('folder_contents')
      .delete()
      .eq('folder_id', id)
      .eq('study_content_id', noteId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Content removed from folder' })
  } catch (error) {
    console.error('Remove content from folder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
