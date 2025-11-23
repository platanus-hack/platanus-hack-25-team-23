"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useKnowledge } from './knowledge-context'

export interface JournalTask {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface JournalEntry {
  id: string
  user_id: string
  date: string // Format: "2025-11-22"
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'

  // Morning Section
  gratitude: string[]
  daily_intention: string
  make_great: string[]

  // Night Section
  best_moments: string[]
  lesson: string

  // Free Thoughts
  free_thoughts: string

  // Quote
  quote: {
    text: string
    author: string
  } | null

  // Tasks
  tasks: JournalTask[]

  // Metadata
  mood: number | null
  is_complete: boolean

  // Weekly specific
  weekly_gratitude: string[] | null
  highlights: string[] | null
  weekly_lesson: string | null
  to_improve: string | null

  // Monthly specific
  big_wins: string[] | null
  kpis: {
    mindset: number
    energy: number
    relationships: number
    finances: number
    learning: number
  } | null
  monthly_lesson: string | null
  adjustments: string | null

  // Yearly specific
  word_of_year: string | null
  vision_statement: string | null
  smart_goals: {
    area: string
    goal: string
    metric: string
  }[] | null
  yearly_reflection: {
    grateful_people: string
    achievements: string
    lessons_learned: string
    next_year_intentions: string
  } | null

  created_at: string
  updated_at: string
}

interface JournalContextType {
  entries: JournalEntry[]
  currentEntry: JournalEntry | null
  isLoading: boolean
  isSaving: boolean

  // CRUD
  getEntry: (date: string, type?: JournalEntry['type']) => JournalEntry | null
  createOrUpdateEntry: (date: string, updates: Partial<JournalEntry>, type?: JournalEntry['type']) => Promise<void>
  deleteEntry: (date: string, type?: JournalEntry['type']) => Promise<void>

  // Load
  loadEntry: (date: string, type?: JournalEntry['type']) => Promise<JournalEntry | null>
  loadEntries: (month?: string) => Promise<void>

  // Navigation
  getAdjacentDates: (date: string, allowFuture?: boolean) => { prev: string | null; next: string | null }

  // Stats
  getStreak: () => number
  getCompletionRate: (month: string) => number

