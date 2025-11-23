import { NextRequest, NextResponse } from 'next/server'
import {
  sendWhatsAppMessage,
  normalizePhone,
  getOrCreateConnection,
  logMessage,
  getActiveConversation,
  updateConversation,
  endConversation,
  handleCommand
} from '@/lib/whatsapp'
import { flows, getFlowStepByIndex } from '@/lib/whatsapp/flows'
import type { WhatsAppConnection, WhatsAppConversation, CommandResponse } from '@/lib/whatsapp/types'

// Handle incoming WhatsApp messages from Twilio
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const from = formData.get('From') as string // whatsapp:+56912345678
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    if (!from || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Normalize phone number
    const phoneNumber = normalizePhone(from)

    console.log(`[WhatsApp] Received from ${phoneNumber}: ${body}`)

    // Get or create connection
    const connection = await getOrCreateConnection(phoneNumber)

    // Log inbound message
    await logMessage(connection.id, 'inbound', body, { twilio_sid: messageSid })

    // Process message and get response
    const response = await processMessage(connection, body)

    // Send response
    if (response.text) {
      const sendResult = await sendWhatsAppMessage(phoneNumber, response.text)

      // Log outbound message
      await logMessage(connection.id, 'outbound', response.text, {
        twilio_sid: sendResult.sid
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

// Process incoming message
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
      text: '👋 ¡Hola! Para usar BrainFlow Bot, primero vincula tu cuenta:\n\n' +
            '1. Abre BrainFlow en tu navegador\n' +
            '2. Ve a Configuración > Integraciones\n' +
            '3. Conecta WhatsApp con tu número\n\n' +
            'Recibirás un código de 6 dígitos para verificar.'
    }
  }

  // Check for commands first
  if (text.startsWith('/')) {
    return handleCommand(connection, text)
  }

  // Check for active conversation flow
  const activeConvo = await getActiveConversation(connection.id)
  if (activeConvo) {
    return handleConversationFlow(connection, activeConvo, message)
  }

  // Check for quick mood response (1-5)
  if (/^[1-5]$/.test(text)) {
    return handleCommand(connection, `/mood ${text}`)
  }

  // Default: treat as free thought if account is linked
  if (connection.user_id) {
    return handleCommand(connection, `/nota ${text}`)
  }

  return {
    text: 'No entendí tu mensaje. Escribe /ayuda para ver los comandos disponibles.'
  }
}

// Handle conversation flow
async function handleConversationFlow(
  connection: WhatsAppConnection,
  conversation: WhatsAppConversation,
  input: string
): Promise<CommandResponse> {
  const flowName = conversation.current_flow
  if (!flowName || !flows[flowName]) {
    await endConversation(conversation.id)
    return { text: 'Conversación terminada. Escribe /ayuda para ver los comandos.' }
  }

  const flow = flows[flowName]
  const currentStep = getFlowStepByIndex(flowName, conversation.flow_step)

  if (!currentStep) {
    await endConversation(conversation.id)
    return { text: 'Conversación terminada. Escribe /ayuda para ver los comandos.' }
  }

  try {
    const result = await currentStep.handler(connection, input, conversation.flow_data)

    if (result.complete) {
      await endConversation(conversation.id)
      return { text: result.message || '✅ Completado!' }
    }

    if (result.repeat) {
      return { text: result.message || (typeof currentStep.prompt === 'string' ? currentStep.prompt : 'Por favor intenta de nuevo.') }
    }

    if (result.pause) {
      return { text: result.message || 'Pausado.' }
    }

    if (result.next) {
      // Find next step index
      const nextStepIndex = flow.steps.findIndex(s => s.id === result.next)
      if (nextStepIndex === -1) {
        await endConversation(conversation.id)
        return { text: result.message || '✅ Completado!' }
      }

      // Update conversation to next step
      await updateConversation(conversation.id, {
        flow_step: nextStepIndex,
        flow_data: result.data || conversation.flow_data
      })

      const nextStep = flow.steps[nextStepIndex]
      const nextPrompt = typeof nextStep.prompt === 'function'
        ? await nextStep.prompt(connection, result.data || conversation.flow_data)
        : nextStep.prompt

      // If there's a message from the handler, include it before the next prompt
      if (result.message) {
        return { text: `${result.message}\n\n${nextPrompt}` }
      }

      return { text: nextPrompt }
    }

    return { text: 'Error en el flujo. Escribe /ayuda para ver los comandos.' }
  } catch (error) {
    console.error('[WhatsApp] Flow error:', error)
    await endConversation(conversation.id)
    return { text: 'Ocurrió un error. Por favor intenta de nuevo con /journal' }
  }
}

// Handle verification code
async function handleVerificationCode(
  connection: WhatsAppConnection,
  code: string
): Promise<CommandResponse> {
  // This will be handled by the verify endpoint from the web app
  // For now, just acknowledge the code
  return {
    text: `Código recibido: ${code}\n\n` +
          'Si vinculaste tu cuenta desde BrainFlow, tu conexión debería estar activa.\n\n' +
          'Si aún no funciona, intenta volver a conectar desde la app.'
  }
}

// Verify endpoint for Twilio webhook validation
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'WhatsApp webhook is active' })
}
