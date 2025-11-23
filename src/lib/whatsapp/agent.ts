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
  connectionId: string,
  currentMessage: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  try {
    const { data, error } = await getSupabase()
      .from('whatsapp_messages')
      .select('direction, content, metadata, created_at')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Agent] Error fetching history:', error)
      return []
    }

    if (!data || data.length === 0) return []

    // Filter out empty messages and the current message (to avoid duplication)
    // The webhook logs the message BEFORE calling the agent, so we need to exclude it
    let messages = data.filter(m => m.content && m.content.trim())

    // Remove the most recent inbound message if it matches currentMessage
    // (this prevents the AI from seeing the same message twice)
    if (messages.length > 0 &&
        messages[0].direction === 'inbound' &&
        messages[0].content?.trim() === currentMessage.trim()) {
      messages = messages.slice(1)
    }

    // Reverse to get chronological order and map direction to role
    return messages.reverse().map(m => ({
      role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: m.content || ''
    }))
  } catch (err) {
    console.error('[Agent] Exception fetching history:', err)
    return []
  }
}

// NOTE: saveMessage function removed - webhook handles message logging via logMessage()
// to prevent duplicate messages in history

// Get user context (journal entries, notes, mood history)
async function getUserContext(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get recent journal entries
  const { data: journals } = await getSupabase()
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'daily')
    .gte('date', weekAgo)
    .order('date', { ascending: false })
    .limit(5)

  // Get today's entry specifically
  const todayEntry = journals?.find(j => j.date === today)

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
    const hasEntry = journals?.some(j => j.date === dateStr && j.mood)
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

// Extract journal data from conversation history (fallback when AI doesn't call function)
function extractJournalDataFromHistory(
  history: ConversationMessage[],
  currentMessage: string
): {
  type: 'morning' | 'night'
  gratitude?: string[]
  daily_intention?: string
  what_would_make_great_day?: string[]
  best_moments?: string[]
  lesson_learned?: string
  mood?: number
} | null {
  // Get assistant messages to check if ALL 3 questions were asked
  const assistantMessages = history.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase())
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content)

  // Check for MORNING journal - must have asked all 3 questions
  const askedGratitude = assistantMessages.some(m => m.includes('pregunta 1') && m.includes('gratitud'))
  const askedIntention = assistantMessages.some(m => m.includes('pregunta 2') && m.includes('intención'))
  const askedGreatDay = assistantMessages.some(m => m.includes('pregunta 3') && m.includes('gran día'))

  // Check for NIGHT journal - must have asked all 3 questions
  const askedMoments = assistantMessages.some(m => m.includes('pregunta 1') && m.includes('momentos'))
  const askedLesson = assistantMessages.some(m => m.includes('pregunta 2') && m.includes('lección'))
  const askedMood = assistantMessages.some(m => m.includes('pregunta 3') && m.includes('cómo te sientes'))

  const isMorningComplete = askedGratitude && askedIntention && askedGreatDay
  const isNightComplete = askedMoments && askedLesson && askedMood

  // Need at least 3 user responses after the questions started
  if (!isMorningComplete && !isNightComplete) {
    console.log('[Agent] Extraction failed: Not all 3 questions were asked')
    return null
  }

  // Count user messages AFTER journal started (after first question)
  const journalStartIndex = history.findIndex(m =>
    m.role === 'assistant' && m.content.toLowerCase().includes('pregunta 1')
  )

  if (journalStartIndex === -1) {
    console.log('[Agent] Extraction failed: Could not find journal start')
    return null
  }

  const messagesAfterStart = history.slice(journalStartIndex + 1)
  const userResponsesAfterStart = messagesAfterStart.filter(m => m.role === 'user').map(m => m.content)

  console.log(`[Agent] User responses after journal start: ${userResponsesAfterStart.length}`)

  // Need exactly 3 user responses (one for each question)
  if (userResponsesAfterStart.length < 3) {
    console.log('[Agent] Extraction failed: Not enough user responses (need 3)')
    return null
  }

  if (isMorningComplete) {
    // Take the last 3 user responses
    const responses = userResponsesAfterStart.slice(-3)
    return {
      type: 'morning',
      gratitude: parseListResponse(responses[0]),
      daily_intention: responses[1].trim(),
      what_would_make_great_day: parseListResponse(responses[2])
    }
  }

  if (isNightComplete) {
    const responses = userResponsesAfterStart.slice(-3)
    // Parse mood from the last response
    let mood = parseInt(responses[2].trim())
    if (isNaN(mood) || mood < 1 || mood > 5) {
      const moodLower = responses[2].toLowerCase()
      if (moodLower.includes('mal')) mood = 1
      else if (moodLower.includes('regular')) mood = 2
      else if (moodLower.includes('neutral')) mood = 3
      else if (moodLower.includes('bien')) mood = 4
      else if (moodLower.includes('genial') || moodLower.includes('excelente')) mood = 5
      else mood = 3
    }

    return {
      type: 'night',
      best_moments: parseListResponse(responses[0]),
      lesson_learned: responses[1].trim(),
      mood
    }
  }

  return null
}

