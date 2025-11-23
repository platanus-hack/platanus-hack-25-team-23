import { NextRequest, NextResponse } from 'next/server'
import {
  sendWhatsAppMessage,
  normalizePhone,
  getOrCreateConnection,
  logMessage,
  sendMenuMessage
} from '@/lib/whatsapp'
import { processWithAgent, detectMenuIntent, detectStatsIntent } from '@/lib/whatsapp/agent'
import { getSupabase } from '@/lib/whatsapp/client'
import type { WhatsAppConnection, CommandResponse } from '@/lib/whatsapp/types'

// Handle incoming WhatsApp messages from Twilio
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const from = formData.get('From') as string // whatsapp:+56912345678
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    // Quick reply button payload (when user taps a button)
    const buttonPayload = formData.get('ButtonPayload') as string | null
    const buttonText = formData.get('ButtonText') as string | null

    if (!from || (!body && !buttonPayload)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Normalize phone number
    const phoneNumber = normalizePhone(from)

    // Use button payload if available, otherwise use body
    const userMessage = buttonPayload || buttonText || body

    console.log(`[WhatsApp] Received from ${phoneNumber}: ${userMessage}`)
    if (buttonPayload) {
      console.log(`[WhatsApp] Button payload: ${buttonPayload}`)
    }

    // Get or create connection
    const connection = await getOrCreateConnection(phoneNumber)

    // Log inbound message
    await logMessage(connection.id, 'inbound', userMessage, {
      twilio_sid: messageSid,
      button_payload: buttonPayload
    })

    // Process message and get response
    const response = await processMessage(connection, userMessage)

    // Send response with optional buttons
    if (response.text) {
      let sendResult

      if (response.buttons && response.buttons.length > 0) {
        // Send message with quick reply buttons
        sendResult = await sendMenuMessage(
          phoneNumber,
          response.text,
          response.buttons.map(b => ({ id: b.id, label: b.title }))
        )
      } else {
        // Send plain text message
        sendResult = await sendWhatsAppMessage(phoneNumber, response.text)
      }

      // Log outbound message
      await logMessage(connection.id, 'outbound', response.text, {
        twilio_sid: sendResult.sid,
        buttons: response.buttons
      })
    }

    // Return TwiML empty response (Twilio expects this)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  } catch (error) {
    console.error('[WhatsApp] Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Process incoming message with AI agent
async function processMessage(
  connection: WhatsAppConnection,
  message: string
): Promise<CommandResponse> {
  const text = message.trim()

  // Check if user is linked to an account
  if (!connection.user_id && !text.toLowerCase().startsWith('/verificar')) {
    // Check if this might be a verification code (6 digits)
    if (/^\d{6}$/.test(text)) {
      return await handleVerificationCode(connection, text)
    }

    return {
      text: '👋 ¡Hola! Soy BrainFlow, tu asistente de bienestar personal.\n\n' +
            'Para comenzar, vincula tu cuenta:\n\n' +
            '1. Abre BrainFlow en tu navegador\n' +
            '2. Ve a Perfil > Integraciones\n' +
            '3. Conecta WhatsApp con tu número\n\n' +
            'Te enviaremos un código de 6 dígitos para verificar. 🔐'
    }
  }

  // Handle button responses (quick actions)
  if (text === 'journal') {
    return await startJournalFlow(connection)
  }

  if (text === 'stats') {
    return await handleStats(connection)
  }

  if (text === 'study') {
    return await handleStudy(connection)
  }

  // Check for greeting - show menu with buttons
  const isGreeting = /^(hola|hi|hey|buenos?\s*(días?|tardes?|noches?)|qué\s*tal|saludos?|buenas?)$/i.test(text)
  if (isGreeting) {
    return {
      text: '¡Hola! 👋 Soy BrainFlow, tu asistente de bienestar.\n\n¿Qué te gustaría hacer hoy?',
      buttons: [
        { id: 'journal', title: '📝 Journal' },
        { id: 'stats', title: '📊 Estadísticas' },
        { id: 'study', title: '📚 Estudiar' }
      ]
    }
  }

  // Check for menu/help intent
  if (detectMenuIntent(text)) {
    return {
      text: '¿En qué te puedo ayudar? 💫',
      buttons: [
        { id: 'journal', title: '📝 Journal' },
        { id: 'stats', title: '📊 Estadísticas' },
        { id: 'study', title: '📚 Estudiar' }
      ]
    }
  }

  // Check for stats intent
  if (detectStatsIntent(text)) {
    return await handleStats(connection)
  }

  // Process with AI agent for natural conversation
  const agentResponse = await processWithAgent(connection, text)

  // Handle actions from agent
  if (agentResponse.action) {
    await handleAgentAction(connection, agentResponse.action)
  }

  return {
    text: agentResponse.message,
    buttons: agentResponse.buttons?.map(b => ({ id: b.id, title: b.title }))
  }
}

// Handle agent actions (save journal, etc.)
async function handleAgentAction(
  connection: WhatsAppConnection,
  action: { type: string; data?: Record<string, unknown> }
) {
  if (!connection.user_id) return

  const today = new Date().toISOString().split('T')[0]

  try {
    if (action.type === 'save_journal_morning' && action.data) {
      // Check for existing entry
      const { data: existing } = await getSupabase()
        .from('journal_entries')
        .select('id')
        .eq('user_id', connection.user_id)
        .eq('entry_date', today)
        .single()

      const journalData = {
        gratitude: action.data.gratitude || [],
        daily_intention: action.data.daily_intention || '',
        what_would_make_great_day: action.data.what_would_make_great_day || []
      }

      if (existing) {
        await getSupabase()
          .from('journal_entries')
          .update(journalData)
          .eq('id', existing.id)
      } else {
        await getSupabase()
          .from('journal_entries')
          .insert({
            user_id: connection.user_id,
            entry_date: today,
            entry_type: 'daily',
            ...journalData
          })
      }
    }

    if (action.type === 'save_journal_night' && action.data) {
      const { data: existing } = await getSupabase()
        .from('journal_entries')
        .select('id')
        .eq('user_id', connection.user_id)
        .eq('entry_date', today)
        .single()

      const journalData = {
        best_moments: action.data.best_moments || [],
        lesson_learned: action.data.lesson_learned || '',
        mood: action.data.mood
      }

      if (existing) {
        await getSupabase()
          .from('journal_entries')
          .update(journalData)
          .eq('id', existing.id)
      } else {
        await getSupabase()
          .from('journal_entries')
          .insert({
            user_id: connection.user_id,
            entry_date: today,
            entry_type: 'daily',
            ...journalData
          })
      }
    }
  } catch (error) {
    console.error('[WhatsApp] Error handling agent action:', error)
  }
}

// Handle verification code
async function handleVerificationCode(
  connection: WhatsAppConnection,
  code: string
): Promise<CommandResponse> {
  return {
    text: `Código recibido: ${code}\n\n` +
          'Si vinculaste tu cuenta desde BrainFlow, tu conexión debería activarse automáticamente.\n\n' +
          'Si aún no funciona, intenta volver a conectar desde la app. 🔄'
  }
}

// Handle stats command
async function handleStats(connection: WhatsAppConnection): Promise<CommandResponse> {
  if (!connection.user_id) {
    return { text: 'Vincula tu cuenta primero para ver tus estadísticas.' }
  }

  try {
    // Get streak
    let streak = 0
    const checkDate = new Date()
    while (streak < 365) {
      const dateStr = checkDate.toISOString().split('T')[0]
      const { data } = await getSupabase()
        .from('journal_entries')
        .select('id')
        .eq('user_id', connection.user_id)
        .eq('entry_date', dateStr)
        .not('mood', 'is', null)
        .single()

      if (!data) break
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Get week's mood average
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: entries } = await getSupabase()
      .from('journal_entries')
      .select('mood')
      .eq('user_id', connection.user_id)
      .gte('entry_date', weekAgo)
      .not('mood', 'is', null)

    const moods = entries?.map(e => e.mood).filter(Boolean) || []
    const avgMood = moods.length > 0
      ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)
      : 'N/A'

    // Get notes count
    const { count: notesCount } = await getSupabase()
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', connection.user_id)

    const { count: understoodCount } = await getSupabase()
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', connection.user_id)
      .eq('status', 'understood')

    return {
      text: `📊 *Tus Estadísticas*\n\n` +
            `🔥 Racha: ${streak} días\n` +
            `😊 Mood promedio (7 días): ${avgMood}/5\n` +
            `📚 Notas: ${notesCount || 0}\n` +
            `✅ Dominadas: ${understoodCount || 0}\n\n` +
            `¡Sigue así! 💪`
    }
  } catch (error) {
    console.error('[WhatsApp] Error getting stats:', error)
    return { text: 'Error al obtener estadísticas. Intenta de nuevo.' }
  }
}

// Start journal flow - determine morning or night based on time
async function startJournalFlow(connection: WhatsAppConnection): Promise<CommandResponse> {
  if (!connection.user_id) {
    return { text: 'Vincula tu cuenta primero para hacer tu journal.' }
  }

  const hour = new Date().getHours()
  const isMorning = hour >= 5 && hour < 14

  if (isMorning) {
    return {
      text: '🌅 *Journal de la Mañana*\n\n' +
            'Empecemos con gratitud...\n\n' +
            '¿Por qué 3 cosas estás agradecido/a hoy? 🙏\n\n' +
            '_Pueden ser cosas pequeñas: el café, un buen descanso, tu familia..._'
    }
  } else {
    return {
      text: '🌙 *Reflexión Nocturna*\n\n' +
            'Vamos a cerrar el día con una reflexión...\n\n' +
            '¿Cuál fue el mejor momento de tu día hoy? ✨'
    }
  }
}

// Handle study command
async function handleStudy(connection: WhatsAppConnection): Promise<CommandResponse> {
  if (!connection.user_id) {
    return { text: 'Vincula tu cuenta primero para estudiar.' }
  }

  try {
    // Get notes to study (not understood yet)
    const { data: notes } = await getSupabase()
      .from('notes')
      .select('id, title, area')
      .eq('user_id', connection.user_id)
      .neq('status', 'understood')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!notes || notes.length === 0) {
      return {
        text: '🎉 ¡Felicidades! Has dominado todas tus notas.\n\n' +
              'Crea nuevas notas en la app para seguir aprendiendo.'
      }
    }

    return {
      text: '📚 *Notas para repasar:*\n\n' +
            notes.map((n, i) => `${i + 1}. ${n.title}`).join('\n') +
            '\n\n¿Cuál quieres estudiar? Dime el número o el nombre.'
    }
  } catch (error) {
    console.error('[WhatsApp] Error getting study notes:', error)
    return { text: 'Error al obtener notas. Intenta de nuevo.' }
  }
}

// Verify endpoint for Twilio webhook validation
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'WhatsApp webhook is active (AI mode)' })
}
