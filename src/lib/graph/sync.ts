import { createClient } from '@/lib/supabase/server';

import { SupabaseClient } from '@supabase/supabase-js';

export async function syncFileToGraph(userId: string, fileName: string, content: string, client?: SupabaseClient) {
  const supabase = client || await createClient();
  
  // 1. Derive Note Title and Slug
  const noteTitle = fileName.replace(/\.md$/i, '');
  const slug = noteTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // 2. Upsert Note
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .upsert({
      user_id: userId,
      title: noteTitle,
      slug: slug,
      content: content,
      status: 'understood', // Assume created notes are "understood" or "in-progress"
      is_generated: true
    }, { onConflict: 'user_id, slug' })
    .select('id')
    .single();

  if (noteError || !note) {
    console.error('Error syncing note:', noteError);
    return;
  }

  // 3. Extract Links and Create Edges
  const linkRegex = /\[\[(.*?)\]\]/g;
  const matches = [...content.matchAll(linkRegex)];
  const linkedTerms = matches.map(m => m[1]);

  // Clear existing outgoing edges for this source
  await supabase
    .from('edges')
    .delete()
    .eq('source_id', note.id);

  for (const term of linkedTerms) {
    const targetSlug = term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Find target note (it might not exist yet!)
    let targetId: string | null = null;

    const { data: target } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', targetSlug)
      .single();

    if (target) {
      targetId = target.id;
    } else {
      // Create Ghost Node
      const { data: newTarget } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: term,
          slug: targetSlug,
          status: 'new', // Ghost node is new/pending
          is_generated: true
        })
        .select('id')
        .single();
      targetId = newTarget?.id || null;
    }

    if (targetId) {
      await supabase
        .from('edges')
        .insert({
          user_id: userId,
          source_id: note.id,
          target_id: targetId,
          relationship: 'related_to'
        });
    }
  }
}
