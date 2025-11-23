import { getSupabase } from './client'
import type { WhatsAppConnection, WhatsAppConversation, WhatsAppReminder } from './types'

// Get or create a WhatsApp connection by phone number
export async function getOrCreateConnection(phoneNumber: string): Promise<WhatsAppConnection> {
  const supabase = getSupabase()

  // First try to get existing connection
  const { data: existing } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (existing) {
    // Update last_message_at
    await supabase
      .from('whatsapp_connections')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', existing.id)

    return existing as WhatsAppConnection
  }

  // Create new connection (without user_id - will be linked during verification)
  const { data: newConnection, error } = await supabase
    .from('whatsapp_connections')
    .insert({
      phone_number: phoneNumber,
      last_message_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating connection:', error)
    throw error
  }

  return newConnection as WhatsAppConnection
}

// Log a message
export async function logMessage(
  connectionId: string,
  direction: 'inbound' | 'outbound',
  content: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('whatsapp_messages')
    .insert({
      connection_id: connectionId,
      direction,
      message_type: 'text',
      content,
      metadata
    })

  if (error) {
    console.error('Error logging message:', error)
  }
}

// Get active conversation for a connection
export async function getActiveConversation(connectionId: string): Promise<WhatsAppConversation | null> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('connection_id', connectionId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data as WhatsAppConversation | null
}

// Start a new conversation flow
export async function startConversationFlow(
  connectionId: string,
  flowName: string,
  initialData: Record<string, unknown> = {}
): Promise<WhatsAppConversation> {
  const supabase = getSupabase()

  // Delete any existing conversations
  await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('connection_id', connectionId)

  // Create new conversation
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      connection_id: connectionId,
      current_flow: flowName,
      flow_step: 0,
      flow_data: initialData,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    })
    .select()
    .single()

  if (error) {
    console.error('Error starting conversation:', error)
    throw error
  }

  return data as WhatsAppConversation
}

// Update conversation flow
export async function updateConversation(
  conversationId: string,
  updates: {
    flow_step?: number
    flow_data?: Record<string, unknown>
    current_flow?: string | null
  }
): Promise<void> {
  const supabase = getSupabase()

  await supabase
    .from('whatsapp_conversations')
    .update({
      ...updates,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // Reset expiration
    })
    .eq('id', conversationId)
}

// End conversation
export async function endConversation(conversationId: string): Promise<void> {
  const supabase = getSupabase()

  await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('id', conversationId)
}

// Create default reminders for a new connection
export async function createDefaultReminders(connectionId: string): Promise<void> {
  const supabase = getSupabase()

  const defaultReminders: Partial<WhatsAppReminder>[] = [
    {
      connection_id: connectionId,
      reminder_type: 'morning_checkin',
      enabled: true,
      time_of_day: '07:00:00',
      next_scheduled_at: getNextReminderTime('07:00')
    },
    {
      connection_id: connectionId,
      reminder_type: 'night_reflection',
      enabled: true,
      time_of_day: '21:00:00',
      next_scheduled_at: getNextReminderTime('21:00')
    },
    {
      connection_id: connectionId,
      reminder_type: 'weekly_review',
      enabled: true,
      day_of_week: 0, // Sunday
      time_of_day: '20:00:00',
      next_scheduled_at: getNextWeeklyReminderTime(0, '20:00')
    }
  ]

  await supabase
    .from('whatsapp_reminders')
    .insert(defaultReminders)
}

// Helper: Calculate next reminder time for daily reminders
function getNextReminderTime(timeOfDay: string): string {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const now = new Date()
  const next = new Date(now)

  next.setHours(hours, minutes, 0, 0)

  // If time has passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }

  return next.toISOString()
}

// Helper: Calculate next reminder time for weekly reminders
function getNextWeeklyReminderTime(dayOfWeek: number, timeOfDay: string): string {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const now = new Date()
  const next = new Date(now)

  // Find next occurrence of dayOfWeek
  const currentDay = now.getDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0) daysUntil += 7
  if (daysUntil === 0) {
    // Check if time has passed
    const todayTime = new Date(now)
    todayTime.setHours(hours, minutes, 0, 0)
    if (todayTime <= now) {
      daysUntil = 7
    }
  }

  next.setDate(now.getDate() + daysUntil)
  next.setHours(hours, minutes, 0, 0)

  return next.toISOString()
}

// Get connection by user ID
export async function getConnectionByUserId(userId: string): Promise<WhatsAppConnection | null> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('user_id', userId)
    .single()

  return data as WhatsAppConnection | null
}

// Get reminders for a connection
export async function getReminders(connectionId: string): Promise<WhatsAppReminder[]> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('whatsapp_reminders')
    .select('*')
    .eq('connection_id', connectionId)
    .order('reminder_type')

  return (data || []) as WhatsAppReminder[]
}
