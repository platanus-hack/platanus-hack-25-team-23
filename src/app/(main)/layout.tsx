"use client"

import { Sidebar } from "@/components/views/Sidebar"
import { KnowledgeProvider } from "@/lib/store/knowledge-context"
import { ThemeProvider } from "@/lib/store/theme-context"
import { AreasProvider } from "@/lib/store/areas-context"
import { Toaster } from "@/components/ui/sonner"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <AreasProvider>
        <KnowledgeProvider>
          <div className="h-screen flex bg-background transition-colors duration-300">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
          <Toaster />
        </KnowledgeProvider>
      </AreasProvider>
    </ThemeProvider>
  )
}
