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

    // Load notes from the VFS 'vfs_nodes' table
    const { data: notesData, error: notesError } = await supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'file') // Only load files, not directories
      .order('created_at', { ascending: false })

    if (notesError) {
      console.error('Error loading notes from VFS:', notesError)
    }

    if (notesData) {
      const loadedNotes: Note[] = notesData.map(n => ({
        id: n.id,
        title: n.name.replace(/\.md$/i, ''), // Remove .md extension for title
        content: n.content || '',
        slug: n.name.replace(/\.md$/i, ''), // Use filename without extension as slug
        status: 'new', // Default status as VFS doesn't track read status yet
        linkedTerms: [],
        prerequisites: [],
        nextSteps: [],
      }))
      setNotes(prev => {
        if (JSON.stringify(prev) === JSON.stringify(loadedNotes)) return prev
        return loadedNotes
      })
      if (loadedNotes.length > 0) {
        setCurrentNote(prev => {
          if (!prev) return loadedNotes[0]
          // Don't auto-switch note if we already have one, unless it was deleted
          const exists = loadedNotes.find(n => n.id === prev.id || n.slug === prev.slug)
          return exists ? prev : loadedNotes[0]
        })
      }
    }

    // Load relationships/edges from the correct 'edges' table
    const { data: edgesData, error: edgesError } = await supabase
      .from('edges')
      .select('id, source_id, target_id, relationship')
      .eq('user_id', userId)

    if (edgesError) {
      console.error('Error loading edges:', edgesError)
    }

    if (edgesData) {
      const loadedEdges: Edge[] = edgesData.map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
      }))
      setEdges(prev => {
        if (JSON.stringify(prev) === JSON.stringify(loadedEdges)) return prev
        return loadedEdges
      })
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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((prev: any) => {
        if (prev?.access_token === newSession?.access_token) return prev
        return newSession
      })
      
      if (newSession?.user) {
        // Only load notes if user changed or we didn't have notes
        if (newSession.user.id !== session?.user?.id) {
          loadUserNotes(newSession.user.id)
        }
      } else {
        // Clear data when logged out - only if not already empty
        setNotes(prev => prev.length === 0 ? prev : [])
        setEdges(prev => prev.length === 0 ? prev : [])
        setCurrentNote(null)
      }
    })

    // Realtime subscription for notes
    const notesSubscription = supabase
      .channel('notes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vfs_nodes' },
        (payload) => {
          console.log('Realtime update:', payload)
          if (session?.user) {
             // For simplicity, just reload all notes to ensure consistency
             // In a production app, we would optimistically update the state based on the payload
             loadUserNotes(session.user.id)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      notesSubscription.unsubscribe()
    }
  }, [loadUserNotes, session?.user?.id])

  const pendingParentTopic = React.useRef<string | undefined>(undefined)

  const { object, submit, isLoading: isGenerating, stop } = useObject({
    api: '/api/notes/generate',
    schema: noteSchema,
    onFinish: ({ object }: { object: any }) => {
      console.log('📝 Knowledge Context: onFinish called with object:', object)
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
        console.log('📝 Knowledge Context: Adding note to state:', note.title, note.slug)
        setCurrentNote(note)
        setNotes(prev => {
          if (prev.some(n => n.slug === note.slug)) {
            console.log('📝 Knowledge Context: Note already exists, skipping')
            return prev
          }
          console.log('📝 Knowledge Context: Notes count will be:', prev.length + 1)
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

  const value = React.useMemo(() => ({
    currentNote,
    streamingNote,
    isLoading,
    generateNote,
    notes,
    edges,
    selectNote,
    markAsUnderstood,
    clearStreaming,
    session
  }), [currentNote, streamingNote, isLoading, generateNote, notes, edges, selectNote, markAsUnderstood, clearStreaming, session])

  return (
    <KnowledgeContext.Provider value={value}>
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
