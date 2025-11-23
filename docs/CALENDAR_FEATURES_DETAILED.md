# Calendar Features - Implementación Detallada

Profundización de los 3 primeros features del Calendar Enhancement.

---

## 1. Time Blocking Inteligente

### Concepto
El sistema analiza tu calendario de Google, detecta tiempo libre, y sugiere bloques de estudio optimizados basándose en:
- Tu energía (KPIs del journal)
- Áreas descuidadas
- Notas pendientes
- Patrones históricos

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIME BLOCKING ENGINE                          │
└─────────────────────────────────────────────────────────────────┘

      Google Calendar API              BrainFlow Data
              │                              │
              ▼                              ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  Fetch Events   │           │  Load Context   │
    │  (next 7 days)  │           │  - KPIs         │
    └────────┬────────┘           │  - Notes        │
             │                    │  - Areas        │
             │                    │  - History      │
             │                    └────────┬────────┘
             │                             │
             └──────────┬──────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Free Slot      │
              │  Detection      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Smart Block    │
              │  Generator      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Priority       │
              │  Ranking        │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Suggestions    │
              │  Output         │
              └─────────────────┘
```

### Database Schema

```sql
-- =============================================
-- STUDY BLOCKS (Bloques de estudio planificados)
-- =============================================
CREATE TABLE study_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What to study
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  area VARCHAR(100),
  custom_title VARCHAR(255), -- Si no es de una nota específica

  -- When
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(100), -- "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
  recurrence_end_date DATE,
  parent_block_id UUID REFERENCES study_blocks(id), -- For recurring instances

  -- Status
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'skipped', 'rescheduled'

  -- Tracking
  actual_start_time TIMESTAMP,
  actual_end_time TIMESTAMP,
  actual_duration_minutes INTEGER,
  completion_rating INTEGER, -- 1-5
  notes TEXT, -- User notes about the session

  -- Metadata
  suggested_by VARCHAR(20), -- 'system', 'user', 'ai'
  suggestion_reason TEXT,
  energy_level_suggested VARCHAR(10), -- 'high', 'medium', 'low'

  -- Google Calendar sync
  google_event_id VARCHAR(255),
  synced_to_google BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- USER ENERGY PATTERNS
-- =============================================
CREATE TABLE energy_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  day_of_week INTEGER NOT NULL, -- 0-6 (Sunday-Saturday)
  hour_of_day INTEGER NOT NULL, -- 0-23

  -- Aggregated metrics
  avg_energy_level DECIMAL(3,2), -- From journal KPIs
  avg_focus_score DECIMAL(3,2), -- From completed blocks
  avg_completion_rate DECIMAL(3,2),
  sample_count INTEGER DEFAULT 0,

  -- Last updated
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, day_of_week, hour_of_day)
);

-- =============================================
-- AREA TIME TRACKING
-- =============================================
CREATE TABLE area_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  area VARCHAR(100) NOT NULL,
  date DATE NOT NULL,

  planned_minutes INTEGER DEFAULT 0,
  actual_minutes INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, area, date)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_study_blocks_user_date ON study_blocks(user_id, scheduled_date);
CREATE INDEX idx_study_blocks_status ON study_blocks(status) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX idx_energy_patterns_user ON energy_patterns(user_id, day_of_week, hour_of_day);
CREATE INDEX idx_area_time_logs_user ON area_time_logs(user_id, date);
```

### API Endpoints

#### `POST /api/calendar/suggest-blocks`

```typescript
// src/app/api/calendar/suggest-blocks/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarEvents } from '@/lib/google-calendar'
import { generateSmartBlocks } from '@/lib/calendar/smart-blocks'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { startDate, endDate, preferences } = await request.json()

  // 1. Get Google Calendar events
  const googleEvents = await getGoogleCalendarEvents(
    session.user.id,
    startDate,
    endDate
  )

  // 2. Get user context
  const context = await getUserContext(session.user.id)
  // - Journal KPIs (last 4 weeks)
  // - Pending notes
  // - Area progress
  // - Energy patterns
  // - Recent study history

  // 3. Detect free slots
  const freeSlots = detectFreeSlots(googleEvents, preferences)

  // 4. Generate smart blocks
  const suggestions = await generateSmartBlocks({
    freeSlots,
    context,
    preferences
  })

  // 5. Rank by priority
  const rankedSuggestions = rankSuggestions(suggestions, context)

  return NextResponse.json({
    suggestions: rankedSuggestions,
    freeSlots,
    context: {
      pendingNotes: context.pendingNotes.length,
      neglectedAreas: context.neglectedAreas,
      avgEnergy: context.avgEnergy
    }
  })
}
```

#### Smart Block Generation Logic

```typescript
// src/lib/calendar/smart-blocks.ts

