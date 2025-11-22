"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { noteSchema } from '@/lib/ai/schema'

interface Note {
  id?: string
  title: string
  content: string
  slug: string
  status: 'new' | 'read' | 'understood'
}

interface Edge {
  id: string
  source: string
  target: string
}

interface KnowledgeContextType {
  currentNote: Note | null
  isLoading: boolean
  generateNote: (topic: string, parentTopic?: string) => Promise<void>
  notes: Note[]
  edges: Edge[]
  selectNote: (noteId: string) => void
  markAsUnderstood: (noteId: string) => void
  session: any
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined)

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  // const [isLoading, setIsLoading] = useState(false) // Replaced by useObject
  const [notes, setNotes] = useState<Note[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const { object, submit, isLoading: isGenerating } = useObject({
    api: '/api/notes/generate',
    schema: noteSchema,
    onFinish: ({ object }: { object: any }) => {
      if (object) {
        const note: Note = {
          title: object.title || 'Generating...',
          content: object.content || '',
          slug: object.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp',
          status: 'new'
        }
        setCurrentNote(note)
        setNotes(prev => {
          if (prev.some(n => n.slug === note.slug)) return prev
          return [...prev, note]
        })
        
        // Handle edges (simplified for now as we don't have parent ID easily in stream)
      }
    },
    onError: (error: any) => {
      console.error(error)
      toast.error("Failed to generate note")
    }
  })

  // Sync streaming object to currentNote
  useEffect(() => {
    if (object) {
      const note: Note = {
        title: object.title || 'Generating...',
        content: object.content || '',
        slug: object.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp',
        status: 'new'
      }
      setCurrentNote(note)
    }
  }, [object])

  const generateNote = useCallback(async (topic: string, parentTopic?: string) => {
    if (!session) {
      toast.error("Please sign in to generate notes")
      return
    }
    
    submit({ topic, parentTopic })
  }, [session, submit])

  const isLoading = isGenerating // Map to context isLoading

  // ... rest of the provider

  const selectNote = useCallback((noteId: string) => {
    const note = notes.find(n => n.id === noteId || n.slug === noteId)
    if (note) setCurrentNote(note)
  }, [notes])

  const markAsUnderstood = useCallback(async (noteId: string) => {
    // Optimistic update
    setNotes(prev => prev.map(n => 
      (n.id === noteId || n.slug === noteId) ? { ...n, status: 'understood' } : n
    ))
    if (currentNote && (currentNote.id === noteId || currentNote.slug === noteId)) {
      setCurrentNote(prev => prev ? { ...prev, status: 'understood' } : null)
    }

    // API call would go here
  }, [currentNote])

  return (
    <KnowledgeContext.Provider value={{ currentNote, isLoading, generateNote, notes, edges, selectNote, markAsUnderstood, session }}>
      {children}
    </KnowledgeContext.Provider>
  )
}

export function useKnowledge() {
  const context = useContext(KnowledgeContext)
  if (context === undefined) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider')
  }
  return context
}
