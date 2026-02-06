"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Compact, subtle track
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50",
        // Soft neutral states
        "data-[state=unchecked]:bg-white/[0.04] data-[state=unchecked]:border-white/[0.08]",
        "data-[state=checked]:bg-white/[0.10] data-[state=checked]:border-white/[0.16]",
        // Accessible focus ring
        "focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full transition-transform shadow-sm",
          "data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-slate-500",
          "data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-white",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
