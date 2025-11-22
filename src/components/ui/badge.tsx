import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-[#FFD9D9] text-[#222222]",
        secondary:
          "bg-[#E6DAFF] text-[#222222]",
        warm:
          "bg-[#FFF0E6] text-[#222222]",
        mint:
          "bg-[#D4F5E9] text-[#222222]",
        blue:
          "bg-[#CFE4FF] text-[#222222]",
        destructive:
          "bg-[#FFEEEE] text-[#D46A6A]",
        outline:
          "border border-[#EEEBE6] bg-white text-[#6D6D6D]",
        success:
          "bg-[#E3F5EA] text-[#2E7D4A]",
        warning:
          "bg-[#FFF4E0] text-[#B8860B]",
      },
      size: {
        default: "px-3 py-1 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-4 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
