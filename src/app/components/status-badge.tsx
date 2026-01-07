import React from "react";
import { cn } from "./ui/utils";

type Status =
  | "active"
  | "completed"
  | "draft"
  | "pending"
  | "scraped"
  | "link-added"
  | "scraping"
  | "failed"
  | "paused"
  | "archived";

interface StatusBadgeProps {
  status: Status | undefined | null;
}

const statusConfig = {
  active: {
    label: "Active",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  completed: {
    label: "Completed",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  archived: {
    label: "Archived",
    className: "bg-slate-600/10 text-slate-500 border-slate-600/20",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  scraped: {
    label: "Scraped",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  "link-added": {
    label: "Link Added",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  scraping: {
    label: "Scraping",
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-slate-500/10 text-slate-400 border-slate-500/20">
        Unknown
      </span>
    );
  }

  const config = statusConfig[status];

  if (!config) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-slate-500/10 text-slate-400 border-slate-500/20">
        {status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
