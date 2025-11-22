import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all folders with their contents count
    const { data: folders, error } = await supabase
      .from('folders')
      .select(`
        *,
        area:areas(id, name, color, icon),
        parent:folders!parent_id(id, name),
        folder_contents(count)
      `)
      .eq('user_id', user.id)
      .order('order_position', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Build hierarchical structure
    const buildTree = (parentId: string | null): unknown[] => {
      return (folders || [])
        .filter(f => f.parent_id === parentId)
        .map(folder => ({
          ...folder,
          contentsCount: folder.folder_contents?.[0]?.count || 0,
          children: buildTree(folder.id),
        }))
    }

    const hierarchicalFolders = buildTree(null)

    return NextResponse.json({
      folders: hierarchicalFolders,
      flatFolders: folders,
    })
  } catch (error) {
    console.error('Get folders error:', error)
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
    const { name, description, parent_id, area_id, color, icon } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Get max order position in parent
    const { data: existing } = await supabase
      .from('folders')
      .select('order_position')
      .eq('user_id', user.id)
      .is('parent_id', parent_id || null)
      .order('order_position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].order_position + 1 : 0

    const { data: folder, error } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name,
        description,
        parent_id,
        area_id,
        color,
        icon,
        order_position: nextPosition,
      })
      .select(`
        *,
        area:areas(id, name, color, icon)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ folder }, { status: 201 })
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
