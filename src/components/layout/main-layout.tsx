"use client"

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useState } from "react"
import Image from "next/image"

interface MainLayoutProps {
  children?: React.ReactNode
  notePanel: React.ReactNode
  graphPanel: React.ReactNode
}

export function MainLayout({ notePanel, graphPanel }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className="h-screen w-full flex flex-col"
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Header */}
      <header
        className="h-16 flex items-center px-6 shrink-0"
        style={{
          backgroundColor: 'var(--card)',
          borderBottom: '2px solid #EEEBE6'
        }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="BrainFlow"
            width={40}
            height={40}
            className="object-contain"
          />
          <h1 className="font-bold text-xl" style={{ color: '#222222' }}>
            BrainFlow
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* User profile, stats, etc. */}
          <div
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: '#E6DAFF',
              color: '#9575CD'
            }}
          >
            Modo Estudio
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full items-stretch">
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col overflow-hidden">
              {notePanel}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={40} minSize={30}>
            <div
              className="h-full flex flex-col"
              style={{ borderLeft: '2px solid #EEEBE6' }}
            >
              {graphPanel}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
