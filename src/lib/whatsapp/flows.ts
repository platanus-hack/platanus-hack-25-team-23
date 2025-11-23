import { getSupabase } from './client'
import type { WhatsAppConnection, ConversationFlow } from './types'

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Save morning journal
async function saveJournalMorning(userId: string, data: Record<string, unknown>) {
  const today = formatDate(new Date())

  const { data: existing } = await getSupabase()
    .from('journal_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .single()

  const journalData = {
    gratitude: data.gratitude || [],
    daily_intention: data.daily_intention || '',
    what_would_make_great_day: data.what_would_make_great_day || []
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
        user_id: userId,
        entry_date: today,
        entry_type: 'daily',
        ...journalData
      })
  }
}

// Save night journal
async function saveJournalNight(userId: string, data: Record<string, unknown>) {
  const today = formatDate(new Date())

  const { data: existing } = await getSupabase()
    .from('journal_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .single()

  const journalData = {
    best_moments: data.best_moments || [],
    lesson_learned: data.lesson_learned || '',
    mood: data.mood
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
        user_id: userId,
        entry_date: today,
        entry_type: 'daily',
        ...journalData
      })
  }
}

// Get streak
async function getStreak(userId: string): Promise<number> {
  let streak = 0
  const checkDate = new Date()

  while (true) {
    const dateStr = formatDate(checkDate)
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

// Mark note as understood
async function markNoteAsUnderstood(userId: string, noteId: string) {
  await getSupabase()
    .from('notes')
    .update({ status: 'understood' })
    .eq('id', noteId)
    .eq('user_id', userId)
}

// Conversation flows
export const flows: Record<string, ConversationFlow> = {
  journal_morning: {
    steps: [
      {
        id: 'gratitude',
        prompt: '📝 *Journal de Hoy*\n\n¿Por qué estás agradecido hoy?\n\n_Escribe 1-3 cosas (separadas por coma)_',
        handler: async (_connection, input, data) => {
          const items = input.split(',').map(s => s.trim()).slice(0, 3)
          data.gratitude = items
          return { next: 'intention', data }
        }
      },
      {
        id: 'intention',
        prompt: '🎯 *Intención del Día*\n\n¿Cuál es tu enfoque principal para hoy?',
        handler: async (_connection, input, data) => {
          data.daily_intention = input
          return { next: 'great_day', data }
        }
      },
      {
        id: 'great_day',
        prompt: '✨ *¿Qué haría hoy un gran día?*\n\n_Escribe 1-3 cosas (separadas por coma)_',
        handler: async (connection, input, data) => {
          const items = input.split(',').map(s => s.trim()).slice(0, 3)
          data.what_would_make_great_day = items

          // Save to journal
          if (connection.user_id) {
            await saveJournalMorning(connection.user_id, data)
          }

          return {
            complete: true,
            message: '✅ *Morning journal completado!*\n\n' +
                     `📝 Gratitud: ${(data.gratitude as string[]).length} items\n` +
                     `🎯 Intención: "${(data.daily_intention as string).slice(0, 30)}..."\n` +
                     `✨ Gran día: ${(data.what_would_make_great_day as string[]).length} items\n\n` +
                     'Te enviaré un recordatorio esta noche para reflexionar 🌙'
          }
        }
      }
    ]
  },

  journal_night: {
    steps: [
      {
        id: 'best_moment',
        prompt: '🌙 *Reflexión Nocturna*\n\n¿Cuál fue el mejor momento de hoy?',
        handler: async (_connection, input, data) => {
          data.best_moments = [input]
          return { next: 'lesson', data }
        }
      },
      {
        id: 'lesson',
        prompt: '💡 *Lección del Día*\n\n¿Qué aprendiste hoy?',
        handler: async (_connection, input, data) => {
          data.lesson_learned = input
          return { next: 'mood', data }
        }
      },
      {
        id: 'mood',
        prompt: '😊 *¿Cómo te sientes?*\n\n' +
                '1️⃣ Muy mal\n2️⃣ Mal\n3️⃣ Normal\n4️⃣ Bien\n5️⃣ Muy bien\n\n' +
                '_Responde con un número del 1 al 5_',
        handler: async (connection, input, data) => {
          const mood = parseInt(input)
          if (mood < 1 || mood > 5 || isNaN(mood)) {
            return { repeat: true, message: 'Por favor responde con un número del 1 al 5' }
          }

          data.mood = mood

          // Save to journal
          if (connection.user_id) {
            await saveJournalNight(connection.user_id, data)
          }

          const emoji = ['😢', '😕', '😐', '🙂', '😄'][mood - 1]
          const streak = connection.user_id ? await getStreak(connection.user_id) : 0

          return {
            complete: true,
            message: `✅ *Journal del día completado!*\n\n` +
                     `${emoji} Mood: ${mood}/5\n` +
                     `🌟 Mejor momento guardado\n` +
                     `💡 Lección guardada\n\n` +
                     `🔥 Racha: ${streak} días\n\n` +
                     '¡Descansa bien! Nos vemos mañana 🌙'
          }
        }
      }
    ]
  },

  study_select: {
    steps: [
      {
        id: 'select',
        prompt: async (_connection, data) => {
          const notes = data.notes as Array<{ title: string; area: string }>
          return '📚 *Sesión de Estudio*\n\n' +
                 '¿Qué quieres estudiar?\n\n' +
                 notes.map((n, i) => `${i + 1}️⃣ ${n.title} (${n.area})`).join('\n') +
                 '\n\n_Responde con el número_'
        },
        handler: async (_connection, input, data) => {
          const selection = parseInt(input)
          const notes = data.notes as Array<{ id: string; title: string; area: string }>

          if (isNaN(selection) || selection < 1 || selection > notes.length) {
            return { repeat: true, message: `Por favor responde con un número del 1 al ${notes.length}` }
          }

          const selectedNote = notes[selection - 1]
          data.selectedNote = selectedNote

          return {
            next: 'study',
            data,
            message: `📖 *Comenzando estudio*\n\n` +
                     `Tema: ${selectedNote.title}\n` +
                     `Área: ${selectedNote.area}\n\n` +
                     'Responde "listo" cuando termines o "pausar" si necesitas un break.'
          }
        }
      },
      {
        id: 'study',
        prompt: 'Estudiando... Responde "listo" cuando termines.',
        handler: async (_connection, input, data) => {
          const cmd = input.toLowerCase().trim()

          if (cmd === 'listo' || cmd === 'termine' || cmd === 'terminé' || cmd === 'termina') {
            return { next: 'rating', data }
          } else if (cmd === 'pausar' || cmd === 'pausa') {
            return {
              pause: true,
              message: '⏸️ Sesión pausada. Responde "continuar" cuando quieras seguir.'
            }
          } else if (cmd === 'continuar') {
            return { repeat: true, message: '▶️ Continuamos! Responde "listo" cuando termines.' }
          }

          return { repeat: true, message: 'Responde "listo" cuando termines o "pausar" si necesitas un break.' }
        }
      },
      {
        id: 'rating',
        prompt: '¿Cómo te fue?\n\n' +
                '1️⃣ Excelente, lo entendí todo\n' +
                '2️⃣ Bien, pero tengo dudas\n' +
                '3️⃣ Difícil, necesito repasar\n' +
                '4️⃣ No pude concentrarme\n\n' +
                '_Responde con un número del 1 al 4_',
        handler: async (connection, input, data) => {
          const rating = parseInt(input)
          const selectedNote = data.selectedNote as { id: string; title: string }

          if (isNaN(rating) || rating < 1 || rating > 4) {
            return { repeat: true, message: 'Por favor responde con un número del 1 al 4' }
          }

          if (rating === 1 && connection.user_id) {
            await markNoteAsUnderstood(connection.user_id, selectedNote.id)
            return {
              complete: true,
              message: '🎉 *Excelente!*\n\n' +
                       `"${selectedNote.title}" marcada como entendida ✓\n\n` +
                       '¿Quieres estudiar otra nota? Escribe /estudiar'
            }
          }

          const messages: Record<number, string> = {
            2: 'Guardé tu progreso. Puedes repasar cuando quieras.',
            3: 'No te preocupes, la repetición es clave. Intenta de nuevo mañana.',
            4: 'Está bien, todos tenemos esos días. Intenta en otro momento.'
          }

          return {
            complete: true,
            message: `📝 ${messages[rating]}\n\n` +
                     `La nota queda en progreso.`
          }
        }
      }
    ]
  }
}

// Get step by ID from a flow
export function getFlowStep(flowName: string, stepId: string) {
  const flow = flows[flowName]
  if (!flow) return null

  return flow.steps.find(s => s.id === stepId) || flow.steps[0]
}

// Get step by index from a flow
export function getFlowStepByIndex(flowName: string, index: number) {
  const flow = flows[flowName]
  if (!flow) return null

  return flow.steps[index]
}
