"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  disabled,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const today = React.useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const mergedDisabled = React.useMemo(() => {
    if (!disabled) {
      return [{ before: today }];
    }
    const disabledList = Array.isArray(disabled) ? disabled : [disabled];
    return [{ before: today }, ...disabledList];
  }, [disabled, today]);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 sm:p-5 bg-[#0B0C10]", className)}
      disabled={mergedDisabled}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-3",
        caption:
          "flex items-center justify-between px-1.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06]",
        caption_label: "text-sm font-semibold text-white ",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-8 bg-white/[0.02] border-white/[0.08] p-0 text-slate-300 hover:text-white hover:bg-white/[0.06]",
        ),
        nav_button_previous: "static",
        nav_button_next: "static",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell:
          "text-slate-500 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-wider",
        row: "flex w-full mt-1.5",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-primary/15 [&:has([aria-selected].day-range-end)]:rounded-r-lg",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-lg [&:has(>.day-range-start)]:rounded-l-lg first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg"
            : "[&:has([aria-selected])]:rounded-lg",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-medium text-slate-200 hover:bg-white/[0.06] aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-black",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-black",
        day_selected:
          "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black",
        day_today: "bg-white/[0.06] text-white ring-1 ring-white/[0.12]",
        day_outside:
          "day-outside text-slate-600 aria-selected:text-slate-500",
        day_disabled:
          "text-slate-600 opacity-40 line-through decoration-slate-600/40",
        day_range_middle:
          "aria-selected:bg-primary/15 aria-selected:text-white",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
