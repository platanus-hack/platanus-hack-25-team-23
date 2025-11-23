"use client"

import { useState } from "react"
import { Sidebar } from "@/components/views/Sidebar"
import { Menu } from "lucide-react"
import { KnowledgeProvider } from "@/lib/store/knowledge-context"
import { ThemeProvider } from "@/lib/store/theme-context"
import { AreasProvider } from "@/lib/store/areas-context"
import { JournalProvider } from "@/lib/store/journal-context"
import { Toaster } from "@/components/ui/sonner"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <ThemeProvider>
      <AreasProvider>
        <KnowledgeProvider>
          <JournalProvider>
            <div className="h-screen flex bg-background transition-colors duration-300 relative">
              <Sidebar 
                isOpen={isMobileSidebarOpen} 
                onClose={() => setIsMobileSidebarOpen(false)} 
              />
              
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Mobile Header */}
                <div className="md:hidden p-4 border-b border-border flex items-center gap-3 bg-card">
                  <button 
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-muted text-foreground"
                  >
                    <Menu className="size-6" />
                  </button>
                  <span className="font-semibold text-lg text-foreground">BrainFlow</span>
                </div>

                <main className="flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
            <Toaster />
          </JournalProvider>
        </KnowledgeProvider>
      </AreasProvider>
    </ThemeProvider>
  )
}
