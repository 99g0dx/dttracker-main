import React from "react";
import { Badge } from "./ui/badge";

type Platform = "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";

interface PlatformBadgeProps {
  platform: Platform | undefined | null;
}

const platformColors: Record<Platform, string> = {
  tiktok:
    "bg-gradient-to-r from-pink-500/15 to-pink-500/10 text-pink-400 border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.15)]",
  instagram:
    "bg-gradient-to-r from-purple-500/15 via-pink-500/10 to-orange-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
  youtube:
    "bg-gradient-to-r from-red-500/15 to-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]",
  twitter:
    "bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
  facebook:
    "bg-gradient-to-r from-blue-600/15 to-blue-600/10 text-blue-400 border-blue-600/30 shadow-[0_0_12px_rgba(37,99,235,0.15)]",
};

const platformNames: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X",
  facebook: "Facebook",
};

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  if (!platform) {
    return (
      <Badge
        variant="outline"
        className="bg-slate-500/10 text-slate-400 border-slate-500/30 border backdrop-blur-sm font-medium"
      >
        Unknown
      </Badge>
    );
  }

  const colorClass =
    platformColors[platform] ||
    "bg-slate-500/10 text-slate-400 border-slate-500/30";
  const platformName = platformNames[platform] || platform;

  return (
    <Badge
      variant="outline"
      className={`${colorClass} border backdrop-blur-sm font-medium`}
    >
      {platformName}
    </Badge>
  );
}
