"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#2E7D4A]" />,
        info: <InfoIcon className="size-4 text-[#4A7DB8]" />,
        warning: <TriangleAlertIcon className="size-4 text-[#B8860B]" />,
        error: <OctagonXIcon className="size-4 text-[#D46A6A]" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[#6D6D6D]" />,
      }}
      toastOptions={{
        classNames: {
          toast: "rounded-2xl border-[#EEEBE6] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.08)]",
          title: "text-[#222222] font-medium",
          description: "text-[#6D6D6D]",
          success: "bg-[#E3F5EA] border-[#B8E5C8]",
          error: "bg-[#FFEEEE] border-[#FFCACA]",
          warning: "bg-[#FFF4E0] border-[#FFE4B8]",
          info: "bg-[#E8F2FF] border-[#C4DEFF]",
        },
      }}
      style={
        {
          "--normal-bg": "#FFFFFF",
          "--normal-text": "#222222",
          "--normal-border": "#EEEBE6",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
