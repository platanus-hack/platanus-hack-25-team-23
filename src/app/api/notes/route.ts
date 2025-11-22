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
    const concept = searchParams.get('concept')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    let query = supabase
      .from('study_content')
      .select(`
        *,
        concept:concepts(id, name, slug),
        area:areas(id, name, color, icon)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (area) query = query.eq('area_id', area)
    if (concept) query = query.eq('concept_id', concept)
    if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
    if (limit) query = query.limit(parseInt(limit))
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || '10') - 1)

    const { data: notes, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Get notes error:', error)
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
    const { title, content, concept_id, area_id, linked_concepts, prerequisites, next_steps } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Calculate word count and read time
    const wordCount = content.split(/\s+/).length
    const estimatedReadTime = Math.ceil(wordCount / 200) // 200 words per minute

    const { data: note, error } = await supabase
      .from('study_content')
      .insert({
        user_id: user.id,
        title,
        content,
        concept_id,
        area_id,
        linked_concepts,
        prerequisites,
        next_steps,
        word_count: wordCount,
        estimated_read_time: estimatedReadTime,
        generated_by: 'user',
      })
      .select(`
        *,
        concept:concepts(id, name, slug),
        area:areas(id, name, color, icon)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('Create note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
