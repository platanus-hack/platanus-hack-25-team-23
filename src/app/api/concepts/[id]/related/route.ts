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

    // Get related concepts (where this concept is source or target)
    const { data: relationships } = await supabase
      .from('concept_relationships')
      .select(`
        id,
        relationship_type,
        strength,
        source_concept:concepts!source_concept_id(id, name, slug, status, level),
        target_concept:concepts!target_concept_id(id, name, slug, status, level)
      `)
      .eq('user_id', user.id)
      .or(`source_concept_id.eq.${id},target_concept_id.eq.${id}`)

    // Extract unique related concepts
    const relatedConcepts: Record<string, { concept: unknown; relationshipType: string; strength: number }> = {}

    relationships?.forEach(rel => {
      const sourceConcept = rel.source_concept as unknown as { id: string; name: string; slug: string; status: string; level: string } | null
      const targetConcept = rel.target_concept as unknown as { id: string; name: string; slug: string; status: string; level: string } | null

      if (sourceConcept && sourceConcept.id !== id) {
        relatedConcepts[sourceConcept.id] = {
          concept: sourceConcept,
          relationshipType: rel.relationship_type,
          strength: rel.strength,
        }
      }
      if (targetConcept && targetConcept.id !== id) {
        relatedConcepts[targetConcept.id] = {
          concept: targetConcept,
          relationshipType: rel.relationship_type,
          strength: rel.strength,
        }
      }
    })

    return NextResponse.json({
      related: Object.values(relatedConcepts),
    })
  } catch (error) {
    console.error('Get related concepts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