interface SmartBlockSuggestion {
  id: string
  suggestedTime: {
    date: string
    startTime: string
    endTime: string
  }
  duration: number // minutes
  note?: {
    id: string
    title: string
    area: string
    estimatedTime: number
  }
  area: string
  reason: string
  priority: number // 1-10
  energyLevel: 'high' | 'medium' | 'low'
  confidence: number // 0-1
}

export async function generateSmartBlocks({
  freeSlots,
  context,
  preferences
}: GenerateParams): Promise<SmartBlockSuggestion[]> {
  const suggestions: SmartBlockSuggestion[] = []

  // 1. Priority: Neglected areas
  for (const area of context.neglectedAreas) {
    const notesInArea = context.pendingNotes.filter(n => n.area === area.name)
    if (notesInArea.length > 0) {
      const bestSlot = findBestSlot(freeSlots, {
        duration: 30,
        energyRequired: 'medium',
        context
      })

      if (bestSlot) {
        suggestions.push({
          id: generateId(),
          suggestedTime: bestSlot,
          duration: 30,
          note: notesInArea[0],
          area: area.name,
          reason: `No has estudiado ${area.name} en ${area.daysSince} días`,
          priority: 9,
          energyLevel: 'medium',
          confidence: 0.85
        })
      }
    }
  }

  // 2. Priority: In-progress notes
  const inProgressNotes = context.pendingNotes.filter(n => n.status === 'read')
  for (const note of inProgressNotes.slice(0, 3)) {
    const bestSlot = findBestSlot(freeSlots, {
      duration: note.estimatedTime || 30,
      energyRequired: note.difficulty === 'hard' ? 'high' : 'medium',
      context,
      excludeUsed: suggestions.map(s => s.suggestedTime)
    })

    if (bestSlot) {
      suggestions.push({
        id: generateId(),
        suggestedTime: bestSlot,
        duration: note.estimatedTime || 30,
        note,
        area: note.area,
        reason: `Continuar con "${note.title}" (en progreso)`,
        priority: 8,
        energyLevel: note.difficulty === 'hard' ? 'high' : 'medium',
        confidence: 0.8
      })
    }
  }

  // 3. New notes based on goals
  const goalRelatedNotes = findGoalRelatedNotes(context.pendingNotes, context.goals)
  for (const note of goalRelatedNotes.slice(0, 2)) {
    const bestSlot = findBestSlot(freeSlots, {
      duration: note.estimatedTime || 45,
      energyRequired: 'high',
      context,
      excludeUsed: suggestions.map(s => s.suggestedTime)
    })

    if (bestSlot) {
      suggestions.push({
        id: generateId(),
        suggestedTime: bestSlot,
        duration: note.estimatedTime || 45,
        note,
        area: note.area,
        reason: `Relacionado con tu meta: "${note.relatedGoal}"`,
        priority: 7,
        energyLevel: 'high',
        confidence: 0.75
      })
    }
  }

  // 4. Balance areas (fill remaining slots)
  const areaBalance = calculateAreaBalance(context)
  const underrepresentedAreas = areaBalance.filter(a => a.percentage < 10)

  for (const area of underrepresentedAreas) {
    const notesInArea = context.pendingNotes.filter(n => n.area === area.name)
    if (notesInArea.length > 0) {
      const slot = findAnyAvailableSlot(freeSlots, {
        duration: 25,
        excludeUsed: suggestions.map(s => s.suggestedTime)
      })

      if (slot) {
        suggestions.push({
          id: generateId(),
          suggestedTime: slot,
          duration: 25,
          note: notesInArea[0],
          area: area.name,
          reason: `Balancear tiempo en ${area.name}`,
          priority: 5,
          energyLevel: 'low',
          confidence: 0.6
        })
      }
    }
  }

  return suggestions
}

function findBestSlot(
  freeSlots: FreeSlot[],
  requirements: SlotRequirements
): TimeSlot | null {
  const { duration, energyRequired, context, excludeUsed = [] } = requirements

  // Filter slots that meet duration requirement
  const validSlots = freeSlots.filter(slot => {
    const slotDuration = calculateDuration(slot.start, slot.end)
    return slotDuration >= duration
  })

  // Score each slot based on energy patterns
  const scoredSlots = validSlots.map(slot => {
    const dayOfWeek = new Date(slot.date).getDay()
    const hour = parseInt(slot.start.split(':')[0])

    // Get user's energy pattern for this time
    const energyPattern = context.energyPatterns.find(
      p => p.day_of_week === dayOfWeek && p.hour_of_day === hour
    )

    let score = 50 // Base score

    // Match energy requirement
    if (energyPattern) {
      if (energyRequired === 'high' && energyPattern.avg_energy_level > 7) {
        score += 30
      } else if (energyRequired === 'medium' && energyPattern.avg_energy_level > 4) {
        score += 20
      } else if (energyRequired === 'low') {
        score += 10
      }

      // Boost for high completion rate times
      score += energyPattern.avg_completion_rate * 20
    }

    // Prefer morning for high energy tasks
    if (energyRequired === 'high' && hour >= 8 && hour <= 11) {
      score += 15
    }

    // Avoid late night for important tasks
    if (energyRequired === 'high' && hour >= 20) {
      score -= 20
    }

    // Check if already used
    const isUsed = excludeUsed.some(
      used => used.date === slot.date && used.startTime === slot.start
    )
    if (isUsed) score = -100

    return { slot, score }
  })

  // Sort by score and return best
  scoredSlots.sort((a, b) => b.score - a.score)

  if (scoredSlots.length > 0 && scoredSlots[0].score > 0) {
    const best = scoredSlots[0].slot
    return {
      date: best.date,
      startTime: best.start,
      endTime: addMinutes(best.start, duration)
    }
  }

  return null
}
```

### UI Component: Block Suggestions

```typescript
// src/components/calendar/BlockSuggestions.tsx

