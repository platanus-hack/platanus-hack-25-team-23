"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      variant: {
        default: "bg-[#EEEBE6]",
        warm: "bg-[#FFE8DC]",
        lavender: "bg-[#E6DAFF]/30",
        mint: "bg-[#D4F5E9]/30",
      },
      size: {
        default: "h-2",
        sm: "h-1",
        lg: "h-3",
        xl: "h-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-500 ease-out rounded-full",
  {
    variants: {
      color: {
        default: "bg-[#FFD9D9]",
        lavender: "bg-[#E6DAFF]",
        mint: "bg-[#D4F5E9]",
        blue: "bg-[#CFE4FF]",
        warm: "bg-[#F5A962]",
        success: "bg-[#B8E5C8]",
      },
    },
    defaultVariants: {
      color: "default",
    },
  }
)

interface ProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  indicatorColor?: VariantProps<typeof indicatorVariants>["color"]
}

function Progress({
  className,
  value,
  variant,
  size,
  indicatorColor,
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressVariants({ variant, size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(indicatorVariants({ color: indicatorColor }))}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressVariants }
