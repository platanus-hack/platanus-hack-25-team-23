export interface WhatsAppConnection {
  id: string
  user_id: string | null
  phone_number: string
  phone_verified: boolean
  verification_code: string | null
  verification_expires_at: string | null
  timezone: string
  language: string
  is_active: boolean
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppReminder {
  id: string
  connection_id: string
  reminder_type: string
  enabled: boolean
  time_of_day: string | null
  day_of_week: number | null
  day_of_month: number | null
  minutes_before: number | null
  last_sent_at: string | null
  next_scheduled_at: string | null
  created_at: string
}

export interface WhatsAppConversation {
  id: string
  connection_id: string
  current_flow: string | null
  flow_step: number
  flow_data: Record<string, unknown>
  started_at: string
  expires_at: string
  created_at: string
}

export interface WhatsAppMessage {
  id: string
  connection_id: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string | null
  metadata: Record<string, unknown>
  twilio_sid: string | null
  status: string | null
  created_at: string
}

export interface CommandResponse {
  text: string
  buttons?: string[]
}

export type CommandHandler = (
  connection: WhatsAppConnection,
  args: string[]
) => Promise<CommandResponse>

export interface ConversationFlowStep {
  id: string
  prompt: string | ((connection: WhatsAppConnection, data: Record<string, unknown>) => Promise<string>)
  handler: (
    connection: WhatsAppConnection,
    input: string,
    data: Record<string, unknown>
  ) => Promise<{
    next?: string
    data?: Record<string, unknown>
    complete?: boolean
    message?: string
    repeat?: boolean
    pause?: boolean
  }>
}

export interface ConversationFlow {
  steps: ConversationFlowStep[]
}