'use client'

import { useState } from 'react'
import { Clock, BookOpen, Target, Zap, ChevronRight, Plus, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'

interface BlockSuggestion {
  id: string
  suggestedTime: {
    date: string
    startTime: string
    endTime: string
  }
  duration: number
  note?: { id: string; title: string; area: string }
  area: string
  reason: string
  priority: number
  energyLevel: 'high' | 'medium' | 'low'
}

export function BlockSuggestions({ suggestions }: { suggestions: BlockSuggestion[] }) {
  const [dismissed, setDismissed] = useState<string[]>([])

  const createBlock = useMutation({
    mutationFn: async (suggestion: BlockSuggestion) => {
      return fetch('/api/calendar/create-study-session', {
        method: 'POST',
        body: JSON.stringify({
          noteId: suggestion.note?.id,
          area: suggestion.area,
          scheduledDate: suggestion.suggestedTime.date,
          startTime: suggestion.suggestedTime.startTime,
          endTime: suggestion.suggestedTime.endTime,
          duration: suggestion.duration,
          suggestedBy: 'system',
          suggestionReason: suggestion.reason
        })
      })
    }
  })

  const visibleSuggestions = suggestions.filter(s => !dismissed.includes(s.id))

  if (visibleSuggestions.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-gray-50 text-center">
        <p className="text-sm text-gray-500">No hay sugerencias disponibles</p>
      </div>
    )
  }

  const energyColors = {
    high: { bg: '#FFE5E5', text: '#E53E3E', icon: '🔥' },
    medium: { bg: '#FFF3E5', text: '#DD6B20', icon: '⚡' },
    low: { bg: '#E5F4FF', text: '#3182CE', icon: '🌊' }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Bloques Sugeridos</h3>
        <span className="text-xs text-gray-500">{visibleSuggestions.length} sugerencias</span>
      </div>

      {visibleSuggestions.slice(0, 5).map((suggestion) => {
        const energy = energyColors[suggestion.energyLevel]

        return (
          <div
            key={suggestion.id}
            className="p-4 rounded-xl bg-white border border-gray-100 hover:border-purple-200 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: energy.bg }}
                >
                  {energy.icon}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {suggestion.note?.title || suggestion.area}
                  </p>
                  <p className="text-xs text-gray-500">{suggestion.area}</p>
                </div>
              </div>
              <button
                onClick={() => setDismissed([...dismissed, suggestion.id])}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(suggestion.suggestedTime.date)} {suggestion.suggestedTime.startTime}
              </span>
              <span>{suggestion.duration} min</span>
            </div>

            <p className="text-xs text-gray-600 mb-3 p-2 bg-gray-50 rounded-lg">
              💡 {suggestion.reason}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => createBlock.mutate(suggestion)}
                disabled={createBlock.isPending}
                className="flex-1 py-2 px-3 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium hover:bg-purple-200 transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Agendar
              </button>
              <button
                onClick={() => {/* Open customization modal */}}
                className="py-2 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-all"
              >
                Personalizar
              </button>
            </div>
          </div>
        )
      })}

      {visibleSuggestions.length > 5 && (
        <button className="w-full py-2 text-sm text-purple-600 hover:text-purple-700">
          Ver {visibleSuggestions.length - 5} más
        </button>
      )}
    </div>
  )
}
```

---

## 2. Daily Planning Assistant

### Concepto
Un asistente que cada mañana (o cuando abres la app) te presenta un resumen del día con:
- Eventos de Google Calendar
- Tareas del journal
- Bloques de estudio sugeridos
- Un plan optimizado que puedes aceptar o personalizar

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                   DAILY PLANNING ASSISTANT                       │
└─────────────────────────────────────────────────────────────────┘

           Morning Trigger (App Open / 7am)
                        │
                        ▼
              ┌─────────────────┐
              │  Gather Data    │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Google  │   │ Journal │   │ Study   │
   │ Events  │   │  Tasks  │   │ Blocks  │
   └────┬────┘   └────┬────┘   └────┬────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Conflict       │
              │  Detection      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Plan           │
              │  Optimization   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Morning Brief  │
              │  Generation     │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Present to     │
              │  User           │
              └─────────────────┘
```

### API Endpoint

```typescript
// src/app/api/calendar/daily-plan/route.ts

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const today = new Date()
  const dateStr = formatDateStr(today)

  // 1. Get Google Calendar events for today
  const googleEvents = await getGoogleCalendarEvents(
    session.user.id,
    dateStr,
    dateStr
  )

  // 2. Get journal tasks for today
  const journalEntry = await getJournalEntry(session.user.id, dateStr)
  const tasks = journalEntry?.tasks || []
  const dailyIntention = journalEntry?.daily_intention

  // 3. Get scheduled study blocks
  const studyBlocks = await getStudyBlocks(session.user.id, dateStr)

  // 4. Get pending notes for suggestions
  const pendingNotes = await getPendingNotes(session.user.id, 5)

  // 5. Calculate free time
  const allEvents = [
    ...googleEvents.map(e => ({ ...e, type: 'google' })),
    ...studyBlocks.map(b => ({ ...b, type: 'study' }))
  ]
  const freeSlots = calculateFreeSlots(allEvents, {
    dayStart: '08:00',
    dayEnd: '22:00'
  })
  const totalFreeMinutes = freeSlots.reduce((acc, slot) => acc + slot.duration, 0)

  // 6. Detect conflicts
  const conflicts = detectConflicts([
    ...googleEvents,
    ...studyBlocks,
    ...tasks.filter(t => t.scheduledTime)
  ])

  // 7. Generate suggestions for free time
  const suggestions = await generateDailySuggestions({
    freeSlots,
    pendingNotes,
    tasks: tasks.filter(t => !t.completed && !t.scheduledTime),
    userContext: await getUserContext(session.user.id)
  })

  // 8. Build timeline
  const timeline = buildTimeline({
    googleEvents,
    studyBlocks,
    tasks,
    suggestions
  })

  // 9. Generate morning brief
  const brief = generateMorningBrief({
    googleEvents,
    totalFreeMinutes,
    pendingNotes,
    dailyIntention,
    streak: await getStreak(session.user.id)
  })

  return NextResponse.json({
    date: dateStr,
    brief,
    timeline,
    summary: {
      events: googleEvents.length,
      tasks: tasks.length,
      tasksPending: tasks.filter(t => !t.completed).length,
      studyBlocks: studyBlocks.length,
      freeMinutes: totalFreeMinutes,
      suggestions: suggestions.length
    },
    conflicts,
    dailyIntention,
    suggestions,
    freeSlots
  })
}

function generateMorningBrief(data: BriefData): MorningBrief {
  const { googleEvents, totalFreeMinutes, pendingNotes, dailyIntention, streak } = data

  const freeHours = Math.floor(totalFreeMinutes / 60)
  const freeMinutesRemainder = totalFreeMinutes % 60

  const messages: string[] = []

  // Events summary
  if (googleEvents.length === 0) {
    messages.push('No tienes reuniones hoy. ¡Día libre para enfocarte!')
  } else if (googleEvents.length === 1) {
    messages.push(`Tienes 1 evento: "${googleEvents[0].summary}" a las ${googleEvents[0].startTime}`)
  } else {
    messages.push(`Tienes ${googleEvents.length} eventos hoy`)
  }

  // Free time
  if (freeHours > 0) {
    messages.push(`${freeHours}h ${freeMinutesRemainder > 0 ? `${freeMinutesRemainder}min` : ''} de tiempo libre disponible`)
  }

  // Pending notes
  if (pendingNotes.length > 0) {
    const areas = [...new Set(pendingNotes.map(n => n.area))]
    messages.push(`${pendingNotes.length} notas pendientes en ${areas.join(', ')}`)
  }

  // Streak
  if (streak > 0) {
    messages.push(`🔥 Racha: ${streak} días`)
  }

  return {
    greeting: getGreeting(),
    messages,
    dailyIntention,
    quickStats: {
      events: googleEvents.length,
      freeTime: `${freeHours}h ${freeMinutesRemainder}min`,
      pendingNotes: pendingNotes.length,
      streak
    }
  }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '¡Buenos días!'
  if (hour < 18) return '¡Buenas tardes!'
  return '¡Buenas noches!'
}
```

### UI Component: Daily Plan View

