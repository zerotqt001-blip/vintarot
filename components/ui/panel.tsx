import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const panelVariants = cva("brand-panel", {
  variants: {
    tone: {
      surface: "brand-panel--surface",
      elevated: "brand-panel--elevated",
      soft: "brand-panel--soft",
    },
  },
  defaultVariants: {
    tone: "surface",
  },
});

const Panel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & VariantProps<typeof panelVariants>
>(({ className, tone, ...props }, ref) => (
  <div ref={ref} data-slot="panel" data-tone={tone} className={cn(panelVariants({ tone, className }))} {...props} />
));

Panel.displayName = "Panel";

export { Panel, panelVariants };
