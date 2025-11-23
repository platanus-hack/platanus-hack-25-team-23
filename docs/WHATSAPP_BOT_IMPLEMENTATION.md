# WhatsApp Bot Implementation Plan

## Objetivo
Crear un bot de WhatsApp que sea el **punto de contacto principal** fuera de la app, permitiendo a los usuarios mantener sus hábitos de journaling y estudio sin fricción.

---

## Stack Técnico

### Opción A: Twilio (Recomendado para MVP)
```
Pros:
✅ API bien documentada
✅ WhatsApp Business API oficial
✅ Webhooks confiables
✅ Pay-as-you-go pricing
✅ Templates pre-aprobados

Cons:
❌ Costo por mensaje (~$0.005-0.05)
❌ Requiere WhatsApp Business verification

Pricing estimado:
- 1000 usuarios activos
- 5 msgs/día promedio
- ~$750/mes
```

### Opción B: Meta Cloud API (Directo)
```
Pros:
✅ Sin intermediario
✅ 1000 conversaciones gratis/mes
✅ Más control

Cons:
❌ Setup más complejo
❌ Verificación de negocio requerida
```

### Decisión: Twilio para MVP
Más rápido de implementar, mejor documentación, fácil migración después.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      WHATSAPP FLOW                          │
└─────────────────────────────────────────────────────────────┘

User Phone                    Twilio                    BrainFlow
    │                           │                           │
    │──── Mensaje ─────────────>│                           │
    │                           │──── Webhook POST ────────>│
    │                           │                           │
    │                           │                    ┌──────┴──────┐
    │                           │                    │  Process    │
    │                           │                    │  Message    │
    │                           │                    └──────┬──────┘
    │                           │                           │
    │                           │<──── Response ────────────│
    │<──── Reply ──────────────│                           │
    │                           │                           │


┌─────────────────────────────────────────────────────────────┐
│                    INTERNAL ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │   /api/whatsapp     │
                    │     webhook         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Message Router    │
                    │                     │
                    │ • Command Detection │
                    │ • Intent Analysis   │
                    │ • Context Loading   │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │  Command    │    │  Reminder   │    │  Convo      │
    │  Handler    │    │  Handler    │    │  Handler    │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                   │                   │
           └───────────────────┴───────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Response Builder  │
                    │                     │
                    │ • Format Message    │
                    │ • Add Buttons       │
                    │ • Queue Send        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Twilio Client     │
                    │   (Send Message)    │
                    └─────────────────────┘
```

---

## Database Schema

```sql
-- =============================================
-- WHATSAPP CONNECTIONS
-- =============================================
CREATE TABLE whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  phone_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(6),
  verification_expires_at TIMESTAMP,

  -- Preferences
  timezone VARCHAR(50) DEFAULT 'America/Santiago',
  language VARCHAR(10) DEFAULT 'es',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- REMINDER SETTINGS
-- =============================================
CREATE TABLE whatsapp_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  reminder_type VARCHAR(50) NOT NULL,
  -- Types: 'morning_checkin', 'night_reflection', 'weekly_review',
  --        'monthly_review', 'study_block', 'area_neglect'

  enabled BOOLEAN DEFAULT true,

  -- Schedule
  time_of_day TIME, -- For daily reminders
  day_of_week INTEGER, -- 0-6 for weekly (0=Sunday)
  day_of_month INTEGER, -- 1-31 for monthly
  minutes_before INTEGER, -- For study blocks (e.g., 15 min before)

  -- Tracking
  last_sent_at TIMESTAMP,
  next_scheduled_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(connection_id, reminder_type)
);