```typescript
// src/components/calendar/DailyPlanView.tsx

'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sun, Moon, Calendar, Clock, CheckSquare, BookOpen,
  ChevronRight, Sparkles, Target, AlertTriangle
} from 'lucide-react'

export function DailyPlanView() {
  const { data: plan, isLoading } = useQuery({
    queryKey: ['daily-plan'],
    queryFn: () => fetch('/api/calendar/daily-plan').then(r => r.json())
  })

  if (isLoading) {
    return <DailyPlanSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Morning Brief Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
            <Sun className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{plan.brief.greeting}</h2>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatBadge
            icon={<Calendar className="w-4 h-4" />}
            value={plan.brief.quickStats.events}
            label="Eventos"
            color="blue"
          />
          <StatBadge
            icon={<Clock className="w-4 h-4" />}
            value={plan.brief.quickStats.freeTime}
            label="Libre"
            color="green"
          />
          <StatBadge
            icon={<BookOpen className="w-4 h-4" />}
            value={plan.brief.quickStats.pendingNotes}
            label="Notas"
            color="purple"
          />
          <StatBadge
            icon={<Sparkles className="w-4 h-4" />}
            value={`${plan.brief.quickStats.streak}🔥`}
            label="Racha"
            color="orange"
          />
        </div>

        {/* Daily Intention */}
        {plan.brief.dailyIntention && (
          <div className="p-3 rounded-xl bg-white/50 border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-purple-600">Intención del día</span>
            </div>
            <p className="text-sm text-gray-700">{plan.brief.dailyIntention}</p>
          </div>
        )}

        {/* Messages */}
        <div className="mt-4 space-y-1">
          {plan.brief.messages.map((msg: string, i: number) => (
            <p key={i} className="text-sm text-gray-600">• {msg}</p>
          ))}
        </div>
      </div>

      {/* Conflicts Alert */}
      {plan.conflicts.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-medium text-red-700">Conflictos detectados</h3>
          </div>
          {plan.conflicts.map((conflict: any, i: number) => (
            <div key={i} className="text-sm text-red-600 mb-1">
              • {conflict.event1.title} y {conflict.event2.title} a las {conflict.time}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">Tu día</h3>

        <div className="relative">
          {/* Time line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-3">
            {plan.timeline.map((item: TimelineItem, i: number) => (
              <TimelineBlock key={i} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {plan.suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Sugerencias</h3>
            <span className="text-xs text-gray-500">
              Para tu tiempo libre
            </span>
          </div>

          <div className="space-y-2">
            {plan.suggestions.slice(0, 3).map((suggestion: any, i: number) => (
              <SuggestionCard key={i} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button className="flex-1 py-3 px-4 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-all">
          Aceptar Plan
        </button>
        <button className="py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all">
          Personalizar
        </button>
      </div>
    </div>
  )
}

function TimelineBlock({ item }: { item: TimelineItem }) {
  const typeConfig = {
    google: { bg: 'bg-blue-100', border: 'border-blue-200', icon: Calendar, color: 'text-blue-600' },
    study: { bg: 'bg-purple-100', border: 'border-purple-200', icon: BookOpen, color: 'text-purple-600' },
    task: { bg: 'bg-green-100', border: 'border-green-200', icon: CheckSquare, color: 'text-green-600' },
    free: { bg: 'bg-gray-50', border: 'border-gray-200', icon: Clock, color: 'text-gray-400' },
    suggestion: { bg: 'bg-orange-50', border: 'border-orange-200', icon: Sparkles, color: 'text-orange-500' }
  }

  const config = typeConfig[item.type] || typeConfig.free
  const Icon = config.icon

  return (
    <div className="relative pl-10">
      {/* Dot on timeline */}
      <div className={`absolute left-2.5 w-3 h-3 rounded-full ${config.bg} border-2 ${config.border}`} />

      <div className={`p-3 rounded-xl ${config.bg} border ${config.border}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${config.color}`} />
            <span className="font-medium text-sm text-gray-800">{item.title}</span>
          </div>
          <span className="text-xs text-gray-500">{item.time}</span>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500">{item.description}</p>
        )}
        {item.duration && (
          <span className="text-xs text-gray-400">{item.duration} min</span>
        )}
      </div>
    </div>
  )
}

function StatBadge({ icon, value, label, color }: StatBadgeProps) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  }

  return (
    <div className={`p-2 rounded-xl ${colors[color]} text-center`}>
      <div className="flex items-center justify-center mb-1">
        {icon}
      </div>
      <p className="font-bold text-sm">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  )
}
```

---

## 3. Habit Stacking & Routines

### Concepto
Sistema para crear rutinas recurrentes que se vinculan al calendario y trackean consistency. Basado en el concepto de "habit stacking" de Atomic Habits.

### Database Schema

