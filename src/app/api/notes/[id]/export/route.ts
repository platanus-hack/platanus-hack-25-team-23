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

    const { data: note, error } = await supabase
      .from('study_content')
      .select(`
        *,
        concept:concepts(name),
        area:areas(name)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Build markdown export
    const markdown = `# ${note.title}

${note.area ? `**Area:** ${(note.area as { name: string }).name}` : ''}
${note.concept ? `**Concepto:** ${(note.concept as { name: string }).name}` : ''}
${note.estimated_read_time ? `**Tiempo de lectura:** ${note.estimated_read_time} min` : ''}

---

${note.content}

---

${note.prerequisites && note.prerequisites.length > 0 ? `
## Prerrequisitos
${note.prerequisites.map((p: string) => `- ${p}`).join('\n')}
` : ''}

${note.next_steps && note.next_steps.length > 0 ? `
## Proximos pasos
${note.next_steps.map((s: string) => `- ${s}`).join('\n')}
` : ''}

---
*Generado con BrainFlow - ${new Date().toLocaleDateString('es-ES')}*
`

    // Log analytics event
    await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_type: 'note_exported',
        study_content_id: id,
        event_data: { format: 'markdown' },
      })

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${note.title.replace(/[^a-z0-9]/gi, '-')}.md"`,
      },
    })
  } catch (error) {
    console.error('Export note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
