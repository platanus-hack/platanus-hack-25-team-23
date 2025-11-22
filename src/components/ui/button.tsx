import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#FFD9D9] text-[#222222] hover:bg-[#FFCACA] hover:translate-y-[-1px] shadow-[0px_2px_8px_rgba(255,217,217,0.4)]",
        destructive:
          "bg-[#FFEEEE] text-[#D46A6A] hover:bg-[#FFCACA] focus-visible:ring-[#FFCACA]",
        outline:
          "border border-[#EEEBE6] bg-white text-[#6D6D6D] hover:bg-[#FFF0E6] hover:text-[#222222] hover:border-[#FFD9D9]",
        secondary:
          "bg-[#E6DAFF] text-[#222222] hover:bg-[#D4C4F5] hover:translate-y-[-1px]",
        ghost:
          "text-[#6D6D6D] hover:bg-[#FFF0E6] hover:text-[#222222]",
        link:
          "text-[#6D6D6D] underline-offset-4 hover:underline hover:text-[#222222]",
        warm:
          "bg-[#FFF0E6] text-[#222222] hover:bg-[#FFE8DC] hover:translate-y-[-1px]",
        lavender:
          "bg-[#E6DAFF] text-[#222222] hover:bg-[#D4C4F5] hover:translate-y-[-1px]",
        mint:
          "bg-[#D4F5E9] text-[#222222] hover:bg-[#B8E5C8] hover:translate-y-[-1px]",
      },
      size: {
        default: "h-10 px-5 py-2 rounded-xl",
        sm: "h-8 px-4 py-1.5 rounded-lg text-xs gap-1.5",
        lg: "h-12 px-8 py-3 rounded-2xl text-base",
        xl: "h-14 px-10 py-4 rounded-2xl text-lg font-semibold",
        icon: "size-10 rounded-xl",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
