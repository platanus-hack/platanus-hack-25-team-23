import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabase } from '@/lib/whatsapp/client'

// Get reminder settings for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const { data: connection } = await getSupabase()
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'No connection found' }, { status: 404 })
    }

    // Get reminders
    const { data: reminders } = await getSupabase()
      .from('whatsapp_reminders')
      .select('*')
      .eq('connection_id', connection.id)

    // Format for frontend
    const settings = {
      morning_enabled: false,
      morning_time: '08:00',
      night_enabled: false,
      night_time: '21:00',
      weekly_enabled: false
    }

    reminders?.forEach(r => {
      if (r.reminder_type === 'morning_checkin') {
        settings.morning_enabled = r.enabled
        settings.morning_time = r.time_of_day || '08:00'
      }
      if (r.reminder_type === 'night_reflection') {
        settings.night_enabled = r.enabled
        settings.night_time = r.time_of_day || '21:00'
      }
      if (r.reminder_type === 'weekly_review') {
        settings.weekly_enabled = r.enabled
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('[Reminders] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Save reminder settings
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { morning_enabled, morning_time, night_enabled, night_time, weekly_enabled } = body

    // Get connection
    const { data: connection } = await getSupabase()
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'No connection found' }, { status: 404 })
    }

    // Calculate next scheduled times
    const now = new Date()

    // Morning reminder
    await upsertReminder(connection.id, 'morning_checkin', morning_enabled, morning_time)

    // Night reminder
    await upsertReminder(connection.id, 'night_reflection', night_enabled, night_time)

    // Weekly reminder (Sunday at 10:00)
    await upsertReminder(connection.id, 'weekly_review', weekly_enabled, '10:00', 0)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reminders] Error saving:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Helper to upsert a reminder
async function upsertReminder(
  connectionId: string,
  reminderType: string,
  enabled: boolean,
  timeOfDay: string,
  dayOfWeek?: number
) {
  // Check if exists
  const { data: existing } = await getSupabase()
    .from('whatsapp_reminders')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('reminder_type', reminderType)
    .single()

  // Calculate next scheduled
  const nextScheduled = calculateNextScheduled(timeOfDay, dayOfWeek)

  const reminderData = {
    connection_id: connectionId,
    reminder_type: reminderType,
    enabled,
    time_of_day: timeOfDay,
    day_of_week: dayOfWeek ?? null,
    next_scheduled_at: enabled ? nextScheduled : null
  }

  if (existing) {
    await getSupabase()
      .from('whatsapp_reminders')
      .update(reminderData)
      .eq('id', existing.id)
  } else {
    await getSupabase()
      .from('whatsapp_reminders')
      .insert(reminderData)
  }
}

// Calculate next scheduled time
function calculateNextScheduled(timeOfDay: string, dayOfWeek?: number): string {
  const now = new Date()
  const next = new Date(now)
  const [hours, minutes] = timeOfDay.split(':').map(Number)

  if (dayOfWeek !== undefined) {
    // Weekly - find next occurrence of that day
    const currentDay = now.getDay()
    let daysUntil = dayOfWeek - currentDay
    if (daysUntil <= 0) daysUntil += 7

    next.setDate(now.getDate() + daysUntil)
    next.setHours(hours, minutes, 0, 0)
  } else {
    // Daily
    next.setHours(hours, minutes, 0, 0)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
  }

  return next.toISOString()
}
