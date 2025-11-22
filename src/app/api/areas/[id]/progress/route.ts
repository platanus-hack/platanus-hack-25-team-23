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

    // Get area info
    const { data: area } = await supabase
      .from('areas')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 })
    }

    // Get concepts in this area
    const { data: concepts } = await supabase
      .from('concepts')
      .select('status')
      .eq('area_id', id)
      .eq('user_id', user.id)

    const stats = {
      total: concepts?.length || 0,
      understood: concepts?.filter(c => c.status === 'understood').length || 0,
      inProgress: concepts?.filter(c => c.status === 'in-progress').length || 0,
      pending: concepts?.filter(c => c.status === 'pending').length || 0,
    }

    const progressPercentage = stats.total > 0
      ? Math.round((stats.understood / stats.total) * 100)
      : 0

    // Get study content count
    const { count: notesCount } = await supabase
      .from('study_content')
      .select('id', { count: 'exact', head: true })
      .eq('area_id', id)
      .eq('user_id', user.id)

    return NextResponse.json({
      area,
      progress: {
        ...stats,
        percentage: progressPercentage,
        notesCount: notesCount || 0,
      },
    })
  } catch (error) {
    console.error('Get area progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
