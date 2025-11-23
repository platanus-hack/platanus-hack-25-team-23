import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, sendWhatsAppMessage } from '@/lib/whatsapp'

// Cron job to send scheduled reminders
// Called every 5 minutes by Vercel Cron or external cron service
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    let sent = 0

    // Get due reminders
    const { data: dueReminders, error } = await getSupabase()
      .from('whatsapp_reminders')
      .select(`
        *,
        connection:whatsapp_connections(
          id,
          user_id,
          phone_number,
          phone_verified,
          is_active,
          timezone
        )
      `)
      .eq('enabled', true)
      .lte('next_scheduled_at', now.toISOString())

    if (error) {
      console.error('[Cron] Error fetching reminders:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`[Cron] Found ${dueReminders?.length || 0} due reminders`)

    for (const reminder of dueReminders || []) {
      const connection = reminder.connection

      // Skip if connection is not verified or active
      if (!connection?.phone_verified || !connection?.is_active) {
        continue
      }

      // Generate reminder message based on type
      const message = await generateReminderMessage(reminder.reminder_type, connection.user_id)

      if (message) {
        // Send the message
        const result = await sendWhatsAppMessage(connection.phone_number, message)

        if (result.success) {
          sent++

          // Log the message
          await getSupabase().from('whatsapp_messages').insert({
            connection_id: connection.id,
            direction: 'outbound',
            message_type: 'reminder',
            content: message,
            metadata: {
              reminder_type: reminder.reminder_type,
              twilio_sid: result.sid
            }
          })
        }
      }

      // Update next scheduled time
      const nextScheduled = calculateNextSchedule(reminder)
      await getSupabase()
        .from('whatsapp_reminders')
        .update({
          last_sent_at: now.toISOString(),
          next_scheduled_at: nextScheduled
        })
        .eq('id', reminder.id)
    }

    return NextResponse.json({
      success: true,
      sent,
      checked: dueReminders?.length || 0
    })
  } catch (error) {
    console.error('[Cron] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'WhatsApp reminder cron endpoint',
    usage: 'POST with Bearer token to trigger reminders'
  })
}

// Generate reminder message based on type
async function generateReminderMessage(
  reminderType: string,
  userId: string
): Promise<string | null> {
  switch (reminderType) {
    case 'morning_checkin':
      return await generateMorningMessage(userId)
    case 'night_reflection':
      return await generateNightMessage(userId)
    case 'weekly_review':
      return await generateWeeklyMessage(userId)
    default:
      return null
  }
}

async function generateMorningMessage(userId: string): Promise<string> {
  // Get streak
  const streak = await getStreak(userId)

  // Check if yesterday's intention was set
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data: yesterdayEntry } = await getSupabase()
    .from('journal_entries')
    .select('daily_intention')
    .eq('user_id', userId)
    .eq('entry_date', yesterdayStr)
    .single()

  let message = '🌅 *Buenos días!*\n\n'

  if (yesterdayEntry?.daily_intention) {
    message += `Tu intención de ayer fue:\n"${yesterdayEntry.daily_intention}"\n\n`
    message += '¿Cómo te fue? Responde:\n'
    message += '1️⃣ Lo logré\n'
    message += '2️⃣ Avancé parcialmente\n'
    message += '3️⃣ No pude\n\n'
  }

  message += `🔥 Racha: ${streak} días\n\n`
  message += 'Escribe /journal para empezar tu día ☀️'

  return message
}

async function generateNightMessage(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  // Check if today's journal is complete
  const { data: todayEntry } = await getSupabase()
    .from('journal_entries')
    .select('best_moments, lesson_learned, mood')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .single()

  const hasNightJournal = todayEntry?.best_moments?.some((m: string) => m) && todayEntry?.lesson_learned

  if (hasNightJournal) {
    return '🌙 *Tu journal de hoy está completo!*\n\n' +
           '¡Buen trabajo! Descansa bien 😴'
  }

  return '🌙 *Hora de reflexionar*\n\n' +
         '¿Cuál fue el mejor momento de hoy?\n' +
         '¿Qué aprendiste?\n\n' +
         'Escribe /journal para completar tu día'
}

async function generateWeeklyMessage(userId: string): Promise<string> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  // Get this week's stats
  const { data: entries } = await getSupabase()
    .from('journal_entries')
    .select('mood, entry_date')
    .eq('user_id', userId)
    .gte('entry_date', weekAgoStr)

  const journalDays = entries?.length || 0
  const avgMood = entries?.length
    ? entries.reduce((sum, e) => sum + (e.mood || 0), 0) / entries.length
    : 0

  const streak = await getStreak(userId)

  return '📊 *Resumen Semanal*\n\n' +
         `Esta semana:\n` +
         `✅ ${journalDays}/7 días de journal\n` +
         `😊 Mood promedio: ${avgMood.toFixed(1)}/5\n` +
         `🔥 Racha: ${streak} días\n\n` +
         '¿Listo para tu check-in semanal?\n' +
         'Escribe /journal para reflexionar sobre tu semana'
}

// Helper: Get user's streak
async function getStreak(userId: string): Promise<number> {
  let streak = 0
  const checkDate = new Date()

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0]
    const { data } = await getSupabase()
      .from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('entry_date', dateStr)
      .not('mood', 'is', null)
      .single()

    if (!data) break
    streak++
    checkDate.setDate(checkDate.getDate() - 1)

    if (streak > 365) break
  }

  return streak
}

// Calculate next scheduled time for a reminder
function calculateNextSchedule(reminder: {
  reminder_type: string
  time_of_day: string | null
  day_of_week: number | null
}): string {
  const now = new Date()
  const next = new Date(now)

  if (reminder.time_of_day) {
    const [hours, minutes] = reminder.time_of_day.split(':').map(Number)

    if (reminder.day_of_week !== null && reminder.day_of_week !== undefined) {
      // Weekly reminder
      const currentDay = now.getDay()
      let daysUntil = reminder.day_of_week - currentDay
      if (daysUntil <= 0) daysUntil += 7

      next.setDate(now.getDate() + daysUntil)
      next.setHours(hours, minutes, 0, 0)
    } else {
      // Daily reminder
      next.setHours(hours, minutes, 0, 0)
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
    }
  } else {
    // Default: tomorrow same time
    next.setDate(next.getDate() + 1)
  }

  return next.toISOString()
}
