"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all outline-none",
    "text-[#6D6D6D] hover:bg-[#F6F5F2] hover:text-[#222222]",
    "data-[state=on]:bg-[#FFF0E6] data-[state=on]:text-[#222222]",
    "focus-visible:ring-2 focus-visible:ring-[#E6DAFF]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "whitespace-nowrap",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[#EEEBE6] bg-white hover:bg-[#FFF0E6] data-[state=on]:bg-[#FFF0E6] data-[state=on]:border-[#FFF0E6]",
      },
      size: {
        default: "h-10 px-3 min-w-10",
        sm: "h-8 px-2 min-w-8",
        lg: "h-12 px-4 min-w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
