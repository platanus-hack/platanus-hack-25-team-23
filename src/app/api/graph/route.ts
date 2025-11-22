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
    const viewMode = searchParams.get('viewMode') || 'area'
    const includeYouNode = searchParams.get('includeYouNode') !== 'false'

    // Get all concepts (nodes)
    const { data: concepts } = await supabase
      .from('concepts')
      .select(`
        id, name, slug, status, level, is_central, position_x, position_y,
        area:areas(id, name, color, icon)
      `)
      .eq('user_id', user.id)

    // Get all relationships (edges)
    const { data: relationships } = await supabase
      .from('concept_relationships')
      .select('id, source_concept_id, target_concept_id, relationship_type, strength')
      .eq('user_id', user.id)

    // Get areas for area nodes
    const { data: areas } = await supabase
      .from('areas')
      .select('id, name, color, icon')
      .eq('user_id', user.id)
      .order('order_position', { ascending: true })

    // Build graph structure
    const nodes: Array<{
      id: string
      name: string
      status: string
      area: string
      color?: string
      icon?: string
      level: string
      isYouNode?: boolean
      isAreaNode?: boolean
      isCentral?: boolean
      slug?: string
      x?: number
      y?: number
    }> = []

    const links: Array<{
      source: string
      target: string
      type?: string
      strength?: number
    }> = []

    // Add "Yo" central node if requested
    if (includeYouNode) {
      nodes.push({
        id: 'yo',
        name: 'Yo',
        status: 'understood',
        area: 'Centro',
        level: 'basic',
        isYouNode: true,
      })

      // Connect Yo to all areas
      areas?.forEach(area => {
        links.push({
          source: 'yo',
          target: `area-${area.id}`,
        })
      })
    }

    // Add area nodes
    areas?.forEach(area => {
      nodes.push({
        id: `area-${area.id}`,
        name: area.name,
        status: 'understood',
        area: area.name,
        color: area.color,
        icon: area.icon,
        level: 'basic',
        isAreaNode: true,
      })
    })

    // Add concept nodes
    concepts?.forEach(concept => {
      const area = concept.area as unknown as { id: string; name: string; color: string; icon: string } | null
      nodes.push({
        id: concept.id,
        name: concept.name,
        slug: concept.slug,
        status: concept.status,
        area: area?.name || 'Sin area',
        color: area?.color,
        level: concept.level,
        isCentral: concept.is_central,
        x: concept.position_x ?? undefined,
        y: concept.position_y ?? undefined,
      })

      // Connect to area node
      if (area) {
        links.push({
          source: `area-${area.id}`,
          target: concept.id,
        })
      }
    })

    // Add relationship links
    relationships?.forEach(rel => {
      links.push({
        source: rel.source_concept_id,
        target: rel.target_concept_id,
        type: rel.relationship_type,
        strength: rel.strength,
      })
    })

    return NextResponse.json({
      nodes,
      links,
      metadata: {
        totalNodes: nodes.length,
        totalLinks: links.length,
        viewMode,
      }
    })
  } catch (error) {
    console.error('Get graph error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
