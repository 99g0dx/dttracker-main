import * as React from "react";

import { cn } from "./utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 sm:gap-5 lg:gap-6 rounded-xl border border-white/[0.08] overflow-hidden",
        className,
      )}
      style={{ boxShadow: 'var(--shadow-card)' }}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 sm:gap-2 px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 lg:pt-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 [.border-b]:sm:pb-5 [.border-b]:lg:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <h4
      data-slot="card-title"
      className={cn("text-base sm:text-lg font-semibold tracking-tight leading-tight text-white", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-xs sm:text-sm text-slate-400 leading-relaxed", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 sm:px-5 lg:px-6 [&:last-child]:pb-4 [&:last-child]:sm:pb-5 [&:last-child]:lg:pb-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-4 sm:px-5 lg:px-6 pb-4 sm:pb-5 lg:pb-6 [.border-t]:pt-4 [.border-t]:sm:pt-5 [.border-t]:lg:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
