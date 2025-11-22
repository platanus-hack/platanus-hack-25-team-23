"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { noteSchema, NoteData } from '@/lib/ai/schema'

interface Note {
  id?: string
  title: string
  content: string
  slug: string
  status: 'new' | 'read' | 'understood'
  linkedTerms?: string[]
  prerequisites?: string[]
  nextSteps?: string[]
}

interface Edge {
  id: string
  source: string
  target: string
}

interface KnowledgeContextType {
  currentNote: Note | null
  streamingNote: Partial<NoteData> | null
  isLoading: boolean
  generateNote: (topic: string, parentTopic?: string) => Promise<void>
  notes: Note[]
  edges: Edge[]
  selectNote: (noteId: string) => void
  markAsUnderstood: (noteId: string) => void
  clearStreaming: () => void
  session: any
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined)

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  // const [isLoading, setIsLoading] = useState(false) // Replaced by useObject
  const [notes, setNotes] = useState<Note[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [session, setSession] = useState<any>(null)

  // Load user's notes from database when session changes
  const loadUserNotes = useCallback(async (userId: string) => {
    const supabase = createClient()

    // Load notes
    const { data: studyContent } = await supabase
      .from('study_content')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (studyContent) {
      const loadedNotes: Note[] = studyContent.map(sc => ({
        id: sc.id,
        title: sc.title,
        content: sc.content,
        slug: sc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'new' as const,
        linkedTerms: sc.linked_concepts || [],
        prerequisites: sc.prerequisites || [],
        nextSteps: sc.next_steps || [],
      }))
      setNotes(loadedNotes)
      if (loadedNotes.length > 0) {
        setCurrentNote(loadedNotes[0])
      }
    }

    // Load relationships/edges
    const { data: relationships } = await supabase
      .from('concept_relationships')
      .select('id, source_concept_id, target_concept_id')
      .eq('user_id', userId)

    if (relationships) {
      const loadedEdges: Edge[] = relationships.map(r => ({
        id: r.id,
        source: r.source_concept_id,
        target: r.target_concept_id,
      }))
      setEdges(loadedEdges)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadUserNotes(session.user.id)
      }
    })

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadUserNotes(session.user.id)
      } else {
        // Clear data when logged out
        setNotes([])
        setEdges([])
        setCurrentNote(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserNotes])

  const pendingParentTopic = React.useRef<string | undefined>(undefined)

  const { object, submit, isLoading: isGenerating, stop } = useObject({
    api: '/api/notes/generate',
    schema: noteSchema,
    onFinish: ({ object }: { object: any }) => {
      if (object) {
        const note: Note = {
          title: object.title || 'Generating...',
          content: object.content || '',
          slug: object.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp',
          status: 'new',
          linkedTerms: object.linkedTerms || [],
          prerequisites: object.prerequisites || [],
          nextSteps: object.nextSteps || []
        }
        setCurrentNote(note)
        setNotes(prev => {
          if (prev.some(n => n.slug === note.slug)) return prev
          return [...prev, note]
        })

        // Handle edges - create edges for linked terms
        if (pendingParentTopic.current) {
          const parentNote = notes.find(n => n.title === pendingParentTopic.current)
          if (parentNote) {
            const newEdge: Edge = {
              id: `${parentNote.id || parentNote.slug}-${note.slug}`,
              source: parentNote.id || parentNote.slug,
              target: note.slug
            }
            setEdges(prev => {
              if (prev.some(e => e.id === newEdge.id)) return prev
              return [...prev, newEdge]
            })
          }
        }

        // Create edges for linked terms (graph connections)
        if (object.linkedTerms && object.linkedTerms.length > 0) {
          const newEdges: Edge[] = object.linkedTerms.map((term: string) => ({
            id: `${note.slug}-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            source: note.slug,
            target: term.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          }))
          setEdges(prev => {
            const existingIds = new Set(prev.map(e => e.id))
            const uniqueNew = newEdges.filter(e => !existingIds.has(e.id))
            return [...prev, ...uniqueNew]
          })
        }

        pendingParentTopic.current = undefined
      }
    },
    onError: (error: any) => {
      console.error(error)
      toast.error("Failed to generate note")
      pendingParentTopic.current = undefined
    }
  })

  // Expose streaming object
  const streamingNote = object as Partial<NoteData> | null

  const clearStreaming = useCallback(() => {
    stop()
  }, [stop])

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
    // TODO: Re-enable auth check when login is implemented
    // if (!session) {
    //   toast.error("Please sign in to generate notes")
    //   return
    // }

    pendingParentTopic.current = parentTopic
    submit({ topic, parentTopic })
  }, [submit])

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
    <KnowledgeContext.Provider value={{ currentNote, streamingNote, isLoading, generateNote, notes, edges, selectNote, markAsUnderstood, clearStreaming, session }}>
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
