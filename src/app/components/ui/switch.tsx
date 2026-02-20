"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

/**
 * Responsive toggle switch.
 *
 * Mobile  (<sm): h-7 × w-[52px] track  |  22px thumb  — thumb-friendly, visually clear
 * Desktop (sm+): h-5 × w-9    track  |  14px thumb  — compact, inline-friendly
 *
 * Thumb math (3px gutter each side):
 *   Mobile  unchecked → translateX(3px),  checked → translateX(27px)  [52-22-3]
 *   Desktop unchecked → translateX(3px),  checked → translateX(19px)  [36-14-3]
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Layout
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none",
        // Smooth color + shadow transitions
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",

        // ── Mobile track (default) ──────────────────────────────────────────
        "h-7 w-[52px] border border-transparent",
        // ── Desktop track (sm+) ────────────────────────────────────────────
        "sm:h-5 sm:w-9",

        // Unchecked
        "data-[state=unchecked]:bg-muted/80 data-[state=unchecked]:border-border/60",
        // Checked
        "data-[state=checked]:bg-primary/90 data-[state=checked]:border-primary/70",

        // Hover
        "hover:data-[state=unchecked]:bg-muted",
        "hover:data-[state=checked]:bg-primary",
        // Press feedback
        "active:scale-[0.96]",
        // Focus ring
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 border-0",
          "transition-[transform,box-shadow] duration-200 ease-out",

          // ── Mobile thumb (default) ─────────────────────────────────────────
          "size-[22px]",
          "data-[state=unchecked]:translate-x-[3px]",
          "data-[state=checked]:translate-x-[27px]",

          // ── Desktop thumb (sm+) ────────────────────────────────────────────
          "sm:size-[14px]",
          "sm:data-[state=unchecked]:translate-x-[3px]",
          "sm:data-[state=checked]:translate-x-[19px]",

          // Depth shadows
          "data-[state=unchecked]:shadow-[0_1px_2px_rgba(0,0,0,0.10)]",
          "data-[state=checked]:shadow-[0_1px_4px_rgba(0,0,0,0.15)]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
