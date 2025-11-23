"use client"

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useState } from "react"
import Image from "next/image"

interface SplitLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
}

export function SplitLayout({ leftPanel, rightPanel }: SplitLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full items-stretch">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50} collapsible={true} onCollapse={() => setIsCollapsed(true)} onExpand={() => setIsCollapsed(false)}>
          <div className="h-full flex flex-col overflow-hidden">
            {leftPanel}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden relative">
            {rightPanel}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
