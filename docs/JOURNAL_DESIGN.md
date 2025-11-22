# Journal System - Design Document

## Overview

Sistema de journaling integrado que combina **Bullet Journal + 5 Minute Journal** con plantillas para Daily, Weekly, Monthly y Yearly. Cada entrada se guarda como un nodo accesible desde la biblioteca y el grafo.

---

## 1. Estructura de Archivos

### Rutas Nuevas

```
src/app/(main)/
├── journal/
│   ├── page.tsx              # Vista principal del journal (redirige al día actual)
│   ├── [date]/
│   │   └── page.tsx          # Vista de un día específico (2025-11-22)
│   ├── weekly/
│   │   └── [week]/
│   │       └── page.tsx      # Vista semanal (2025-W47)
│   ├── monthly/
│   │   └── [month]/
│   │       └── page.tsx      # Vista mensual (2025-11)
│   └── yearly/
│       └── [year]/
│           └── page.tsx      # Vista anual (2025)
```

### Componentes Nuevos

```
src/components/journal/
├── DailyTemplate.tsx         # Template del día con todas las secciones
├── WeeklyTemplate.tsx        # Template semanal
├── MonthlyTemplate.tsx       # Template mensual
├── YearlyTemplate.tsx        # Template anual
├── JournalEditor.tsx         # Editor inline para escribir
├── JournalNavigation.tsx     # Navegación prev/next día
├── GratitudeSection.tsx      # Sección reutilizable de gratitudes
├── QuoteOfTheDay.tsx         # Frase motivacional del día
└── JournalCalendarMini.tsx   # Mini calendario para seleccionar fecha
```

---

## 2. Modelo de Datos

### Contexto: JournalContext

```typescript
// src/lib/store/journal-context.tsx

interface JournalEntry {
  id: string
  date: string                    // Format: "2025-11-22"
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'

  // Morning Section (Daily)
  gratitude: string[]             // 3 items
  dailyIntention: string          // 1 main focus
  makeGreat: string[]             // 3 things that will make today great

  // Night Section (Daily)
  bestMoments: string[]           // 3 best moments
  lesson: string                  // 1 lesson learned

  // Quote
  quote?: {
    text: string
    author: string
  }

  // Metadata
  createdAt: string
  updatedAt: string
  isComplete: boolean             // Has morning + night filled
  mood?: number                   // 1-5 scale

  // Weekly/Monthly specific (optional)
  weeklyGratitude?: string[]      // 5 items
  highlights?: string[]           // 3 items
  weeklyLesson?: string
  toImprove?: string

  // Monthly specific
  bigWins?: string[]              // 5 items
  kpis?: {
    mindset: number
    energy: number
    relationships: number
    finances: number
    learning: number
  }
  monthlyLesson?: string
  adjustments?: string

  // Yearly specific
  wordOfYear?: string
  visionStatement?: string
  smartGoals?: {
    area: string
    goal: string
    metric: string
  }[]
  yearlyReflection?: {
    gratefulPeople: string
    achievements: string
    lessonsLearned: string
    nextYearIntentions: string
  }
}

interface JournalContextType {
  entries: JournalEntry[]
  currentEntry: JournalEntry | null

  // CRUD
  getEntry: (date: string) => JournalEntry | null
  createEntry: (date: string, type: JournalEntry['type']) => JournalEntry
  updateEntry: (date: string, updates: Partial<JournalEntry>) => void
  deleteEntry: (date: string) => void

  // Navigation
  getAdjacentDates: (date: string) => { prev: string | null, next: string | null }

  // Stats
  getStreak: () => number
  getCompletionRate: (month: string) => number
}
```

### Almacenamiento

**Opción A: localStorage (sin auth)**
```typescript
const STORAGE_KEY = 'brainflow_journal'

// Guardar
localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))

// Cargar
const saved = localStorage.getItem(STORAGE_KEY)
```

**Opción B: Supabase (con auth)**
```sql
-- Nueva tabla: journal_entries
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'daily',
  content JSONB NOT NULL,
  is_complete BOOLEAN DEFAULT FALSE,
  mood INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, type)
);

-- Índices
CREATE INDEX idx_journal_user_date ON journal_entries(user_id, date);
CREATE INDEX idx_journal_type ON journal_entries(type);
```

---

## 3. Vistas y Componentes

### 3.1 Dashboard - Acceso Rápido

**Ubicación**: Añadir en `/dashboard` un widget de Journal

```tsx
// Widget en Dashboard
<JournalQuickAccess>
  - Mostrar fecha de hoy
  - Botón "Ir al Journal de Hoy"
  - Mini preview: ¿Completaste morning/night?
  - Streak actual de días consecutivos
</JournalQuickAccess>
```

**Diseño visual:**
```
┌─────────────────────────────────────────┐
│ 📓 Journal de Hoy                       │
│                                         │
│ 📅 Viernes, 22 de Noviembre            │
│                                         │
│ ☀️ Morning  [✓ Completado]              │
│ 🌙 Night    [○ Pendiente]               │
│                                         │
│ 🔥 Racha: 5 días                        │
│                                         │
│ [    Abrir Journal de Hoy    ]          │
└─────────────────────────────────────────┘
```

### 3.2 Sidebar - Nuevo Item

```tsx
// En menuItems del Sidebar
{ id: 'journal', label: 'Journal', icon: BookHeart, href: '/journal' }
```

