import { getSupabase } from './client'
import { startConversationFlow } from './database'
import type { WhatsAppConnection, CommandHandler, CommandResponse } from './types'

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Get journal entry for a specific date
async function getJournalEntry(userId: string, date: string) {
  const { data } = await getSupabase()
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .single()

  return data
}

// Get user stats
async function getUserStats(userId: string) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)

  // Get journal entries from last 7 days
  const { data: journalEntries } = await getSupabase()
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', formatDate(weekStart))

  // Get notes
  const { data: notes } = await getSupabase()
    .from('notes')
    .select('*')
    .eq('user_id', userId)

  // Calculate streak
  let streak = 0
  const checkDate = new Date()
  while (true) {
    const dateStr = formatDate(checkDate)
    const hasEntry = journalEntries?.some(e => e.entry_date === dateStr && e.mood)
    if (!hasEntry) break
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Calculate area progress (simplified)
  const { data: areas } = await getSupabase()
    .from('areas')
    .select('*')
    .eq('user_id', userId)

  const areaProgress = (areas || []).map(area => ({
    name: area.name,
    icon: area.icon || '📌',
    percent: Math.round(Math.random() * 100) // TODO: Calculate real progress
  }))

  return {
    streak,
    journalCompleted: journalEntries?.length || 0,
    journalTotal: 7,
    notesUnderstood: notes?.filter((n: { status: string }) => n.status === 'understood').length || 0,
    notesTotal: notes?.length || 0,
    studyHours: 0, // TODO: Calculate from study sessions
    areaProgress
  }
}

// Update journal mood
async function updateJournalMood(userId: string, mood: number) {
  const today = formatDate(new Date())

  // Try to update existing entry
  const { data: existing } = await getSupabase()
    .from('journal_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .single()

  if (existing) {
    await getSupabase()
      .from('journal_entries')
      .update({ mood })
      .eq('id', existing.id)
  } else {
    await getSupabase()
      .from('journal_entries')
      .insert({
        user_id: userId,
        entry_date: today,
        mood
      })
  }
}

// Get pending notes for study
async function getPendingNotes(userId: string, limit: number = 3) {
  const { data } = await getSupabase()
    .from('notes')
    .select('id, title, area_id, areas(name)')
    .eq('user_id', userId)
    .in('status', ['new', 'read'])
    .limit(limit)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    area: n.areas?.name || 'Sin área'
  }))
}

