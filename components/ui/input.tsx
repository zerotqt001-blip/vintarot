import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "brand-input h-11 w-full min-w-0 rounded-[var(--radius-brand-sm)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2 text-base text-[var(--color-text)] shadow-[0_8px_24px_rgba(0,0,0,.12)] transition-[color,box-shadow,border-color,background] outline-none selection:bg-[var(--color-gold)] selection:text-[var(--color-bg-deep)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[var(--color-border-active)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus)]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
