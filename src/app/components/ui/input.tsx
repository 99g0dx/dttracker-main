import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 sm:h-10 w-full min-w-0 rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground transition-all outline-none",
        "placeholder:text-muted-foreground",
        "hover:border-ring/40 hover:bg-input-background",
        "focus:border-ring focus:bg-input-background focus:ring-2 focus:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30",
        "read-only:cursor-default read-only:bg-muted/40 read-only:text-muted-foreground",
        "aria-invalid:border-red-500/50 aria-invalid:focus:ring-red-500/20",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "selection:bg-primary/20 selection:text-foreground",
        className,
      )}
      style={{
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
      }}
      {...props}
    />
  );
}

export { Input };