-- =============================================
-- CONVERSATION CONTEXT
-- =============================================
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  -- Current conversation state
  current_flow VARCHAR(50), -- 'journal_morning', 'journal_night', 'study_session', etc.
  flow_step INTEGER DEFAULT 0,
  flow_data JSONB DEFAULT '{}',

  -- Expiration (conversations timeout after inactivity)
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 minutes',

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- MESSAGE LOGS
-- =============================================
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE CASCADE,

  direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
  message_type VARCHAR(20) NOT NULL, -- 'text', 'button', 'template', 'quick_reply'

  content TEXT,
  metadata JSONB DEFAULT '{}',

  -- Twilio tracking
  twilio_sid VARCHAR(50),
  status VARCHAR(20), -- 'sent', 'delivered', 'read', 'failed'

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_whatsapp_connections_user ON whatsapp_connections(user_id);
CREATE INDEX idx_whatsapp_connections_phone ON whatsapp_connections(phone_number);
CREATE INDEX idx_whatsapp_reminders_next ON whatsapp_reminders(next_scheduled_at) WHERE enabled = true;
CREATE INDEX idx_whatsapp_conversations_active ON whatsapp_conversations(connection_id, expires_at);
```

---

## API Endpoints

### `/api/whatsapp/webhook` (POST)
Recibe mensajes de Twilio

```typescript
// src/app/api/whatsapp/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const from = formData.get('From') as string // +56912345678
  const body = formData.get('Body') as string
  const messageSid = formData.get('MessageSid') as string

  // Normalize phone number
  const phoneNumber = from.replace('whatsapp:', '')

  // Get or create connection
  const connection = await getOrCreateConnection(phoneNumber)

  if (!connection.user_id) {
    // Not linked to account yet
    return sendMessage(phoneNumber,
      '👋 Hola! Para usar BrainFlow Bot, primero vincula tu cuenta:\n\n' +
      '1. Abre BrainFlow en tu navegador\n' +
      '2. Ve a Configuración > Integraciones\n' +
      '3. Conecta WhatsApp\n\n' +
      'Tu código de verificación aparecerá ahí.'
    )
  }

  // Log inbound message
  await logMessage(connection.id, 'inbound', body, { twilio_sid: messageSid })

  // Process message
  const response = await processMessage(connection, body)

  // Send response
  await sendMessage(phoneNumber, response.text, response.buttons)

  return NextResponse.json({ success: true })
}

async function processMessage(connection: Connection, message: string) {
  const text = message.trim().toLowerCase()

  // Check for commands first
  if (text.startsWith('/')) {
    return handleCommand(connection, text)
  }

  // Check for active conversation flow
  const activeConvo = await getActiveConversation(connection.id)
  if (activeConvo) {
    return handleConversationFlow(connection, activeConvo, message)
  }

  // Check for quick responses (numbers, emojis)
  if (/^[1-5]$/.test(text)) {
    return handleQuickMoodResponse(connection, parseInt(text))
  }

  // Default: treat as free thought
  return handleFreeThought(connection, message)
}
```

### `/api/whatsapp/connect` (POST)
Vincular número a cuenta

```typescript
// src/app/api/whatsapp/connect/route.ts

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { phoneNumber } = await request.json()

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Store pending connection
  await supabase.from('whatsapp_connections').upsert({
    user_id: session.user.id,
    phone_number: normalizePhone(phoneNumber),
    verification_code: code,
    verification_expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    phone_verified: false
  })

  // Send verification message
  await sendWhatsAppMessage(phoneNumber,
    `🔐 Tu código de verificación BrainFlow es: *${code}*\n\n` +
    `Responde con este código para completar la vinculación.`
  )

  return NextResponse.json({ success: true, message: 'Código enviado' })
}
```

### `/api/whatsapp/verify` (POST)
Verificar código

```typescript
export async function POST(request: NextRequest) {
  const { phoneNumber, code } = await request.json()

  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('phone_number', normalizePhone(phoneNumber))
    .eq('verification_code', code)
    .gt('verification_expires_at', new Date().toISOString())
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 })
  }

  // Mark as verified
  await supabase
    .from('whatsapp_connections')
    .update({
      phone_verified: true,
      verification_code: null
    })
    .eq('id', connection.id)

  // Create default reminders
  await createDefaultReminders(connection.id)

  // Send welcome message
  await sendWhatsAppMessage(phoneNumber,
    '✅ *Cuenta vinculada exitosamente!*\n\n' +
    'Ahora recibirás recordatorios y podrás interactuar con tu journal desde aquí.\n\n' +
    'Comandos disponibles:\n' +
    '📝 /journal - Abrir journal\n' +
    '📊 /stats - Ver estadísticas\n' +
    '😊 /mood - Registrar estado\n' +
    '❓ /ayuda - Ver todos los comandos'
  )

  return NextResponse.json({ success: true })
}
```

### `/api/whatsapp/reminders/send` (POST - Cron Job)
Enviar recordatorios programados

```typescript
// Called by Vercel Cron every 5 minutes

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return unauthorized()
  }

  const now = new Date()

  // Get due reminders
  const { data: dueReminders } = await supabase
    .from('whatsapp_reminders')
    .select(`
      *,
      connection:whatsapp_connections(*)
    `)
    .eq('enabled', true)
    .lte('next_scheduled_at', now.toISOString())

  for (const reminder of dueReminders) {
    await sendReminder(reminder)
    await updateNextSchedule(reminder)
  }

  return NextResponse.json({ sent: dueReminders.length })
}
```

---

## Command Handlers

```typescript
// src/lib/whatsapp/commands.ts

