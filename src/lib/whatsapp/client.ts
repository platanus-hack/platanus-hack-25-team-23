import twilio from 'twilio'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-loaded clients to avoid build-time errors when env vars aren't set
let _twilioClient: ReturnType<typeof twilio> | null = null
let _supabaseAdmin: SupabaseClient | null = null

// Get Twilio client (lazy-loaded)
function getTwilioClient() {
  if (!_twilioClient) {
    _twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  }
  return _twilioClient
}

// Get Supabase admin client (lazy-loaded)
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    }

    _supabaseAdmin = createClient(url, key)
  }
  return _supabaseAdmin
}

// Export getters instead of direct instances
export const twilioClient = { get: getTwilioClient }
export const supabaseAdmin = { get: getSupabaseAdmin }

// Helper to get supabase admin directly
export function getSupabase() {
  return getSupabaseAdmin()
}

// Send WhatsApp message via Twilio
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  _options?: { buttons?: string[] }
) {
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  try {
    const client = getTwilioClient()
    const message = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body,
    })

    return { success: true, sid: message.sid }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return { success: false, error }
  }
}

// Normalize phone number to E.164 format
export function normalizePhone(phone: string): string {
  // Remove whatsapp: prefix if present
  let cleaned = phone.replace('whatsapp:', '')

  // Remove all non-numeric characters except +
  cleaned = cleaned.replace(/[^\d+]/g, '')

  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // Assume Chilean number if no country code
    if (cleaned.startsWith('9') && cleaned.length === 9) {
      cleaned = '+56' + cleaned
    } else if (cleaned.startsWith('569')) {
      cleaned = '+' + cleaned
    } else {
      cleaned = '+' + cleaned
    }
  }

  return cleaned
}
