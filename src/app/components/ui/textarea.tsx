import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground transition-all outline-none resize-none",
        "placeholder:text-muted-foreground",
        "hover:border-ring/40 hover:bg-input-background",
        "focus:border-ring focus:bg-input-background focus:ring-2 focus:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30",
        "read-only:cursor-default read-only:bg-muted/40 read-only:text-muted-foreground",
        "aria-invalid:border-red-500/50 aria-invalid:focus:ring-red-500/20",
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

export { Textarea };