// Parse a comma/newline separated response into array
function parseListResponse(text: string): string[] {
  if (!text) return []

  // Split by comma, "y", or newline
  const items = text
    .split(/[,\n]|(?:\s+y\s+)/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 200) // Filter empty and too long

  return items.length > 0 ? items : [text.trim()]
}

// Main system prompt for BrainFlow WhatsApp bot
const SYSTEM_PROMPT = `Eres BrainFlow, un asistente de bienestar personal por WhatsApp.

## IMPORTANTE: Tu objetivo es ayudar al usuario con journaling, notas y seguimiento de progreso.

## Estilo
- Respuestas CORTAS (1-2 oraciones)
- Emojis moderados
- Cálido pero ENFOCADO en la tarea

## Funciones Disponibles

### show_menu
OBLIGATORIO llamar cuando:
- Usuario saluda: "hola", "holaa", "hi", "hey", "buenos días", "buenas", "qué tal"
- Usuario pide ayuda: "menu", "ayuda", "opciones", "help"
- NO hay conversación activa de journal

IMPORTANTE: Si el usuario solo dice "hola" o similar, SIEMPRE llama show_menu.

### get_user_stats
Usa cuando pide estadísticas, progreso, racha o "cómo voy".

### get_study_notes
Usa cuando quiere estudiar o ver notas.

### save_quick_note
Usa cuando el usuario quiere guardar una nota o pensamiento rápido.
- Detecta si dice "/nota", "guardar nota", "anotar", "recordar que..."
- content: string (el contenido de la nota)
- Extrae el contenido de lo que quiere guardar

### get_goals_progress
Usa cuando el usuario pregunta por sus metas, objetivos o "/metas".

### start_weekly_checkin
Usa cuando es domingo o el usuario pide "check-in semanal" o "resumen de la semana".

### save_morning_journal
OBLIGATORIO llamar esta función cuando tengas los 3 campos del historial de conversación:
- gratitude: array de strings (extraer de cuando preguntaste gratitud)
- daily_intention: string (extraer de cuando preguntaste intención)
- what_would_make_great_day: array de strings (extraer de la última respuesta del usuario)

IMPORTANTE: Cuando el usuario responde la pregunta 3 (gran día), DEBES llamar save_morning_journal inmediatamente con los datos de TODA la conversación. NO respondas con texto, solo llama la función.

### save_night_journal
OBLIGATORIO llamar esta función cuando tengas los 3 campos:
- best_moments: array de strings (extraer de cuando preguntaste momentos)
- lesson_learned: string (extraer de cuando preguntaste lección)
- mood: número 1-5 (extraer de la última respuesta)

IMPORTANTE: Cuando el usuario responde la pregunta 3 (mood), DEBES llamar save_night_journal inmediatamente.

## FLUJO MORNING JOURNAL - SIGUE EXACTAMENTE ESTOS PASOS:

**Cuando el usuario dice "journal" o "quiero hacer mi journal":**

PASO 1: Pregunta GRATITUD
"🌅 *Journal de la Mañana*

*Pregunta 1 de 3: Gratitud* 🙏
¿Por qué 3 cosas estás agradecido/a hoy?"

PASO 2: Después de recibir gratitud, pregunta INTENCIÓN
"¡Gracias por compartir! ✨

*Pregunta 2 de 3: Intención* 🎯
¿Cuál es tu intención o enfoque principal para hoy?"

PASO 3: Después de recibir intención, pregunta GRAN DÍA
"¡Excelente intención! 💪

*Pregunta 3 de 3: Gran Día* ✨
¿Qué 3 cosas harían que hoy sea un gran día?"

PASO 4: Después de recibir gran día, LLAMA save_morning_journal con todos los datos.

## FLUJO NIGHT JOURNAL - SIGUE EXACTAMENTE ESTOS PASOS:

PASO 1: Pregunta MEJORES MOMENTOS
"🌙 *Reflexión Nocturna*

*Pregunta 1 de 3: Mejores Momentos* 💎
¿Cuáles fueron los 3 mejores momentos de tu día?"

PASO 2: Después de recibir momentos, pregunta LECCIÓN
"¡Qué buenos momentos! 🌟

*Pregunta 2 de 3: Lección* 📌
¿Qué aprendiste hoy?"

PASO 3: Después de recibir lección, pregunta MOOD
"¡Gracias por reflexionar! 💭

*Pregunta 3 de 3: ¿Cómo te sientes?*
Elige del 1 al 5:
1️⃣ Mal  2️⃣ Regular  3️⃣ Neutral  4️⃣ Bien  5️⃣ Genial"

PASO 4: Después de recibir mood, LLAMA save_night_journal con todos los datos.

## REGLAS CRÍTICAS - MUY IMPORTANTE
- SIGUE EL FLUJO PASO A PASO - no saltes preguntas
- Parsea respuestas: "café, familia, salud" = ["café", "familia", "salud"]
- Si dice "estoy agradecido por ganar" = ["ganar la hackathon"] (1 item está bien)

## REGLA MÁS IMPORTANTE - GUARDAR DATOS:
- NUNCA respondas "voy a guardar" o "guardando" sin llamar la función
- Cuando tengas los 3 datos, DEBES hacer function_call, NO responder con texto
- Si el usuario da el dato final (pregunta 3), INMEDIATAMENTE llama la función

## EJEMPLO MORNING JOURNAL:
Historial:
- Assistant: "Pregunta 1 de 3: Gratitud"
- User: "mi familia, el trabajo, la salud"
- Assistant: "Pregunta 2 de 3: Intención"
- User: "terminar el proyecto"
- Assistant: "Pregunta 3 de 3: Gran Día"
- User: "ganar"

→ DEBES llamar save_morning_journal({
  gratitude: ["mi familia", "el trabajo", "la salud"],
  daily_intention: "terminar el proyecto",
  what_would_make_great_day: ["ganar"]
})

## EJEMPLO NIGHT JOURNAL:
Historial:
- Assistant: "Pregunta 1 de 3: Mejores Momentos"
- User: "el almuerzo con amigos, terminar un proyecto"
- Assistant: "Pregunta 2 de 3: Lección"
- User: "que la perseverancia vale la pena"
- Assistant: "Pregunta 3 de 3: Mood (1-5)"
- User: "5"

→ DEBES llamar save_night_journal({
  best_moments: ["el almuerzo con amigos", "terminar un proyecto"],
  lesson_learned: "que la perseverancia vale la pena",
  mood: 5
})

Responde siempre en español.`

