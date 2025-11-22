"use client"

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface MainLayoutProps {
  children?: React.ReactNode
  notePanel: React.ReactNode
  graphPanel: React.ReactNode
}

export function MainLayout({ notePanel, graphPanel }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col">
      <header className="h-14 border-b flex items-center px-4 shrink-0">
        <h1 className="font-bold text-lg">BrainFlow</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* User profile, stats, etc. */}
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full items-stretch">
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col overflow-hidden">
              {notePanel}
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col border-l">
              {graphPanel}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