export const commands: Record<string, CommandHandler> = {

  // ============================================
  // /journal - Quick journal entry
  // ============================================
  '/journal': async (connection) => {
    const today = formatDate(new Date())
    const entry = await getJournalEntry(connection.user_id, today)

    const morningDone = entry?.gratitude?.some(g => g) && entry?.daily_intention
    const nightDone = entry?.best_moments?.some(m => m) && entry?.lesson_learned

    // Start appropriate flow
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
              `✓ Gratitud: ${entry.gratitude.filter(g => g).length} items\n` +
              `✓ Intención: ${entry.daily_intention.slice(0, 30)}...\n` +
              `✓ Mejor momento registrado\n` +
              `✓ Lección aprendida\n\n` +
              '¿Quieres agregar un pensamiento libre?\n' +
              '_Escribe /nota seguido de tu pensamiento_'
      }
    }
  },

  // ============================================
  // /stats - View statistics
  // ============================================
  '/stats': async (connection) => {
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

  // ============================================
  // /mood [1-5] - Quick mood entry
  // ============================================
  '/mood': async (connection, args) => {
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
              '_Responde con un número del 1 al 5_'
      }
    }

    await updateJournalMood(connection.user_id, mood)
    const emoji = ['😢', '😕', '😐', '🙂', '😄'][mood - 1]

    return {
      text: `${emoji} Mood registrado: ${mood}/5\n\n` +
            '¿Algo que quieras agregar sobre cómo te sientes?\n' +
            '_Escribe libremente o ignora este mensaje_'
    }
  },

  // ============================================
  // /estudiar - Start study session
  // ============================================
  '/estudiar': async (connection) => {
    const pendingNotes = await getPendingNotes(connection.user_id, 3)

    if (pendingNotes.length === 0) {
      return {
        text: '🎉 *No tienes notas pendientes!*\n\n' +
              '¿Quieres explorar nuevos temas?\n' +
              '[Abrir BrainFlow]'
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

  // ============================================
  // /nota [texto] - Quick free thought
  // ============================================
  '/nota': async (connection, args) => {
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

  // ============================================
  // /racha - View streak
  // ============================================
  '/racha': async (connection) => {
    const streak = await getStreak(connection.user_id)
    const bestStreak = await getBestStreak(connection.user_id)

    const flames = '🔥'.repeat(Math.min(streak, 10))

    return {
      text: `${flames}\n\n` +
            `*Racha actual: ${streak} días*\n\n` +
            `Mejor racha: ${bestStreak} días\n\n` +
            (streak >= 7 ? '¡Increíble! Una semana completa 🎉' :
             streak >= 3 ? '¡Vas muy bien! Sigue así 💪' :
             '¡Cada día cuenta! No rompas la racha')
    }
  },

  // ============================================
  // /metas - View goals progress
  // ============================================
  '/metas': async (connection) => {
    const goals = await getYearlyGoals(connection.user_id)

    if (!goals.length) {
      return {
        text: '🎯 *Metas del Año*\n\n' +
              'No tienes metas configuradas.\n\n' +
              'Abre tu Journal Anual para definir tus metas SMART:\n' +
              '[Abrir Journal Anual]'
      }
    }

    return {
      text: '🎯 *Progreso de Metas*\n\n' +
            goals.map(g => {
              const bar = progressBar(g.progress)
              return `*${g.area}*\n${g.goal}\n${bar} ${g.progress}%`
            }).join('\n\n')
    }
  },

  // ============================================
  // /ayuda - Help
  // ============================================
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
            '⏰ /recordatorios - Configurar\n' +
            '❓ /ayuda - Este mensaje\n\n' +
            '_También puedes escribir libremente y lo guardaré en tu journal_'
    }
  },

  // ============================================
  // /recordatorios - Configure reminders
  // ============================================
  '/recordatorios': async (connection) => {
    const reminders = await getReminders(connection.id)

    return {
      text: '⏰ *Tus Recordatorios*\n\n' +
            reminders.map(r =>
              `${r.enabled ? '✅' : '❌'} ${r.name}: ${r.time || r.description}`
            ).join('\n') +
            '\n\n_Para cambiar configuración, abre la app_\n' +
            '[Configurar en BrainFlow]'
    }
  }
}

// Helper function
function progressBar(percent: number): string {
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}
```

---

## Conversation Flows

```typescript
// src/lib/whatsapp/flows.ts

export const flows: Record<string, ConversationFlow> = {

  // ============================================
  // MORNING JOURNAL FLOW
  // ============================================
  journal_morning: {
    steps: [
      {
        id: 'gratitude',
        prompt: '🌅 *Buenos días!*\n\n¿Por qué estás agradecido hoy?\n\n_Escribe 1-3 cosas_',
        handler: async (connection, input, data) => {
          const items = input.split(',').map(s => s.trim()).slice(0, 3)
          data.gratitude = items
          return { next: 'intention', data }
        }
      },
      {
        id: 'intention',
        prompt: '🎯 *Intención del Día*\n\n¿Cuál es tu enfoque principal para hoy?',
        handler: async (connection, input, data) => {
          data.daily_intention = input
          return { next: 'great_day', data }
        }
      },
      {
        id: 'great_day',
        prompt: '✨ *¿Qué haría hoy un gran día?*\n\n_Escribe 1-3 cosas_',
        handler: async (connection, input, data) => {
          const items = input.split(',').map(s => s.trim()).slice(0, 3)
          data.what_pilesDay = items

          // Save to journal
          await saveJournalMorning(connection.user_id, data)

          return {
            complete: true,
            message: '✅ *Morning journal completado!*\n\n' +
                     `📝 Gratitud: ${data.gratitude.length} items\n` +
                     `🎯 Intención: "${data.daily_intention.slice(0, 30)}..."\n` +
                     `✨ Gran día: ${data.what_pilesDay.length} items\n\n` +
                     'Te enviaré un recordatorio esta noche para reflexionar 🌙'
          }
        }
      }
    ]
  },

  // ============================================
  // NIGHT REFLECTION FLOW
  // ============================================
  journal_night: {
    steps: [
      {
        id: 'best_moment',
        prompt: '🌙 *Reflexión Nocturna*\n\n¿Cuál fue el mejor momento de hoy?',
        handler: async (connection, input, data) => {
          data.best_moments = [input]
          return { next: 'lesson', data }
        }
      },
      {
        id: 'lesson',
        prompt: '💡 *Lección del Día*\n\n¿Qué aprendiste hoy?',
        handler: async (connection, input, data) => {
          data.lesson_learned = input
          return { next: 'mood', data }
        }
      },
      {
        id: 'mood',
        prompt: '😊 *¿Cómo te sientes?*\n\n' +
                '1️⃣ Muy mal\n2️⃣ Mal\n3️⃣ Normal\n4️⃣ Bien\n5️⃣ Muy bien',
        handler: async (connection, input, data) => {
          const mood = parseInt(input)
          if (mood >= 1 && mood <= 5) {
            data.mood = mood
          } else {
            return { repeat: true, message: 'Por favor responde con un número del 1 al 5' }
          }

          // Save to journal
          await saveJournalNight(connection.user_id, data)

          const emoji = ['😢', '😕', '😐', '🙂', '😄'][mood - 1]

          return {
            complete: true,
            message: `✅ *Journal del día completado!*\n\n` +
                     `${emoji} Mood: ${mood}/5\n` +
                     `🌟 Mejor momento guardado\n` +
                     `💡 Lección guardada\n\n` +
                     `🔥 Racha: ${await getStreak(connection.user_id)} días\n\n` +
                     '¡Descansa bien! Nos vemos mañana 🌙'
          }
        }
      }
    ]
  },

  // ============================================
  // WEEKLY CHECK-IN FLOW
  // ============================================
  weekly_checkin: {
    steps: [
      {
        id: 'rating',
        prompt: async (connection) => {
          const stats = await getWeeklyStats(connection.user_id)
          return '📊 *Check-in Semanal*\n\n' +
                 `Esta semana:\n` +
                 `✅ ${stats.journalDays}/7 días de journal\n` +
                 `📚 ${stats.notesStudied} notas estudiadas\n` +
                 `🔥 Racha: ${stats.streak} días\n\n` +
                 '¿Cómo calificarías tu semana? (1-10)'
        },
        handler: async (connection, input, data) => {
          const rating = parseInt(input)
          if (rating >= 1 && rating <= 10) {
            data.rating = rating
            return { next: 'highlight', data }
          }
          return { repeat: true, message: 'Por favor responde con un número del 1 al 10' }
        }
      },
      {
        id: 'highlight',
        prompt: '✨ ¿Cuál fue el highlight de tu semana?',
        handler: async (connection, input, data) => {
          data.highlight = input
          return { next: 'improve', data }
        }
      },
      {
        id: 'improve',
        prompt: '📈 ¿Qué mejorarías para la próxima semana?',
        handler: async (connection, input, data) => {
          data.to_improve = input

          // Save weekly entry
          await saveWeeklyCheckin(connection.user_id, data)

          return {
            complete: true,
            message: '✅ *Check-in semanal guardado!*\n\n' +
                     `Calificación: ${data.rating}/10\n` +
                     `Highlight: "${data.highlight.slice(0, 50)}..."\n\n` +
                     '¡Que tengas una excelente semana! 💪'
          }
        }
      }
    ]
  },

  // ============================================
  // STUDY SESSION FLOW
  // ============================================
  study_session: {
    steps: [
      {
        id: 'start',
        prompt: async (connection, data) => {
          return `📚 *Sesión de Estudio*\n\n` +
                 `Tema: ${data.note.title}\n` +
                 `Área: ${data.note.area}\n` +
                 `Tiempo estimado: ${data.note.estimatedMinutes || 30} min\n\n` +
                 'Responde "listo" cuando termines o "pausar" si necesitas un break.'
        },
        handler: async (connection, input, data) => {
          const cmd = input.toLowerCase()

          if (cmd === 'listo' || cmd === 'termine' || cmd === 'terminé') {
            return { next: 'rating', data }
          } else if (cmd === 'pausar' || cmd === 'pausa') {
            return {
              pause: true,
              message: '⏸️ Sesión pausada. Responde "continuar" cuando quieras seguir.'
            }
          } else if (cmd === 'continuar') {
            return { repeat: true, message: '▶️ Continuamos! Responde "listo" cuando termines.' }
          }

          return { repeat: true }
        }
      },
      {
        id: 'rating',
        prompt: '¿Cómo te fue?\n\n' +
                '1️⃣ Excelente, lo entendí todo\n' +
                '2️⃣ Bien, pero tengo dudas\n' +
                '3️⃣ Difícil, necesito repasar\n' +
                '4️⃣ No pude concentrarme',
        handler: async (connection, input, data) => {
          const rating = parseInt(input)

          if (rating === 1) {
            await markNoteAsUnderstood(connection.user_id, data.note.id)
            return {
              complete: true,
              message: '🎉 *Excelente!*\n\n' +
                       `"${data.note.title}" marcada como entendida ✓\n\n` +
                       '¿Quieres estudiar otra nota? Escribe /estudiar'
            }
          } else if (rating >= 2 && rating <= 4) {
            const messages = {
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

          return { repeat: true, message: 'Por favor responde con un número del 1 al 4' }
        }
      }
    ]
  }
}
```

---

## Reminder Templates

```typescript
// src/lib/whatsapp/reminders.ts

export const reminderTemplates = {

  morning_checkin: {
    name: 'Morning Check-in',
    defaultTime: '07:00',
    getMessage: async (connection: Connection) => {
      const yesterday = await getYesterdayEntry(connection.user_id)
      const streak = await getStreak(connection.user_id)

      let message = '🌅 *Buenos días!*\n\n'

      if (yesterday?.daily_intention) {
        message += `Tu intención de ayer fue:\n"${yesterday.daily_intention}"\n\n`
        message += '¿Cómo te fue?\n'
        message += '1️⃣ Lo logré\n'
        message += '2️⃣ Avancé parcialmente\n'
        message += '3️⃣ No pude\n\n'
      }

      message += `🔥 Racha: ${streak} días\n\n`
      message += 'Escribe /journal para empezar tu día'

      return message
    }
  },

  night_reflection: {
    name: 'Night Reflection',
    defaultTime: '21:00',
    getMessage: async (connection: Connection) => {
      const today = await getTodayEntry(connection.user_id)

      if (today?.best_moments?.some(m => m)) {
        return '🌙 *Tu journal de hoy está completo!*\n\n' +
               '¡Buen trabajo! Descansa bien 😴'
      }

      return '🌙 *Hora de reflexionar*\n\n' +
             '¿Cuál fue el mejor momento de hoy?\n' +
             '¿Qué aprendiste?\n\n' +
             'Escribe /journal para completar tu día'
    }
  },

  weekly_review: {
    name: 'Weekly Review',
    defaultDay: 0, // Sunday
    defaultTime: '20:00',
    getMessage: async (connection: Connection) => {
      const stats = await getWeeklyStats(connection.user_id)

      return '📊 *Resumen Semanal*\n\n' +
             `Esta semana:\n` +
             `✅ ${stats.journalDays}/7 días de journal\n` +
             `📚 ${stats.notesStudied} notas estudiadas\n` +
             `😊 Mood promedio: ${stats.avgMood.toFixed(1)}/5\n` +
             `🔥 Racha: ${stats.streak} días\n\n` +
             '¿Listo para tu check-in semanal?\n' +
             'Responde "si" para empezar'
    }
  },

  study_block: {
    name: 'Study Block Reminder',
    minutesBefore: 15,
    getMessage: async (connection: Connection, studyBlock: StudyBlock) => {
      return `📚 *Recordatorio de Estudio*\n\n` +
             `En 15 minutos:\n` +
             `📖 "${studyBlock.note.title}"\n` +
             `⏰ ${studyBlock.startTime} - ${studyBlock.endTime}\n` +
             `🎯 Área: ${studyBlock.area}\n\n` +
             '¿Listo?\n' +
             '✅ Confirmar\n' +
             '⏰ Posponer 30 min\n' +
             '❌ Cancelar'
    }
  },

  area_neglect: {
    name: 'Area Neglect Alert',
    checkInterval: 'weekly',
    getMessage: async (connection: Connection, area: Area, daysSince: number) => {
      return `⚠️ *Área Descuidada*\n\n` +
             `Hace ${daysSince} días que no dedicas tiempo a:\n\n` +
             `${area.icon} *${area.name}*\n\n` +
             '¿Agendamos 30 minutos esta semana?\n' +
             'Responde "si" para ver horarios disponibles'
    }
  },

  goal_checkin: {
    name: 'Monthly Goal Check-in',
    defaultDay: 1, // First of month
    defaultTime: '10:00',
    getMessage: async (connection: Connection) => {
      const goals = await getGoalsProgress(connection.user_id)

      let message = '🎯 *Check-in de Metas*\n\n'

      for (const goal of goals) {
        const status = goal.onTrack ? '✅' : '⚠️'
        message += `${status} ${goal.name}: ${goal.progress}%\n`
      }

      message += '\n¿Quieres ajustar alguna meta?\n'
      message += '[Ver detalles en BrainFlow]'

      return message
    }
  }
}
```

---

## Cron Jobs (Vercel)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/whatsapp/cron/send-reminders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/whatsapp/cron/check-areas",
      "schedule": "0 10 * * 1"
    },
    {
      "path": "/api/whatsapp/cron/weekly-summary",
      "schedule": "0 20 * * 0"
    }
  ]
}
```

---

## UI Components

### Connection Flow (Settings Page)

```typescript
// src/components/settings/WhatsAppConnect.tsx

'use client'

import { useState } from 'react'
import { Phone, Check, Loader2, MessageCircle } from 'lucide-react'

export function WhatsAppConnect() {
  const [step, setStep] = useState<'input' | 'verify' | 'connected'>('input')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendCode = async () => {
    setLoading(true)
    await fetch('/api/whatsapp/connect', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: phone })
    })
    setLoading(false)
    setStep('verify')
  }

  const handleVerify = async () => {
    setLoading(true)
    const res = await fetch('/api/whatsapp/verify', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: phone, code })
    })
    if (res.ok) {
      setStep('connected')
    }
    setLoading(false)
  }

  if (step === 'connected') {
    return (
      <div className="p-6 rounded-2xl bg-green-50 border border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageCircle className="text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-800">WhatsApp Conectado</h3>
            <p className="text-sm text-green-600">{phone}</p>
          </div>
          <Check className="ml-auto text-green-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl bg-white border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
          <MessageCircle className="text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold">Conectar WhatsApp</h3>
          <p className="text-sm text-gray-500">Recibe recordatorios y haz journal desde WhatsApp</p>
        </div>
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Número de WhatsApp</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-200"
              />
              <button
                onClick={handleSendCode}
                disabled={loading || !phone}
                className="px-6 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Enviar Código'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enviamos un código a <strong>{phone}</strong>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl border text-center text-2xl tracking-widest focus:ring-2 focus:ring-green-200"
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="px-6 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Verificar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Setup Twilio account + WhatsApp Business
- [ ] Create database tables
- [ ] Implement `/api/whatsapp/webhook`
- [ ] Implement `/api/whatsapp/connect` + `/verify`
- [ ] Basic command handler (`/ayuda`)
- [ ] UI: WhatsApp connection component

### Week 2: Core Commands
- [ ] Implement `/journal` command
- [ ] Implement `/mood` command
- [ ] Implement `/stats` command
- [ ] Implement `/nota` command
- [ ] Implement `/racha` command
- [ ] Morning journal flow

### Week 3: Reminders & Flows
- [ ] Night reflection flow
- [ ] Morning reminder cron
- [ ] Night reminder cron
- [ ] Reminder preferences UI
- [ ] Study session reminders

### Week 4: Advanced
- [ ] Weekly check-in flow
- [ ] `/estudiar` command + flow
- [ ] `/metas` command
- [ ] Area neglect alerts
- [ ] Testing & refinement

---

## Environment Variables

```env
# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Cron
CRON_SECRET=your-secret-key

# App
NEXT_PUBLIC_APP_URL=https://brainflow.app
```

---

## Costos Estimados

### Twilio Pricing (WhatsApp)
```
Conversation-based pricing:

User-initiated conversations: $0.005 - $0.08
Business-initiated conversations: $0.015 - $0.15
(Varía por país)

Para Chile:
- User-initiated: ~$0.0318/conversation
- Business-initiated: ~$0.0525/conversation

Estimado mensual (1000 usuarios activos):
- 30 morning reminders/user = 30,000 msgs
- 30 night reminders/user = 30,000 msgs
- 4 weekly summaries/user = 4,000 msgs
- User responses = ~20,000 msgs

Total: ~$500-800/mes para 1000 usuarios
```

### Alternativa: Meta Cloud API Directo
```
1,000 conversaciones gratis/mes
Después: Similar pricing a Twilio

Mejor para escalar, pero más complejo de implementar.
```

---

## Conclusión

Este plan de implementación del WhatsApp Bot proporciona:

1. **Arquitectura completa** - Database, API, handlers
2. **Flujos conversacionales** - Morning, night, weekly
3. **Comandos útiles** - /journal, /stats, /mood, etc.
4. **Sistema de recordatorios** - Configurable por usuario
5. **UI de conexión** - Fácil vinculación de cuenta
6. **Roadmap claro** - 4 semanas de implementación

El resultado: un compañero de WhatsApp que mantiene a los usuarios comprometidos con su crecimiento personal, sin fricción.