### 3.3 Vista Principal del Journal (`/journal`)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Anterior    📅 22 de Noviembre, 2025    Siguiente →      │
│                                                              │
│  [Daily] [Weekly] [Monthly] [Yearly]  <- Tabs               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ## 🌅 Morning                                               │
│                                                              │
│  ### 🙏 Gratitude (3)                                        │
│  1. [___________________________________]                    │
│  2. [___________________________________]                    │
│  3. [___________________________________]                    │
│                                                              │
│  ### 🎯 Daily Intention                                      │
│  → [___________________________________]                     │
│                                                              │
│  ### ✨ What will make today great?                          │
│  1. [___________________________________]                    │
│  2. [___________________________________]                    │
│  3. [___________________________________]                    │
│                                                              │
│  ─────────────────────────────────────────                   │
│                                                              │
│  ### 🌟 Daily Quote                                          │
│  > "The only way to do great work is to love what you do."  │
│  > — Steve Jobs                                              │
│                                                              │
│  ─────────────────────────────────────────                   │
│                                                              │
│  ## 🌙 Night                                                 │
│                                                              │
│  ### 💎 Best moments of the day                              │
│  1. [___________________________________]                    │
│  2. [___________________________________]                    │
│  3. [___________________________________]                    │
│                                                              │
│  ### 📌 Lesson learned                                       │
│  → [___________________________________]                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [Guardado automáticamente ✓]           [Marcar completado] │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Integración con Biblioteca

Los journals aparecen en la biblioteca como una carpeta especial:

```
📚 Biblioteca
├── 📁 Desarrollo Profesional
├── 📁 Salud y Bienestar
├── ...
└── 📓 Journal                    <- Nueva carpeta especial
    ├── 📅 2025
    │   ├── Noviembre
    │   │   ├── 2025-11-22
    │   │   ├── 2025-11-21
    │   │   └── ...
    │   └── W47 (Semanal)
    └── Anual 2025
```

### 3.5 Integración con Grafo

Cada journal entry es un nodo conectado:

```
         [Yo]
          │
    ┌─────┼─────┐
    │     │     │
  [Áreas] │  [Journal]
          │     │
          │   ┌─┴─┐
          │ [Nov] [Dic]
          │   │
          │ [22][21][20]...
```

---

## 4. Features Especiales

### 4.1 Frase del Día (Quote API)

```typescript
// Usar ZenQuotes API (gratis)
const fetchDailyQuote = async () => {
  const response = await fetch('https://zenquotes.io/api/today')
  const [quote] = await response.json()
  return {
    text: quote.q,
    author: quote.a
  }
}
```

### 4.2 Auto-guardado

```typescript
// Guardar automáticamente cada 2 segundos de inactividad
const debouncedSave = useDebouncedCallback((entry) => {
  updateEntry(entry.date, entry)
}, 2000)
```

### 4.3 Navegación por Teclado

```typescript
// Atajos de teclado
useHotkeys('ctrl+left', () => goToPreviousDay())
useHotkeys('ctrl+right', () => goToNextDay())
useHotkeys('ctrl+t', () => goToToday())
```

### 4.4 Estadísticas y Streak

```typescript
const calculateStreak = (entries: JournalEntry[]) => {
  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) {
    const date = format(subDays(today, i), 'yyyy-MM-dd')
    const entry = entries.find(e => e.date === date)

    if (entry?.isComplete) {
      streak++
    } else if (i > 0) {
      break
    }
  }

  return streak
}
```

---

## 5. Plan de Implementación

### Fase 1: Core (MVP)
1. ✅ Crear JournalContext
2. ✅ Crear página `/journal` con Daily template
3. ✅ Navegación prev/next día
4. ✅ Auto-guardado en localStorage
5. ✅ Acceso rápido en Dashboard

### Fase 2: Templates Adicionales
1. Weekly template
2. Monthly template
3. Yearly template
4. Tabs para cambiar entre tipos

### Fase 3: Integraciones
1. Quote API
2. Integración con Biblioteca
3. Nodos en Grafo
4. Sincronización con Supabase (opcional)

### Fase 4: Polish
1. Estadísticas y streak
2. Mini calendario para navegación
3. Exportar a Markdown
4. Atajos de teclado

---

## 6. Dependencias Nuevas

```json
{
  "date-fns": "^2.30.0",        // Ya instalado probablemente
  "use-debounce": "^10.0.0"     // Para auto-guardado
}
```

---

## 7. Variables de Entorno (Opcional)

```env
# Para Quote API (si usamos una que requiere key)
NEXT_PUBLIC_QUOTE_API_KEY=xxx
```

---

## 8. Mockups de Referencia

### Mobile-first responsive:

```
┌──────────────────────┐
│ ← 22 Nov 2025 →      │
│ [D] [W] [M] [Y]      │
├──────────────────────┤
│ 🌅 Morning           │
│                      │
│ 🙏 Gratitude         │
│ 1. _______________   │
│ 2. _______________   │
│ 3. _______________   │
│                      │
│ 🎯 Intention         │
│ → _______________    │
│                      │
│ ...                  │
└──────────────────────┘
```

---

## Próximos Pasos

1. **Aprobar este diseño** ✓
2. Crear `JournalContext`
3. Crear página base `/journal`
4. Implementar Daily template
5. Añadir a Sidebar y Dashboard
6. Testing y ajustes

---

*Documento creado: 2025-11-22*
*Última actualización: 2025-11-22*
