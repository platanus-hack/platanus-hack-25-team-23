import OpenAI from 'openai'
import { getSupabase } from './client'
import type { WhatsAppConnection } from './types'

// Lazy-load OpenAI client
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    })
  }
  return _openai
}

// Conversation message type
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Get conversation history from database
async function getConversationHistory(
  phoneNumber: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  const { data } = await getSupabase()
    .from('whatsapp_messages')
    .select('role, content')
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  // Reverse to get chronological order
  return data.reverse().map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  }))
}

// Save message to conversation history
async function saveMessage(
  phoneNumber: string,
  role: 'user' | 'assistant',
  content: string,
  userId?: string
) {
  await getSupabase()
    .from('whatsapp_messages')
    .insert({
      phone_number: phoneNumber,
      user_id: userId,
      role,
      content,
      created_at: new Date().toISOString()
    })
}

// Get user context (journal entries, notes, mood history)
async function getUserContext(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get recent journal entries
  const { data: journals } = await getSupabase()
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', weekAgo)
    .order('entry_date', { ascending: false })
    .limit(5)

  // Get today's entry specifically
  const todayEntry = journals?.find(j => j.entry_date === today)

  // Get recent notes
  const { data: notes } = await getSupabase()
    .from('notes')
    .select('title, status, area')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get streak
  let streak = 0
  const checkDate = new Date()
  while (streak < 365) {
    const dateStr = checkDate.toISOString().split('T')[0]
    const hasEntry = journals?.some(j => j.entry_date === dateStr && j.mood)
    if (!hasEntry) break
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Build context string
  let context = `## Contexto del Usuario\n\n`
  context += `**Fecha:** ${today}\n`
  context += `**Racha actual:** ${streak} dias\n\n`

  if (todayEntry) {
    context += `### Journal de Hoy\n`
    if (todayEntry.gratitude?.length) {
      context += `- Gratitud: ${todayEntry.gratitude.join(', ')}\n`
    }
    if (todayEntry.daily_intention) {
      context += `- Intencion: ${todayEntry.daily_intention}\n`
    }
    if (todayEntry.what_would_make_great_day?.length) {
      context += `- Gran dia: ${todayEntry.what_would_make_great_day.join(', ')}\n`
    }
    if (todayEntry.best_moments?.length) {
      context += `- Mejores momentos: ${todayEntry.best_moments.join(', ')}\n`
    }
    if (todayEntry.lesson_learned) {
      context += `- Leccion: ${todayEntry.lesson_learned}\n`
    }
    if (todayEntry.mood) {
      const moodEmoji = ['', '😢', '😕', '😐', '🙂', '😄'][todayEntry.mood]
      context += `- Mood: ${moodEmoji} (${todayEntry.mood}/5)\n`
    }
    context += '\n'
  } else {
    context += `### Journal de Hoy: No completado aun\n\n`
  }

  // Recent mood trend
  if (journals?.length) {
    const moods = journals.filter(j => j.mood).map(j => j.mood)
    if (moods.length > 0) {
      const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length
      context += `### Tendencia de Mood (7 dias)\n`
      context += `- Promedio: ${avgMood.toFixed(1)}/5\n`
      context += `- Registros: ${moods.length} dias\n\n`
    }
  }

  // Study notes
  if (notes?.length) {
    context += `### Notas de Estudio Recientes\n`
    notes.forEach(n => {
      const statusEmoji = n.status === 'understood' ? '✅' : n.status === 'read' ? '📖' : '🆕'
      context += `- ${statusEmoji} ${n.title} (${n.area || 'General'})\n`
    })
  }

  return context
}

// Main system prompt for BrainFlow WhatsApp bot
const SYSTEM_PROMPT = `Eres BrainFlow, un asistente de bienestar personal por WhatsApp.
Tu personalidad es calida, empática y motivadora - como un amigo que genuinamente se preocupa.

## Tu Rol Principal
Guiar al usuario a completar su journal diario de forma conversacional y natural.

## Estilo de Comunicacion
- Conversacional y natural, NO como un chatbot rigido
- Usa emojis con moderacion para dar calidez
- Respuestas CORTAS (maximo 2-3 oraciones)
- Haz UNA pregunta a la vez
- Celebra cada respuesta antes de pasar a la siguiente

## FLUJO DE MORNING JOURNAL (Guiado paso a paso)
Cuando el usuario inicia el journal de mañana, sigue este flujo EXACTO:

**Paso 1 - Gratitud:**
Pregunta: "¿Por qué 3 cosas estás agradecido/a hoy? 🙏"
Espera respuesta, celebra, luego continua.

**Paso 2 - Intención:**
Pregunta: "¿Cuál es tu intención o enfoque principal para hoy? 🎯"
Espera respuesta, celebra, luego continua.

**Paso 3 - Gran día:**
Pregunta: "¿Qué 3 cosas harían que hoy sea un gran día? ✨"
Espera respuesta.

**Al completar los 3 pasos:** Llama la función save_morning_journal con TODOS los datos recolectados.

## FLUJO DE NIGHT JOURNAL (Guiado paso a paso)
Cuando el usuario inicia el journal nocturno, sigue este flujo EXACTO:

**Paso 1 - Mejores momentos:**
Pregunta: "¿Cuáles fueron los 3 mejores momentos de tu día? 💎"
Espera respuesta, celebra, luego continua.

**Paso 2 - Lección:**
Pregunta: "¿Qué aprendiste hoy? 📌"
Espera respuesta, celebra, luego continua.

**Paso 3 - Mood:**
Pregunta: "Del 1 al 5, ¿cómo te sientes?\n1😢 2😕 3😐 4🙂 5😄"
Espera respuesta.

**Al completar los 3 pasos:** Llama la función save_night_journal con TODOS los datos recolectados.

## Reglas Importantes
- SIEMPRE sigue el flujo paso a paso, no saltes pasos
- Si el usuario da respuestas cortas, acepta y continua
- Si el usuario da multiples items en una respuesta (separados por coma o lineas), parsealo correctamente
- Cuando llames save_morning_journal o save_night_journal, el mensaje de confirmacion DEBE decir que se guardará en su journal del día en la plataforma
- Si el usuario ya completó el journal de hoy (ver contexto), dile que ya está listo y ofrece otra cosa

Responde siempre en español.`

// Response type with optional actions
export interface AgentResponse {
  message: string
  action?: {
    type: 'save_journal_morning' | 'save_journal_night' | 'show_menu' | 'show_stats' | 'mark_understood'
    data?: Record<string, unknown>
  }
  buttons?: { id: string; title: string }[]
}

// Main agent function
export async function processWithAgent(
  connection: WhatsAppConnection,
  userMessage: string
): Promise<AgentResponse> {
  const openai = getOpenAI()

  // Save user message to history
  await saveMessage(connection.phone_number, 'user', userMessage, connection.user_id || undefined)

  // Get conversation history
  const history = await getConversationHistory(connection.phone_number, 15)

  // Get user context if we have a user_id
  let userContext = ''
  if (connection.user_id) {
    userContext = await getUserContext(connection.user_id)
  }

  // Build messages for OpenAI
  const messages: ConversationMessage[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT + (userContext ? `\n\n${userContext}` : '')
    },
    ...history,
    { role: 'user', content: userMessage }
  ]

  try {
    // Call OpenAI with function calling for structured actions
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 500,
      functions: [
        {
          name: 'save_morning_journal',
          description: 'Guardar entrada de journal matutino cuando el usuario ha completado gratitud, intencion y gran dia',
          parameters: {
            type: 'object',
            properties: {
              gratitude: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de cosas por las que esta agradecido'
              },
              daily_intention: {
                type: 'string',
                description: 'Intencion o enfoque del dia'
              },
              what_would_make_great_day: {
                type: 'array',
                items: { type: 'string' },
                description: 'Cosas que harian el dia genial'
              }
            },
            required: ['gratitude', 'daily_intention', 'what_would_make_great_day']
          }
        },
        {
          name: 'save_night_journal',
          description: 'Guardar entrada de journal nocturno cuando el usuario ha completado mejores momentos, leccion y mood',
          parameters: {
            type: 'object',
            properties: {
              best_moments: {
                type: 'array',
                items: { type: 'string' },
                description: 'Mejores momentos del dia'
              },
              lesson_learned: {
                type: 'string',
                description: 'Leccion aprendida hoy'
              },
              mood: {
                type: 'number',
                description: 'Estado de animo del 1 al 5'
              }
            },
            required: ['best_moments', 'lesson_learned', 'mood']
          }
        },
        {
          name: 'show_menu',
          description: 'Mostrar menu de opciones cuando el usuario pide ayuda o menu',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ],
      function_call: 'auto'
    })

    const choice = response.choices[0]
    let responseMessage = choice.message.content || ''
    let action: AgentResponse['action'] = undefined
    let buttons: AgentResponse['buttons'] = undefined

    // Handle function calls
    if (choice.message.function_call) {
      const funcName = choice.message.function_call.name
      const funcArgs = JSON.parse(choice.message.function_call.arguments || '{}')

      if (funcName === 'save_morning_journal') {
        action = { type: 'save_journal_morning', data: funcArgs }
        const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
        // Generate a confirmation message
        responseMessage = responseMessage || `✨ *¡Journal matutino completado!*\n\n` +
          `🙏 Gratitud: ${funcArgs.gratitude.length} cosas\n` +
          `🎯 Intención: "${funcArgs.daily_intention.slice(0, 40)}${funcArgs.daily_intention.length > 40 ? '...' : ''}"\n` +
          `✨ Gran día: ${funcArgs.what_would_make_great_day.length} cosas\n\n` +
          `📱 _Lo anoté en tu journal del ${today} en BrainFlow._\n\n` +
          `¡Que tengas un excelente día! 💪`
      } else if (funcName === 'save_night_journal') {
        action = { type: 'save_journal_night', data: funcArgs }
        const moodEmoji = ['', '😢', '😕', '😐', '🙂', '😄'][funcArgs.mood] || '😊'
        const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
        responseMessage = responseMessage || `🌙 *¡Reflexión nocturna completada!*\n\n` +
          `💎 Momentos: ${funcArgs.best_moments.length} guardados\n` +
          `📌 Lección: "${funcArgs.lesson_learned.slice(0, 40)}${funcArgs.lesson_learned.length > 40 ? '...' : ''}"\n` +
          `${moodEmoji} Mood: ${funcArgs.mood}/5\n\n` +
          `📱 _Lo anoté en tu journal del ${today} en BrainFlow._\n\n` +
          `Descansa bien, nos vemos mañana 🌟`
      } else if (funcName === 'show_menu') {
        action = { type: 'show_menu' }
        responseMessage = '¿En qué te puedo ayudar?'
        buttons = [
          { id: 'journal', title: '📝 Journal' },
          { id: 'stats', title: '📊 Estadísticas' },
          { id: 'study', title: '📚 Estudiar' }
        ]
      }
    }

    // Save assistant response to history
    await saveMessage(connection.phone_number, 'assistant', responseMessage, connection.user_id || undefined)

    return { message: responseMessage, action, buttons }
  } catch (error) {
    console.error('Error in agent processing:', error)
    return {
      message: 'Ups, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo? 🙏'
    }
  }
}

// Quick helper to detect if user wants menu
export function detectMenuIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return ['/menu', '/help', '/ayuda', 'menu', 'ayuda', 'opciones', 'que puedes hacer'].some(
    cmd => lower === cmd || lower.startsWith(cmd + ' ')
  )
}

// Quick helper to detect stats intent
export function detectStatsIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return ['/stats', '/estadisticas', 'estadisticas', 'mis stats', 'como voy'].some(
    cmd => lower === cmd || lower.includes(cmd)
  )
}