```sql
-- =============================================
-- ROUTINES (Conjunto de hábitos)
-- =============================================
CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Schedule
  time_of_day TIME NOT NULL, -- Hora de inicio
  duration_minutes INTEGER NOT NULL, -- Duración total
  days_of_week INTEGER[] NOT NULL, -- [1,2,3,4,5] = Lun-Vie

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Tracking
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  total_completions INTEGER DEFAULT 0,
  last_completed_at TIMESTAMP,

  -- Reminder
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_minutes_before INTEGER DEFAULT 15,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- HABITS (Hábitos dentro de rutinas)
-- =============================================
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  area VARCHAR(100), -- Linked to life area

  -- Order within routine
  order_index INTEGER NOT NULL,

  -- Optional: Link to action
  action_type VARCHAR(50), -- 'open_journal', 'open_note', 'external_link', 'timer'
  action_data JSONB, -- { noteId: '...', url: '...' }

  -- Icon/emoji
  icon VARCHAR(10),

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- HABIT COMPLETIONS (Log de completaciones)
-- =============================================
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  completed_at TIMESTAMP DEFAULT NOW(),

  -- Optional notes
  notes TEXT,
  mood INTEGER, -- 1-5

  UNIQUE(habit_id, date)
);

-- =============================================
-- ROUTINE COMPLETIONS (Rutina completa)
-- =============================================
CREATE TABLE routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Stats
  habits_completed INTEGER,
  total_habits INTEGER,
  completion_rate DECIMAL(3,2),

  UNIQUE(routine_id, date)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_habits_routine ON habits(routine_id, order_index);
CREATE INDEX idx_habit_completions_date ON habit_completions(user_id, date);
CREATE INDEX idx_routine_completions_date ON routine_completions(user_id, date);
```

### API Endpoints

```typescript
// src/app/api/routines/route.ts

// GET - List user's routines
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { data: routines } = await supabase
    .from('routines')
    .select(`
      *,
      habits (*)
    `)
    .eq('user_id', session.user.id)
    .order('time_of_day')

  // Add today's completion status
  const today = formatDateStr(new Date())
  const routinesWithStatus = await Promise.all(
    routines.map(async (routine) => {
      const completion = await getRoutineCompletion(routine.id, today)
      return {
        ...routine,
        todayStatus: completion ? {
          completed: completion.completion_rate === 1,
          habitsCompleted: completion.habits_completed,
          totalHabits: completion.total_habits
        } : null
      }
    })
  )

  return NextResponse.json({ routines: routinesWithStatus })
}

// POST - Create routine
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { name, description, timeOfDay, durationMinutes, daysOfWeek, habits } = await request.json()

  // Create routine
  const { data: routine } = await supabase
    .from('routines')
    .insert({
      user_id: session.user.id,
      name,
      description,
      time_of_day: timeOfDay,
      duration_minutes: durationMinutes,
      days_of_week: daysOfWeek
    })
    .select()
    .single()

  // Create habits
  const habitsWithOrder = habits.map((h: any, i: number) => ({
    routine_id: routine.id,
    name: h.name,
    duration_minutes: h.duration,
    area: h.area,
    order_index: i,
    action_type: h.actionType,
    action_data: h.actionData,
    icon: h.icon
  }))

  await supabase.from('habits').insert(habitsWithOrder)

  return NextResponse.json({ routine })
}
```

```typescript
// src/app/api/routines/[id]/complete/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { habitId, date } = await request.json()
  const routineId = params.id

  // Mark habit as complete
  await supabase.from('habit_completions').upsert({
    habit_id: habitId,
    routine_id: routineId,
    user_id: session.user.id,
    date
  })

  // Check if all habits in routine are complete
  const { data: routine } = await supabase
    .from('routines')
    .select('*, habits(*)')
    .eq('id', routineId)
    .single()

  const { data: completions } = await supabase
    .from('habit_completions')
    .select('*')
    .eq('routine_id', routineId)
    .eq('date', date)

  const habitsCompleted = completions.length
  const totalHabits = routine.habits.length
  const isComplete = habitsCompleted === totalHabits

  // Update or create routine completion
  await supabase.from('routine_completions').upsert({
    routine_id: routineId,
    user_id: session.user.id,
    date,
    habits_completed: habitsCompleted,
    total_habits: totalHabits,
    completion_rate: habitsCompleted / totalHabits,
    completed_at: isComplete ? new Date().toISOString() : null
  })

  // Update streak if complete
  if (isComplete) {
    await updateRoutineStreak(routineId)
  }

  return NextResponse.json({
    habitsCompleted,
    totalHabits,
    isComplete,
    streak: routine.current_streak
  })
}

async function updateRoutineStreak(routineId: string) {
  // Get recent completions
  const { data: completions } = await supabase
    .from('routine_completions')
    .select('date, completion_rate')
    .eq('routine_id', routineId)
    .eq('completion_rate', 1)
    .order('date', { ascending: false })
    .limit(100)

  // Calculate streak
  let streak = 0
  const today = new Date()

  for (let i = 0; i < completions.length; i++) {
    const expectedDate = new Date(today)
    expectedDate.setDate(today.getDate() - i)
    const expectedDateStr = formatDateStr(expectedDate)

    if (completions.some(c => c.date === expectedDateStr)) {
      streak++
    } else {
      break
    }
  }

  // Update routine
  const { data: routine } = await supabase
    .from('routines')
    .select('best_streak')
    .eq('id', routineId)
    .single()

  await supabase
    .from('routines')
    .update({
      current_streak: streak,
      best_streak: Math.max(streak, routine.best_streak),
      last_completed_at: new Date().toISOString()
    })
    .eq('id', routineId)
}
```

