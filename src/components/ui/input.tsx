import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-[#EEEBE6] bg-[#F6F5F2] px-4 py-3 text-sm text-[#222222] transition-all duration-200",
        "placeholder:text-[#9A9A9A]",
        "focus:outline-none focus:ring-2 focus:ring-[#E6DAFF] focus:border-[#E6DAFF]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#222222]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