  // Quote
  fetchDailyQuote: () => Promise<{ text: string; author: string } | null>
}

const JournalContext = createContext<JournalContextType | undefined>(undefined)

// Helper to format date as YYYY-MM-DD
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Helper to parse date string
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

// Create empty entry template
function createEmptyEntry(date: string, type: JournalEntry['type'] = 'daily'): Partial<JournalEntry> {
  return {
    date,
    type,
    gratitude: ['', '', ''],
    daily_intention: '',
    make_great: ['', '', ''],
    best_moments: ['', '', ''],
    lesson: '',
    free_thoughts: '',
    quote: null,
    tasks: [],
    mood: null,
    is_complete: false,
  }
}

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { session } = useKnowledge()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load entries for a specific month
  const loadEntries = useCallback(async (month?: string) => {
    if (!session?.user) return

    setIsLoading(true)
    try {
      const supabase = createClient()

      let query = supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })

      if (month) {
        // Filter by month (YYYY-MM)
        const [year, monthNum] = month.split('-').map(Number)
        const startDate = `${month}-01`
        // Get the last day of the month correctly
        const lastDay = new Date(year, monthNum, 0).getDate()
        const endDate = `${month}-${String(lastDay).padStart(2, '0')}`
        query = query.gte('date', startDate).lte('date', endDate)
      }

      const { data, error } = await query.limit(100)

      if (error) {
        console.error('Error loading journal entries:', error)
        return
      }

      if (data) {
        setEntries(data as JournalEntry[])
      }
    } catch (error) {
      console.error('Error loading journal entries:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session])

  // Load a specific entry
  const loadEntry = useCallback(async (date: string, type: JournalEntry['type'] = 'daily'): Promise<JournalEntry | null> => {
    if (!session?.user) return null

    setIsLoading(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .eq('type', type)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading journal entry:', error)
        return null
      }

      if (data) {
        setCurrentEntry(data as JournalEntry)
        return data as JournalEntry
      }

      return null
    } catch (error) {
      console.error('Error loading journal entry:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [session])

  // Get entry from local state
  const getEntry = useCallback((date: string, type: JournalEntry['type'] = 'daily'): JournalEntry | null => {
    return entries.find(e => e.date === date && e.type === type) || null
  }, [entries])

  // Create or update entry
  const createOrUpdateEntry = useCallback(async (
    date: string,
    updates: Partial<JournalEntry>,
    type: JournalEntry['type'] = 'daily'
  ) => {
    if (!session?.user) return

    setIsSaving(true)
    try {
      const supabase = createClient()

      const entryData = {
        user_id: session.user.id,
        date,
        type,
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('journal_entries')
        .upsert(entryData, {
          onConflict: 'user_id,date,type'
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving journal entry:', error)
        return
      }

      if (data) {
        // Update local state
        setEntries(prev => {
          const existing = prev.findIndex(e => e.date === date && e.type === type)
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = data as JournalEntry
            return updated
          }
          return [data as JournalEntry, ...prev]
        })
        setCurrentEntry(data as JournalEntry)
      }
    } catch (error) {
      console.error('Error saving journal entry:', error)
    } finally {
      setIsSaving(false)
    }
  }, [session])

  // Delete entry
  const deleteEntry = useCallback(async (date: string, type: JournalEntry['type'] = 'daily') => {
    if (!session?.user) return

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('user_id', session.user.id)
        .eq('date', date)
        .eq('type', type)

      if (error) {
        console.error('Error deleting journal entry:', error)
        return
      }

      // Update local state
      setEntries(prev => prev.filter(e => !(e.date === date && e.type === type)))
      if (currentEntry?.date === date && currentEntry?.type === type) {
        setCurrentEntry(null)
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error)
    }
  }, [session, currentEntry])

  // Get adjacent dates for navigation
  // allowFuture: allow navigating to future dates (for task planning)
  const getAdjacentDates = useCallback((date: string, allowFuture: boolean = false): { prev: string | null; next: string | null } => {
    const current = parseDate(date)
    const prev = new Date(current)
    prev.setDate(prev.getDate() - 1)
    const next = new Date(current)
    next.setDate(next.getDate() + 1)

    // Limit future dates to 30 days ahead for planning
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const maxFutureDate = new Date(today)
    maxFutureDate.setDate(maxFutureDate.getDate() + 30)

    return {
      prev: formatDate(prev),
      next: allowFuture ? (next <= maxFutureDate ? formatDate(next) : null) : (next <= today ? formatDate(next) : null)
    }
  }, [])

  // Calculate streak
  const getStreak = useCallback((): number => {
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sortedEntries = [...entries]
      .filter(e => e.type === 'daily' && e.is_complete)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const dateStr = formatDate(checkDate)

      const hasEntry = sortedEntries.some(e => e.date === dateStr)

      if (hasEntry) {
        streak++
      } else if (i > 0) {
        break
      }
    }

    return streak
  }, [entries])

  // Calculate completion rate for a month
  const getCompletionRate = useCallback((month: string): number => {
    const monthEntries = entries.filter(e =>
      e.date.startsWith(month) && e.type === 'daily'
    )

    if (monthEntries.length === 0) return 0

    const completed = monthEntries.filter(e => e.is_complete).length
    const daysInMonth = new Date(
      parseInt(month.split('-')[0]),
      parseInt(month.split('-')[1]),
      0
    ).getDate()

    return Math.round((completed / daysInMonth) * 100)
  }, [entries])

  // Collection of inspirational quotes for daily motivation
  const inspirationalQuotes = [
    // Success & Achievement
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },

    // Growth & Learning
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },

    // Mindset & Attitude
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Your limitation—it's only your imagination.", author: "Unknown" },
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
    { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },

    // Action & Persistence
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },

    // Resilience & Strength
    { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
    { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
    { text: "Strength does not come from winning. Your struggles develop your strengths.", author: "Arnold Schwarzenegger" },
    { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
    { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },

    // Focus & Clarity
    { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
    { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
    { text: "Clarity precedes success.", author: "Robin Sharma" },
    { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
    { text: "You can do anything, but not everything.", author: "David Allen" },

    // Gratitude & Positivity
    { text: "Gratitude turns what we have into enough.", author: "Aesop" },
    { text: "The more you praise and celebrate your life, the more there is in life to celebrate.", author: "Oprah Winfrey" },
    { text: "Every day may not be good, but there's something good in every day.", author: "Alice Morse Earle" },
    { text: "When you arise in the morning, think of what a precious privilege it is to be alive.", author: "Marcus Aurelius" },
    { text: "Enjoy the little things, for one day you may look back and realize they were the big things.", author: "Robert Brault" },

    // Self-Improvement
    { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
    { text: "The only way to discover the limits of the possible is to go beyond them into the impossible.", author: "Arthur C. Clarke" },
    { text: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", author: "Rumi" },
    { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
    { text: "To improve is to change; to be perfect is to change often.", author: "Winston Churchill" },

    // Dreams & Vision
    { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
    { text: "All our dreams can come true, if we have the courage to pursue them.", author: "Walt Disney" },
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "Vision without action is merely a dream. Action without vision just passes the time.", author: "Joel A. Barker" },
    { text: "Go confidently in the direction of your dreams. Live the life you have imagined.", author: "Henry David Thoreau" },

    // Balance & Wellbeing
    { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
    { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
    { text: "Rest when you're weary. Refresh and renew yourself. Then get back to work.", author: "Ralph Marston" },
    { text: "Self-care is not selfish. You cannot serve from an empty vessel.", author: "Eleanor Brown" },
    { text: "Balance is not something you find, it's something you create.", author: "Jana Kingsford" },
  ]

  // Fetch daily quote - returns a random inspirational quote
  const fetchDailyQuote = useCallback(async (): Promise<{ text: string; author: string } | null> => {
    // Select a random quote from our collection
    const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length)
    return inspirationalQuotes[randomIndex]
  }, [])

  // Load entries on mount
  useEffect(() => {
    if (session?.user) {
      const currentMonth = formatDate(new Date()).substring(0, 7)
      loadEntries(currentMonth)
    }
  }, [session, loadEntries])

  const value: JournalContextType = React.useMemo(() => ({
    entries,
    currentEntry,
    isLoading,
    isSaving,
    getEntry,
    createOrUpdateEntry,
    deleteEntry,
    loadEntry,
    loadEntries,
    getAdjacentDates,
    getStreak,
    getCompletionRate,
    fetchDailyQuote,
  }), [entries, currentEntry, isLoading, isSaving, getEntry, createOrUpdateEntry, deleteEntry, loadEntry, loadEntries, getAdjacentDates, getStreak, getCompletionRate, fetchDailyQuote])

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  )
}

export function useJournal() {
  const context = useContext(JournalContext)
  if (context === undefined) {
    throw new Error('useJournal must be used within a JournalProvider')
  }
  return context
}
