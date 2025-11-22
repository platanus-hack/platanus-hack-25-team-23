"use client"

import { Sidebar } from "@/components/views/Sidebar"
import { KnowledgeProvider } from "@/lib/store/knowledge-context"
import { Toaster } from "@/components/ui/sonner"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <KnowledgeProvider>
      <div className="h-screen flex bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </KnowledgeProvider>
  )
}
