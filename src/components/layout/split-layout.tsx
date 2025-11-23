"use client"

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import Image from "next/image"
import { useMediaQuery } from "@/lib/hooks/use-media-query"

interface SplitLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftSize?: number
  defaultRightSize?: number
}

export function SplitLayout({ 
  leftPanel, 
  rightPanel,
  defaultLeftSize = 30,
  defaultRightSize = 70
}: SplitLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [direction, setDirection] = useState<"horizontal" | "vertical">("horizontal")

  useEffect(() => {
    setDirection(isMobile ? "vertical" : "horizontal")
  }, [isMobile])

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ResizablePanelGroup 
        direction={direction} 
        className="h-full items-stretch"
      >
        <ResizablePanel 
          defaultSize={isMobile ? 40 : defaultLeftSize} 
          minSize={20} 
          maxSize={80} 
          collapsible={true} 
          onCollapse={() => setIsCollapsed(true)} 
          onExpand={() => setIsCollapsed(false)}
          className={cn(isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
        >
          <div className="h-full flex flex-col overflow-hidden">
            {leftPanel}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={isMobile ? 60 : defaultRightSize} minSize={20}>
          <div className="h-full flex flex-col overflow-hidden relative">
            {rightPanel}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
