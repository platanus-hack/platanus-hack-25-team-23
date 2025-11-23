import { NextRequest, NextResponse } from 'next/server'
import {
  sendWhatsAppMessage,
  normalizePhone,
  getOrCreateConnection,
  logMessage,
  sendMenuMessage
} from '@/lib/whatsapp'
import { processWithAgent } from '@/lib/whatsapp/agent'
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
  if (!connection.user_id) {
    // Check if this might be a verification code (6 digits)
    if (/^\d{6}$/.test(text)) {
      return {
        text: `Código recibido: ${text}\n\n` +
              'Si vinculaste tu cuenta desde BrainFlow, tu conexión debería activarse automáticamente.\n\n' +
              'Si aún no funciona, intenta volver a conectar desde la app. 🔄'
      }
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

  // ALL messages go through AI agent for natural conversation
  // The agent will detect intents (journal, stats, study, greeting) and respond appropriately

  // Inject context about button presses to help AI understand
  let messageForAgent = text
  if (text === 'journal') {
    messageForAgent = 'Quiero hacer mi journal del día'
  } else if (text === 'stats') {
    messageForAgent = 'Quiero ver mis estadísticas'
  } else if (text === 'study') {
    messageForAgent = 'Quiero estudiar mis notas'
  }

  // Process everything with AI agent
  const agentResponse = await processWithAgent(connection, messageForAgent)

  // Handle actions from agent
  if (agentResponse.action) {
    // Handle data-saving actions
    if (agentResponse.action.type === 'save_journal_morning' || agentResponse.action.type === 'save_journal_night') {
      await handleAgentAction(connection, agentResponse.action)
    }

    // Handle stats request - fetch and format stats
    if (agentResponse.action.type === 'show_stats' && connection.user_id) {
      const statsResponse = await getFormattedStats(connection.user_id)
      return { text: statsResponse }
    }

    // Handle study notes request
    if (agentResponse.action.type === 'show_study_notes' && connection.user_id) {
      const studyResponse = await getFormattedStudyNotes(connection.user_id)
      return { text: studyResponse }
    }
  }

  return {
    text: agentResponse.message,
    buttons: agentResponse.buttons?.map(b => ({ id: b.id, title: b.title }))
  }
}

// Get formatted stats for user
async function getFormattedStats(userId: string): Promise<string> {
  try {
    // Get streak
    let streak = 0
    const checkDate = new Date()
    while (streak < 365) {
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
    }

    // Get week's mood average
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: entries } = await getSupabase()
      .from('journal_entries')
      .select('mood')
      .eq('user_id', userId)
      .gte('entry_date', weekAgo)
      .not('mood', 'is', null)

    const moods = entries?.map(e => e.mood).filter(Boolean) || []
    const avgMood = moods.length > 0
      ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)
      : 'N/A'

    const moodEmoji = moods.length > 0
      ? ['', '😢', '😕', '😐', '🙂', '😄'][Math.round(parseFloat(avgMood))]
      : '📊'

    // Get notes count
    const { count: notesCount } = await getSupabase()
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: understoodCount } = await getSupabase()
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'understood')

    return `📊 *Tus Estadísticas*\n\n` +
           `🔥 Racha: ${streak} días consecutivos\n` +
           `${moodEmoji} Mood promedio (7 días): ${avgMood}/5\n` +
           `📚 Total de notas: ${notesCount || 0}\n` +
           `✅ Notas dominadas: ${understoodCount || 0}\n\n` +
           `¡Sigue así! 💪`
  } catch (error) {
    console.error('[WhatsApp] Error getting stats:', error)
    return 'No pude obtener tus estadísticas. ¿Intentamos de nuevo?'
  }
}

// Get formatted study notes for user
async function getFormattedStudyNotes(userId: string): Promise<string> {
  try {
    // Get notes to study (not understood yet)
    const { data: notes } = await getSupabase()
      .from('notes')
      .select('id, title, area, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!notes || notes.length === 0) {
      return '📚 No tienes notas de estudio aún.\n\n' +
             'Crea notas en la app BrainFlow y aparecerán aquí para repasar.'
    }

    const pendingNotes = notes.filter(n => n.status !== 'understood')
    const masteredNotes = notes.filter(n => n.status === 'understood')

    let response = '📚 *Tus Notas de Estudio*\n\n'

    if (pendingNotes.length > 0) {
      response += '*Para repasar:*\n'
      pendingNotes.forEach((n, i) => {
        response += `${i + 1}. ${n.title}${n.area ? ` (${n.area})` : ''}\n`
      })
      response += '\n'
    }

    if (masteredNotes.length > 0) {
      response += `*Dominadas:* ${masteredNotes.length} notas ✅\n\n`
    }

    if (pendingNotes.length > 0) {
      response += '_¿Cuál quieres repasar? Dime el nombre o número._'
    } else {
      response += '🎉 ¡Has dominado todas tus notas!'
    }

    return response
  } catch (error) {
    console.error('[WhatsApp] Error getting study notes:', error)
    return 'No pude obtener tus notas. ¿Intentamos de nuevo?'
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
        make_great: action.data.what_would_make_great_day || []  // Field name in DB is make_great
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
        lesson: action.data.lesson_learned || '',  // Field name in DB is lesson
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

// Verify endpoint for Twilio webhook validation
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'WhatsApp webhook is active (AI mode)' })
}
