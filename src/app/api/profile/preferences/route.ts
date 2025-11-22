import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await request.json()

    // Get current preferences and merge
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const mergedPreferences = {
      ...(currentProfile?.preferences || {}),
      ...preferences,
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ preferences: mergedPreferences })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
