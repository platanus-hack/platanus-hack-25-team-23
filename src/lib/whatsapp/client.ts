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

// Quick Reply button interface
export interface QuickReplyButton {
  id: string
  title: string // Max 20 characters
}

// Send WhatsApp message via Twilio (supports text or quick reply buttons)
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  options?: { buttons?: QuickReplyButton[] }
) {
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  try {
    const client = getTwilioClient()

    // If buttons are provided, use Content API with quick replies
    if (options?.buttons && options.buttons.length > 0) {
      // Create or get Content SID for this button configuration
      const contentSid = await getOrCreateQuickReplyTemplate(body, options.buttons)

      if (contentSid) {
        const message = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          contentSid: contentSid,
        })
        return { success: true, sid: message.sid }
      }
    }

    // Fallback to plain text message
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

// Cache for content templates
const contentTemplateCache: Map<string, string> = new Map()

// Create a Content Template for Quick Replies (session-based, no approval needed)
async function getOrCreateQuickReplyTemplate(
  body: string,
  buttons: QuickReplyButton[]
): Promise<string | null> {
  const cacheKey = `${body}_${buttons.map(b => b.id).join('_')}`

  // Check cache first
  if (contentTemplateCache.has(cacheKey)) {
    return contentTemplateCache.get(cacheKey)!
  }

  try {
    const client = getTwilioClient()

    // Create a unique friendly name for this template
    const friendlyName = `brainflow_qr_${Date.now()}`

    // Create Content Template via Twilio Content API
    // Using 'as any' because Twilio types don't include twilio/quick-reply content type
    const content = await client.content.v1.contents.create({
      friendlyName,
      language: 'es',
      variables: {},
      types: {
        'twilio/quick-reply': {
          body: body,
          actions: buttons.slice(0, 3).map(btn => ({
            id: btn.id,
            title: btn.title.slice(0, 20) // Max 20 chars
          }))
        }
      }
    } as any)

    contentTemplateCache.set(cacheKey, content.sid)
    return content.sid
  } catch (error) {
    console.error('Error creating content template:', error)
    // Return null to fallback to plain text
    return null
  }
}

// Send message with menu buttons (convenience function)
export async function sendMenuMessage(
  to: string,
  greeting: string,
  menuOptions: { id: string; label: string }[]
) {
  const buttons: QuickReplyButton[] = menuOptions.slice(0, 3).map(opt => ({
    id: opt.id,
    title: opt.label.slice(0, 20)
  }))

  return sendWhatsAppMessage(to, greeting, { buttons })
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
