import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const { areaId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get area
    const { data: area } = await supabase
      .from('areas')
      .select('*')
      .eq('id', areaId)
      .eq('user_id', user.id)
      .single()

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 })
    }

    // Get concepts in this area with their progress
    const { data: concepts } = await supabase
      .from('concepts')
      .select(`
        id, name, slug, status, level,
        user_progress(status, hours_spent, confidence_level, completed_at)
      `)
      .eq('area_id', areaId)
      .eq('user_id', user.id)

    const stats = {
      total: concepts?.length || 0,
      understood: concepts?.filter(c => c.status === 'understood').length || 0,
      inProgress: concepts?.filter(c => c.status === 'in-progress').length || 0,
      pending: concepts?.filter(c => c.status === 'pending').length || 0,
      totalHours: concepts?.reduce((sum, c) => {
        const progress = c.user_progress as Array<{ hours_spent?: number }> | null
        return sum + (progress?.[0]?.hours_spent || 0)
      }, 0) || 0,
    }

    return NextResponse.json({
      area,
      concepts,
      stats: {
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.understood / stats.total) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('Get area progress error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
