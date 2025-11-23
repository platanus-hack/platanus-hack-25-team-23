"use client"

import { useState } from "react"
import { ChatView } from "@/components/views/ChatView"
import { NotePanel } from "@/components/features/note-panel"
import { MessageSquare, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat')

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Tabs */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            activeTab === 'chat' 
              ? "text-primary border-b-2 border-primary bg-muted/50" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Chat & Calendar
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            activeTab === 'notes' 
              ? "text-primary border-b-2 border-primary bg-muted/50" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <FileText className="w-4 h-4" />
          Notes
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className={cn("absolute inset-0 transition-opacity duration-300", activeTab === 'chat' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
            <ChatView />
        </div>
        <div className={cn("absolute inset-0 transition-opacity duration-300", activeTab === 'notes' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
            <NotePanel />
        </div>
      </div>
    </div>
  )
}