### UI Components

```typescript
// src/components/calendar/RoutineCard.tsx

'use client'

import { useState } from 'react'
import { Play, CheckCircle, Circle, Clock, Flame, ChevronDown, ChevronUp } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Routine {
  id: string
  name: string
  time_of_day: string
  duration_minutes: number
  current_streak: number
  habits: Habit[]
  todayStatus: {
    completed: boolean
    habitsCompleted: number
    totalHabits: number
  } | null
}

interface Habit {
  id: string
  name: string
  duration_minutes: number
  area: string
  icon: string
  completed?: boolean
}

export function RoutineCard({ routine }: { routine: Routine }) {
  const [expanded, setExpanded] = useState(false)
  const [activeHabit, setActiveHabit] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const completeHabit = useMutation({
    mutationFn: async (habitId: string) => {
      return fetch(`/api/routines/${routine.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          habitId,
          date: formatDateStr(new Date())
        })
      }).then(r => r.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
    }
  })

  const isScheduledNow = isTimeNow(routine.time_of_day, routine.duration_minutes)
  const completionPercent = routine.todayStatus
    ? (routine.todayStatus.habitsCompleted / routine.todayStatus.totalHabits) * 100
    : 0

  return (
    <div className={`rounded-2xl border transition-all ${
      isScheduledNow ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              routine.todayStatus?.completed ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {routine.todayStatus?.completed ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Clock className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{routine.name}</h3>
              <p className="text-xs text-gray-500">
                {routine.time_of_day} • {routine.duration_minutes} min
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak */}
            {routine.current_streak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-600">
                  {routine.current_streak}
                </span>
              </div>
            )}

            {/* Progress */}
            {routine.todayStatus && !routine.todayStatus.completed && (
              <div className="text-sm text-gray-500">
                {routine.todayStatus.habitsCompleted}/{routine.todayStatus.totalHabits}
              </div>
            )}

            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        {routine.todayStatus && !routine.todayStatus.completed && (
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Expanded: Habit list */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-4 space-y-2">
            {routine.habits.map((habit, index) => {
              const isCompleted = routine.todayStatus?.habitsCompleted > index
              const isActive = activeHabit === habit.id

              return (
                <div
                  key={habit.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isCompleted ? 'bg-green-50 border-green-200' :
                    isActive ? 'bg-purple-50 border-purple-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{habit.icon}</span>
                      <div>
                        <p className={`font-medium text-sm ${
                          isCompleted ? 'text-green-700 line-through' : 'text-gray-800'
                        }`}>
                          {habit.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {habit.duration_minutes} min • {habit.area}
                        </p>
                      </div>
                    </div>

                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isActive) {
                            completeHabit.mutate(habit.id)
                            setActiveHabit(null)
                          } else {
                            setActiveHabit(habit.id)
                          }
                        }}
                        className={`p-2 rounded-lg transition-all ${
                          isActive ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Timer when active */}
                  {isActive && (
                    <div className="mt-3 p-2 bg-purple-100 rounded-lg">
                      <HabitTimer
                        duration={habit.duration_minutes}
                        onComplete={() => {
                          completeHabit.mutate(habit.id)
                          setActiveHabit(null)
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Start routine button */}
          {!routine.todayStatus?.completed && !activeHabit && (
            <button
              onClick={() => setActiveHabit(routine.habits[0]?.id)}
              className="mt-4 w-full py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Iniciar Rutina
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function HabitTimer({ duration, onComplete }: { duration: number; onComplete: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(duration * 60)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [onComplete])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <div className="text-center">
      <p className="text-2xl font-mono font-bold text-purple-700">
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </p>
      <p className="text-xs text-purple-600">En progreso...</p>
    </div>
  )
}
```

```typescript
// src/components/calendar/CreateRoutineModal.tsx

'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, X } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const DAYS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' }
]

const AREAS = [
  { value: 'profesional', label: 'Profesional', icon: '💼' },
  { value: 'salud', label: 'Salud', icon: '🏃' },
  { value: 'finanzas', label: 'Finanzas', icon: '💰' },
  { value: 'relaciones', label: 'Relaciones', icon: '❤️' },
  { value: 'hobbies', label: 'Hobbies', icon: '🎨' },
  { value: 'educacion', label: 'Educación', icon: '📚' },
  { value: 'personal', label: 'Personal', icon: '🌱' }
]

const HABIT_PRESETS = [
  { name: 'Journaling', duration: 15, area: 'personal', icon: '📝' },
  { name: 'Meditación', duration: 10, area: 'salud', icon: '🧘' },
  { name: 'Lectura', duration: 30, area: 'educacion', icon: '📖' },
  { name: 'Ejercicio', duration: 30, area: 'salud', icon: '🏋️' },
  { name: 'Revisión de finanzas', duration: 15, area: 'finanzas', icon: '💹' },
  { name: 'Estudio', duration: 45, area: 'educacion', icon: '📚' },
  { name: 'Planificación', duration: 10, area: 'profesional', icon: '📋' }
]

export function CreateRoutineModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('07:00')
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5])
  const [habits, setHabits] = useState<Habit[]>([])

  const totalDuration = habits.reduce((acc, h) => acc + h.duration, 0)

  const addHabit = (preset?: typeof HABIT_PRESETS[0]) => {
    setHabits([...habits, {
      id: Date.now().toString(),
      name: preset?.name || '',
      duration: preset?.duration || 15,
      area: preset?.area || 'personal',
      icon: preset?.icon || '✨'
    }])
  }

  const removeHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id))
  }

  const updateHabit = (id: string, field: string, value: any) => {
    setHabits(habits.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return
    const items = Array.from(habits)
    const [reordered] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reordered)
    setHabits(items)
  }

  const handleCreate = () => {
    onCreate({
      name,
      timeOfDay,
      durationMinutes: totalDuration,
      daysOfWeek: selectedDays,
      habits: habits.map((h, i) => ({
        name: h.name,
        duration: h.duration,
        area: h.area,
        icon: h.icon,
        actionType: h.actionType,
        actionData: h.actionData
      }))
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Crear Rutina</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Nombre de la rutina
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Rutina Matutina"
              className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Hora de inicio
            </label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Days */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Días de la semana
            </label>
            <div className="flex gap-2">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => {
                    setSelectedDays(
                      selectedDays.includes(day.value)
                        ? selectedDays.filter(d => d !== day.value)
                        : [...selectedDays, day.value]
                    )
                  }}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${
                    selectedDays.includes(day.value)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Habit Presets */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Agregar hábito rápido
            </label>
            <div className="flex flex-wrap gap-2">
              {HABIT_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => addHabit(preset)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-sm hover:bg-gray-200 transition-all"
                >
                  {preset.icon} {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Habits List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Hábitos ({habits.length})
              </label>
              <span className="text-sm text-gray-500">
                Total: {totalDuration} min
              </span>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="habits">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {habits.map((habit, index) => (
                      <Draggable key={habit.id} draggableId={habit.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="p-3 rounded-xl border bg-white"
                          >
                            <div className="flex items-center gap-2">
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="w-4 h-4 text-gray-400" />
                              </div>

                              <input
                                type="text"
                                value={habit.icon}
                                onChange={(e) => updateHabit(habit.id, 'icon', e.target.value)}
                                className="w-10 text-center"
                              />

                              <input
                                type="text"
                                value={habit.name}
                                onChange={(e) => updateHabit(habit.id, 'name', e.target.value)}
                                placeholder="Nombre del hábito"
                                className="flex-1 px-2 py-1 rounded border text-sm"
                              />

                              <input
                                type="number"
                                value={habit.duration}
                                onChange={(e) => updateHabit(habit.id, 'duration', parseInt(e.target.value))}
                                className="w-16 px-2 py-1 rounded border text-sm text-center"
                                min={1}
                              />
                              <span className="text-xs text-gray-500">min</span>

                              <button
                                onClick={() => removeHabit(habit.id)}
                                className="p-1 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <button
              onClick={() => addHabit()}
              className="mt-2 w-full py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar hábito personalizado
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border text-gray-600 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || habits.length === 0}
            className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            Crear Rutina
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Resumen de Implementación

### Semana 1-2: Time Blocking Inteligente
- [ ] Database schema para study_blocks
- [ ] API `/api/calendar/suggest-blocks`
- [ ] Lógica de detección de slots libres
- [ ] Algoritmo de scoring basado en energía
- [ ] UI de sugerencias de bloques
- [ ] Crear/aceptar bloques

### Semana 3-4: Daily Planning Assistant
- [ ] API `/api/calendar/daily-plan`
- [ ] Morning brief generation
- [ ] Timeline builder
- [ ] Conflict detection
- [ ] UI de plan del día
- [ ] Integración con journal

### Semana 5-6: Habit Stacking & Routines
- [ ] Database schema para routines/habits
- [ ] APIs CRUD de rutinas
- [ ] Sistema de streaks
- [ ] UI de creación de rutinas
- [ ] UI de ejecución con timer
- [ ] Calendario de consistencia

---

Esta implementación detallada proporciona todo lo necesario para construir los 3 primeros features del Calendar Enhancement.