// Response type with optional actions
export interface AgentResponse {
  message: string
  action?: {
    type: 'save_journal_morning' | 'save_journal_night' | 'show_menu' | 'show_stats' | 'show_study_notes' | 'mark_understood' | 'save_quick_note' | 'show_goals' | 'start_weekly_checkin' | 'save_weekly_checkin'
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

  // NOTE: Don't save user message here - webhook already logs it via logMessage()
  // This prevents duplicate messages in history

  // Get conversation history using connection.id
  // Pass currentMessage to exclude it from history (webhook logs it before calling agent)
  const history = await getConversationHistory(connection.id, userMessage, 20)

  console.log(`[Agent] Processing: "${userMessage.substring(0, 50)}..."`)
  console.log(`[Agent] History loaded: ${history.length} messages`)
  if (history.length > 0) {
    console.log(`[Agent] Last 3 messages:`, history.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 40)}...`))
  }

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
          name: 'show_menu',
          description: 'Mostrar menu con botones cuando el usuario saluda (hola, hi, buenos dias, etc.) o pide ayuda/opciones/menu',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_user_stats',
          description: 'Obtener estadisticas del usuario cuando pide ver su progreso, racha, stats, o como va',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_study_notes',
          description: 'Obtener notas de estudio cuando el usuario quiere estudiar, repasar, o ver sus notas',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'save_morning_journal',
          description: 'Guardar journal matutino SOLO cuando el usuario ya proporciono: gratitud (al menos 1 item), intencion del dia, y que haria el dia genial (al menos 1 item). NO llamar si falta alguno.',
          parameters: {
            type: 'object',
            properties: {
              gratitude: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de cosas por las que esta agradecido (extraer de la conversacion)'
              },
              daily_intention: {
                type: 'string',
                description: 'Intencion o enfoque del dia (extraer de la conversacion)'
              },
              what_would_make_great_day: {
                type: 'array',
                items: { type: 'string' },
                description: 'Cosas que harian el dia genial (extraer de la conversacion)'
              }
            },
            required: ['gratitude', 'daily_intention', 'what_would_make_great_day']
          }
        },
        {
          name: 'save_night_journal',
          description: 'Guardar journal nocturno SOLO cuando el usuario ya proporciono: mejores momentos (al menos 1), leccion aprendida, y mood (1-5). NO llamar si falta alguno.',
          parameters: {
            type: 'object',
            properties: {
              best_moments: {
                type: 'array',
                items: { type: 'string' },
                description: 'Mejores momentos del dia (extraer de la conversacion)'
              },
              lesson_learned: {
                type: 'string',
                description: 'Leccion aprendida hoy (extraer de la conversacion)'
              },
              mood: {
                type: 'number',
                description: 'Estado de animo del 1 al 5 (extraer de la conversacion)'
              }
            },
            required: ['best_moments', 'lesson_learned', 'mood']
          }
        },
        {
          name: 'save_quick_note',
          description: 'Guardar una nota o pensamiento rapido. Usa cuando el usuario dice /nota, "guardar nota", "anotar", "recordar que..."',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'El contenido de la nota a guardar'
              },
              title: {
                type: 'string',
                description: 'Titulo corto para la nota (opcional, generar si no se proporciona)'
              }
            },
            required: ['content']
          }
        },
        {
          name: 'get_goals_progress',
          description: 'Obtener progreso de metas del usuario. Usa cuando pregunta por metas, objetivos, /metas',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'start_weekly_checkin',
          description: 'Iniciar check-in semanal. Usa los domingos o cuando el usuario pide resumen semanal',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'save_weekly_checkin',
          description: 'Guardar check-in semanal cuando el usuario complete las 3 preguntas: rating (1-10), highlight, y mejora',
          parameters: {
            type: 'object',
            properties: {
              rating: {
                type: 'number',
                description: 'Calificacion de la semana del 1 al 10'
              },
              highlight: {
                type: 'string',
                description: 'El mejor momento o highlight de la semana'
              },
              to_improve: {
                type: 'string',
                description: 'Que mejorar para la proxima semana'
              }
            },
            required: ['rating', 'highlight', 'to_improve']
          }
        }
      ],
      function_call: 'auto'
    })

    const choice = response.choices[0]
    let responseMessage = choice.message.content || ''
    let action: AgentResponse['action'] = undefined
    let buttons: AgentResponse['buttons'] = undefined

    // Log what the AI returned
    console.log(`[Agent] AI response - has function_call: ${!!choice.message.function_call}`)
    if (choice.message.function_call) {
      console.log(`[Agent] Function called: ${choice.message.function_call.name}`)
      console.log(`[Agent] Function args: ${choice.message.function_call.arguments}`)
    } else {
      console.log(`[Agent] Text response: ${responseMessage.substring(0, 100)}...`)

      // FALLBACK: If AI says "guardar" but didn't call function, try to extract data from history
      if (responseMessage.toLowerCase().includes('guardar') || responseMessage.toLowerCase().includes('guardando')) {
        console.log(`[Agent] AI mentioned saving but didn't call function - attempting extraction`)

        // Check if we have journal data in history
        const journalData = extractJournalDataFromHistory(history, userMessage)
        if (journalData) {
          console.log(`[Agent] Extracted journal data:`, JSON.stringify(journalData, null, 2))

          if (journalData.type === 'morning' && journalData.gratitude && journalData.daily_intention && journalData.what_would_make_great_day) {
            return {
              message: `✨ *¡Journal matutino completado!*\n\n` +
                `🙏 Gratitud: ${journalData.gratitude.length} cosas\n` +
                `🎯 Intención: "${journalData.daily_intention.slice(0, 40)}..."\n` +
                `✨ Gran día: ${journalData.what_would_make_great_day.length} cosas\n\n` +
                `📱 Ver en BrainFlow:\nhttps://brain-flow-hack-platanus.vercel.app/journal\n\n` +
                `¡Que tengas un excelente día! 💪`,
              action: { type: 'save_journal_morning', data: journalData },
              buttons: [
                { id: 'stats', title: '📊 Estadísticas' },
                { id: 'study', title: '📚 Estudiar' }
              ]
            }
          } else if (journalData.type === 'night' && journalData.best_moments && journalData.lesson_learned && journalData.mood) {
            const moodEmoji = ['', '😢', '😕', '😐', '🙂', '😄'][journalData.mood] || '😊'
            return {
              message: `🌙 *¡Reflexión nocturna completada!*\n\n` +
                `💎 Momentos: ${journalData.best_moments.length} guardados\n` +
                `📌 Lección: "${journalData.lesson_learned.slice(0, 40)}..."\n` +
                `${moodEmoji} Mood: ${journalData.mood}/5\n\n` +
                `📱 Ver en BrainFlow:\nhttps://brain-flow-hack-platanus.vercel.app/journal\n\n` +
                `Descansa bien 🌟`,
              action: { type: 'save_journal_night', data: journalData },
              buttons: [
                { id: 'stats', title: '📊 Estadísticas' },
                { id: 'journal', title: '📝 Journal' }
              ]
            }
          }
        }
      }
    }

    // Handle function calls
    if (choice.message.function_call) {
      const funcName = choice.message.function_call.name
      const funcArgs = JSON.parse(choice.message.function_call.arguments || '{}')

      if (funcName === 'save_morning_journal') {
        action = { type: 'save_journal_morning', data: funcArgs }
        const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
        // Generate a confirmation message with link and menu buttons
        responseMessage = `✨ *¡Journal matutino completado!*\n\n` +
          `🙏 Gratitud: ${funcArgs.gratitude.length} cosas\n` +
          `🎯 Intención: "${funcArgs.daily_intention.slice(0, 40)}${funcArgs.daily_intention.length > 40 ? '...' : ''}"\n` +
          `✨ Gran día: ${funcArgs.what_would_make_great_day.length} cosas\n\n` +
          `📱 Ver en BrainFlow:\n` +
          `https://brain-flow-hack-platanus.vercel.app/journal\n\n` +
          `¡Que tengas un excelente día! 💪\n\n` +
          `¿Qué más te gustaría hacer?`
        // Add menu buttons after completing journal
        buttons = [
          { id: 'stats', title: '📊 Estadísticas' },
          { id: 'study', title: '📚 Estudiar' },
          { id: 'journal', title: '📝 Otro Journal' }
        ]
      } else if (funcName === 'save_night_journal') {
        action = { type: 'save_journal_night', data: funcArgs }
        const moodEmoji = ['', '😢', '😕', '😐', '🙂', '😄'][funcArgs.mood] || '😊'
        const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
        responseMessage = `🌙 *¡Reflexión nocturna completada!*\n\n` +
          `💎 Momentos: ${funcArgs.best_moments.length} guardados\n` +
          `📌 Lección: "${funcArgs.lesson_learned.slice(0, 40)}${funcArgs.lesson_learned.length > 40 ? '...' : ''}"\n` +
          `${moodEmoji} Mood: ${funcArgs.mood}/5\n\n` +
          `📱 Ver en BrainFlow:\n` +
          `https://brain-flow-hack-platanus.vercel.app/journal\n\n` +
          `Descansa bien 🌟\n\n` +
          `¿Algo más antes de dormir?`
        // Add menu buttons after completing journal
        buttons = [
          { id: 'stats', title: '📊 Estadísticas' },
          { id: 'study', title: '📚 Estudiar' }
        ]
      } else if (funcName === 'show_menu') {
        action = { type: 'show_menu' }
        responseMessage = '¡Hola! 👋 Soy BrainFlow, tu asistente de bienestar.\n\n¿Qué te gustaría hacer?'
        buttons = [
          { id: 'journal', title: '📝 Journal' },
          { id: 'stats', title: '📊 Estadísticas' },
          { id: 'study', title: '📚 Estudiar' }
        ]
      } else if (funcName === 'get_user_stats') {
        action = { type: 'show_stats' }
        // Stats will be fetched and formatted by the webhook handler
        responseMessage = '__STATS__' // Placeholder - webhook will replace
      } else if (funcName === 'get_study_notes') {
        action = { type: 'show_study_notes' }
        // Notes will be fetched by the webhook handler
        responseMessage = '__STUDY__' // Placeholder - webhook will replace
      } else if (funcName === 'save_quick_note') {
        action = { type: 'save_quick_note', data: funcArgs }
        const title = funcArgs.title || 'Nota rápida'
        responseMessage = `💭 *Nota guardada*\n\n` +
          `📝 "${funcArgs.content.slice(0, 60)}${funcArgs.content.length > 60 ? '...' : ''}"\n\n` +
          `📱 Ver en BrainFlow:\n` +
          `https://brain-flow-hack-platanus.vercel.app/library\n\n` +
          `¿Algo más?`
        buttons = [
          { id: 'journal', title: '📝 Journal' },
          { id: 'stats', title: '📊 Estadísticas' }
        ]
      } else if (funcName === 'get_goals_progress') {
        action = { type: 'show_goals' }
        responseMessage = '__GOALS__' // Placeholder - webhook will replace
      } else if (funcName === 'start_weekly_checkin') {
        action = { type: 'start_weekly_checkin' }
        responseMessage = `📊 *Check-in Semanal*\n\n` +
          `Vamos a revisar cómo te fue esta semana.\n\n` +
          `*Pregunta 1 de 3:*\n` +
          `¿Cómo calificarías tu semana del 1 al 10?`
      } else if (funcName === 'save_weekly_checkin') {
        action = { type: 'save_weekly_checkin', data: funcArgs }
        responseMessage = `✅ *Check-in semanal guardado!*\n\n` +
          `📊 Calificación: ${funcArgs.rating}/10\n` +
          `⭐ Highlight: "${funcArgs.highlight.slice(0, 40)}..."\n` +
          `📈 A mejorar: "${funcArgs.to_improve.slice(0, 40)}..."\n\n` +
          `¡Que tengas una excelente semana! 💪`
        buttons = [
          { id: 'journal', title: '📝 Journal' },
          { id: 'stats', title: '📊 Estadísticas' }
        ]
      }
    }

    // NOTE: Don't save assistant response here - webhook already logs it via logMessage()
    // This prevents duplicate messages in history

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
