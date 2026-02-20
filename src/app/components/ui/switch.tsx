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
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-200 ease-out outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "sm:h-6 sm:w-11 sm:border-2",
        "data-[state=unchecked]:bg-muted data-[state=unchecked]:border-border data-[state=unchecked]:shadow-inner",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:shadow-sm",
        "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "hover:data-[state=unchecked]:bg-muted/80 hover:data-[state=checked]:bg-primary/90",
        "touch-manipulation",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full border border-border/40 bg-background shadow-sm transition-[transform,box-shadow] duration-200 ease-out",
          "sm:size-5 sm:shadow-md",
          "data-[state=unchecked]:translate-x-0.5",
          "data-[state=checked]:translate-x-[18px] data-[state=checked]:border-primary-foreground/20 data-[state=checked]:bg-primary-foreground data-[state=checked]:shadow",
          "sm:data-[state=checked]:translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
