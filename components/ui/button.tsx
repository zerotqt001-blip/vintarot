import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-brand-md)] border text-sm font-medium whitespace-nowrap transition-[background,color,border-color,box-shadow,transform] outline-none focus-visible:border-[var(--color-border-active)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text)] hover:border-[var(--color-border-active)] hover:bg-[var(--color-surface)]",
        primary:
          "border-[var(--color-gold-bright)] bg-[var(--color-gold)] text-[var(--color-bg-deep)] shadow-[0_8px_24px_rgba(215,179,106,.16)] hover:bg-[var(--color-gold-bright)] hover:shadow-[0_12px_28px_rgba(215,179,106,.24)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-border-active)] hover:bg-[var(--color-gold-subtle)]",
        secondary:
          "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-active)] hover:bg-[var(--color-surface-elevated)]",
        ghost:
          "border-transparent bg-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text)]",
        icon:
          "size-11 border-[var(--color-border)] bg-transparent p-0 text-[var(--color-text-muted)] hover:border-[var(--color-border-active)] hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-gold-bright)]",
        link: "border-transparent bg-transparent text-[var(--color-gold-bright)] underline-offset-4 hover:text-[var(--color-ivory)] hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-[var(--radius-brand-md)] px-6 has-[>svg]:px-4",
        icon: "size-11",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
