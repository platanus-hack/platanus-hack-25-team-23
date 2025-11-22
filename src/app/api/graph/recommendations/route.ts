import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's concepts
    const { data: concepts } = await supabase
      .from('concepts')
      .select(`
        id, name, slug, status, level,
        area:areas(id, name, color)
      `)
      .eq('user_id', user.id)

    // Get understood concepts
    const understoodConcepts = concepts?.filter(c => c.status === 'understood') || []
    const inProgressConcepts = concepts?.filter(c => c.status === 'in-progress') || []

    // Get relationships for understood concepts
    const understoodIds = understoodConcepts.map(c => c.id)

    const { data: relationships } = await supabase
      .from('concept_relationships')
      .select(`
        target_concept:concepts!target_concept_id(id, name, slug, status, level, area:areas(name, color))
      `)
      .eq('user_id', user.id)
      .eq('relationship_type', 'next_step')
      .in('source_concept_id', understoodIds)

    // Find recommended next steps (concepts that are next_step from understood ones but not yet understood)
    const recommendations: Array<{
      concept: unknown
      reason: string
      priority: number
    }> = []

    relationships?.forEach(rel => {
      const target = rel.target_concept as unknown as { id: string; status: string; name: string; slug: string; level: string } | null
      if (target && target.status !== 'understood') {
        const existing = recommendations.find(r => (r.concept as { id: string }).id === target.id)
        if (!existing) {
          recommendations.push({
            concept: target,
            reason: 'Siguiente paso natural basado en tu progreso',
            priority: target.status === 'in-progress' ? 1 : 2,
          })
        }
      }
    })

    // Add in-progress concepts as high priority
    inProgressConcepts.forEach(concept => {
      const existing = recommendations.find(r => (r.concept as { id: string }).id === concept.id)
      if (!existing) {
        recommendations.push({
          concept,
          reason: 'Continua donde lo dejaste',
          priority: 1,
        })
      }
    })

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority)

    return NextResponse.json({
      recommendations: recommendations.slice(0, 5),
      stats: {
        totalConcepts: concepts?.length || 0,
        understood: understoodConcepts.length,
        inProgress: inProgressConcepts.length,
      },
    })
  } catch (error) {
    console.error('Get recommendations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