// Append free thought to journal
async function appendFreeThought(userId: string, thought: string) {
  const today = formatDate(new Date())

  const { data: existing } = await getSupabase()
    .from('journal_entries')
    .select('id, free_thoughts')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .single()

  const currentThoughts = existing?.free_thoughts || ''
  const newThoughts = currentThoughts
    ? `${currentThoughts}\n\n[WhatsApp ${new Date().toLocaleTimeString()}] ${thought}`
    : `[WhatsApp ${new Date().toLocaleTimeString()}] ${thought}`

  if (existing) {
    await getSupabase()
      .from('journal_entries')
      .update({ free_thoughts: newThoughts })
      .eq('id', existing.id)
  } else {
    await getSupabase()
      .from('journal_entries')
      .insert({
        user_id: userId,
        entry_date: today,
        free_thoughts: newThoughts
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

    // Limit check to avoid infinite loop
    if (streak > 365) break
  }

  return streak
}

// Get yearly goals
async function getYearlyGoals(userId: string) {
  const currentYear = new Date().getFullYear()

  const { data } = await getSupabase()
    .from('journal_entries')
    .select('smart_goals')
    .eq('user_id', userId)
    .eq('entry_type', 'yearly')
    .gte('entry_date', `${currentYear}-01-01`)
    .single()

  if (!data?.smart_goals) return []

  return data.smart_goals.map((goal: { area?: string; goal?: string; progress?: number }) => ({
    area: goal.area || 'General',
    goal: goal.goal || '',
    progress: goal.progress || 0
  }))
}

// Helper function for progress bar
function progressBar(percent: number): string {
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

// Command handlers
export const commands: Record<string, CommandHandler> = {
  '/journal': async (connection) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const today = formatDate(new Date())
    const entry = await getJournalEntry(connection.user_id, today)

    const morningDone = entry?.gratitude?.some((g: string) => g) && entry?.daily_intention
    const nightDone = entry?.best_moments?.some((m: string) => m) && entry?.lesson_learned

    if (!morningDone) {
      await startConversationFlow(connection.id, 'journal_morning')
      return {
        text: '📝 *Journal de Hoy*\n\n' +
              '¿Por qué estás agradecido hoy?\n\n' +
              '_Escribe 1-3 cosas (separadas por coma)_'
      }
    } else if (!nightDone) {
      await startConversationFlow(connection.id, 'journal_night')
      return {
        text: '🌙 *Reflexión Nocturna*\n\n' +
              '¿Cuál fue el mejor momento de hoy?'
      }
    } else {
      return {
        text: '✅ *Tu journal de hoy está completo!*\n\n' +
              `😊 Mood: ${entry.mood}/5\n` +
              `✓ Gratitud: ${entry.gratitude?.filter((g: string) => g).length || 0} items\n` +
              `✓ Intención: ${(entry.daily_intention || '').slice(0, 30)}...\n` +
              `✓ Mejor momento registrado\n` +
              `✓ Lección aprendida\n\n` +
              '¿Quieres agregar un pensamiento libre?\n' +
              '_Escribe /nota seguido de tu pensamiento_'
      }
    }
  },

  '/stats': async (connection) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const stats = await getUserStats(connection.user_id)

    return {
      text: '📊 *Tus Estadísticas*\n\n' +
            `🔥 Racha actual: ${stats.streak} días\n` +
            `📝 Journal completados: ${stats.journalCompleted}/${stats.journalTotal}\n` +
            `📚 Notas estudiadas: ${stats.notesUnderstood}/${stats.notesTotal}\n` +
            `⏱️ Tiempo de estudio: ${stats.studyHours}h esta semana\n\n` +
            '*Progreso por Área:*\n' +
            stats.areaProgress.map(a =>
              `${a.icon} ${a.name}: ${a.percent}%`
            ).join('\n')
    }
  },

  '/mood': async (connection, args) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const mood = parseInt(args[0])

    if (!mood || mood < 1 || mood > 5) {
      return {
        text: '😊 *Registrar Mood*\n\n' +
              '¿Cómo te sientes? (1-5)\n\n' +
              '1️⃣ Muy mal\n' +
              '2️⃣ Mal\n' +
              '3️⃣ Normal\n' +
              '4️⃣ Bien\n' +
              '5️⃣ Muy bien\n\n' +
              '_Responde con /mood [número] ej: /mood 4_'
      }
    }

    await updateJournalMood(connection.user_id, mood)
    const emoji = ['😢', '😕', '😐', '🙂', '😄'][mood - 1]

    return {
      text: `${emoji} Mood registrado: ${mood}/5\n\n` +
            '¿Algo que quieras agregar sobre cómo te sientes?\n' +
            '_Escribe /nota seguido de tu pensamiento_'
    }
  },

  '/estudiar': async (connection) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const pendingNotes = await getPendingNotes(connection.user_id, 3)

    if (pendingNotes.length === 0) {
      return {
        text: '🎉 *No tienes notas pendientes!*\n\n' +
              '¿Quieres explorar nuevos temas?\n' +
              'Abre BrainFlow para agregar contenido.'
      }
    }

    await startConversationFlow(connection.id, 'study_select', { notes: pendingNotes })

    return {
      text: '📚 *Sesión de Estudio*\n\n' +
            '¿Qué quieres estudiar?\n\n' +
            pendingNotes.map((n, i) =>
              `${i + 1}️⃣ ${n.title} (${n.area})`
            ).join('\n') +
            '\n\n_Responde con el número_'
    }
  },

  '/nota': async (connection, args) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const thought = args.join(' ')

    if (!thought) {
      return {
        text: '💭 *Agregar Nota Rápida*\n\n' +
              'Escribe /nota seguido de tu pensamiento\n\n' +
              'Ejemplo:\n' +
              '_/nota Hoy descubrí que me concentro mejor en las mañanas_'
      }
    }

    await appendFreeThought(connection.user_id, thought)

    return {
      text: '💭 *Pensamiento guardado*\n\n' +
            `"${thought.slice(0, 100)}${thought.length > 100 ? '...' : ''}"\n\n` +
            'Agregado a tu journal de hoy ✓'
    }
  },

  '/racha': async (connection) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const streak = await getStreak(connection.user_id)
    const flames = '🔥'.repeat(Math.min(streak, 10))

    return {
      text: `${flames || '🔥'}\n\n` +
            `*Racha actual: ${streak} días*\n\n` +
            (streak >= 7 ? '¡Increíble! Una semana completa 🎉' :
             streak >= 3 ? '¡Vas muy bien! Sigue así 💪' :
             '¡Cada día cuenta! No rompas la racha')
    }
  },

  '/metas': async (connection) => {
    if (!connection.user_id) {
      return { text: '⚠️ Tu cuenta no está vinculada. Abre BrainFlow y conecta WhatsApp primero.' }
    }

    const goals = await getYearlyGoals(connection.user_id)

    if (!goals.length) {
      return {
        text: '🎯 *Metas del Año*\n\n' +
              'No tienes metas configuradas.\n\n' +
              'Abre tu Journal Anual en BrainFlow para definir tus metas SMART.'
      }
    }

    return {
      text: '🎯 *Progreso de Metas*\n\n' +
            goals.map((g: { area: string; goal: string; progress: number }) => {
              const bar = progressBar(g.progress)
              return `*${g.area}*\n${g.goal}\n${bar} ${g.progress}%`
            }).join('\n\n')
    }
  },

  '/ayuda': async () => {
    return {
      text: '❓ *Comandos Disponibles*\n\n' +
            '📝 /journal - Journal del día\n' +
            '📊 /stats - Ver estadísticas\n' +
            '😊 /mood [1-5] - Registrar mood\n' +
            '📚 /estudiar - Iniciar estudio\n' +
            '💭 /nota [texto] - Nota rápida\n' +
            '🔥 /racha - Ver racha\n' +
            '🎯 /metas - Progreso metas\n' +
            '❓ /ayuda - Este mensaje\n\n' +
            '_También puedes escribir libremente y lo guardaré en tu journal_'
    }
  }
}

// Process a command
export async function handleCommand(
  connection: WhatsAppConnection,
  message: string
): Promise<CommandResponse> {
  const parts = message.trim().split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)

  const handler = commands[command]

  if (!handler) {
    return {
      text: `Comando no reconocido: ${command}\n\nEscribe /ayuda para ver los comandos disponibles.`
    }
  }

  return handler(connection, args)
}
