import React from "react";
import { cn } from "./utils";

export function RouteProgress({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px] opacity-0 transition-opacity duration-300",
        isActive && "opacity-100"
      )}
    >
      <div className="h-full w-full bg-gradient-to-r from-primary via-red-400 dark:via-cyan-400 to-purple-500 animate-progress" />
    </div>
  );
}
