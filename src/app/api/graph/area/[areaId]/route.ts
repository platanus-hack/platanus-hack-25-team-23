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

    // Get area info
    const { data: area } = await supabase
      .from('areas')
      .select('*')
      .eq('id', areaId)
      .eq('user_id', user.id)
      .single()

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 })
    }

    // Get concepts in this area
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, name, slug, status, level, is_central, position_x, position_y')
      .eq('area_id', areaId)
      .eq('user_id', user.id)

    const conceptIds = concepts?.map(c => c.id) || []

    // Get relationships between concepts in this area
    const { data: relationships } = await supabase
      .from('concept_relationships')
      .select('id, source_concept_id, target_concept_id, relationship_type, strength')
      .eq('user_id', user.id)
      .in('source_concept_id', conceptIds)
      .in('target_concept_id', conceptIds)

    // Build subgraph
    const nodes = [
      // Area node at center
      {
        id: `area-${area.id}`,
        name: area.name,
        status: 'understood',
        area: area.name,
        color: area.color,
        icon: area.icon,
        level: 'basic',
        isAreaNode: true,
      },
      // Concept nodes
      ...(concepts?.map(concept => ({
        id: concept.id,
        name: concept.name,
        slug: concept.slug,
        status: concept.status,
        area: area.name,
        color: area.color,
        level: concept.level,
        isCentral: concept.is_central,
        x: concept.position_x,
        y: concept.position_y,
      })) || []),
    ]

    const links = [
      // Connect all concepts to area
      ...(concepts?.map(concept => ({
        source: `area-${area.id}`,
        target: concept.id,
      })) || []),
      // Add concept relationships
      ...(relationships?.map(rel => ({
        source: rel.source_concept_id,
        target: rel.target_concept_id,
        type: rel.relationship_type,
        strength: rel.strength,
      })) || []),
    ]

    return NextResponse.json({
      area,
      nodes,
      links,
      metadata: {
        totalNodes: nodes.length,
        totalLinks: links.length,
      },
    })
  } catch (error) {
    console.error('Get area graph error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
