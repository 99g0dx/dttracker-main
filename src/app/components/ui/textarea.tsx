import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white transition-all outline-none resize-none",
        "placeholder:text-slate-500",
        "hover:border-white/[0.1] hover:bg-white/[0.03]",
        "focus:border-white/[0.15] focus:bg-white/[0.04] focus:ring-2 focus:ring-white/[0.08]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-white/[0.01]",
        "read-only:cursor-default read-only:bg-white/[0.01] read-only:text-slate-400",
        "aria-invalid:border-red-500/50 aria-invalid:focus:ring-red-500/20",
        "selection:bg-white/20 selection:text-white",
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
