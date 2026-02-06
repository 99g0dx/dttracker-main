import * as React from "react";
import { cn } from "./utils";
import {
  TikTokCustomIcon,
  InstagramCustomIcon,
  YouTubeCustomIcon,
  TwitterCustomIcon,
  FacebookCustomIcon,
} from "./platform-custom-icons";

export type PlatformIconName =
  | "tiktok"
  | "instagram"
  | "x"
  | "youtube"
  | "facebook";

const platformLabels: Record<PlatformIconName, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
  youtube: "YouTube",
  facebook: "Facebook",
};

export function normalizePlatform(
  platform?: string | null
): PlatformIconName | null {
  if (!platform) return null;
  const normalized = platform.toLowerCase();
  if (normalized === "twitter" || normalized === "x") return "x";
  if (normalized === "tiktok") return "tiktok";
  if (normalized === "instagram") return "instagram";
  if (normalized === "youtube") return "youtube";
  if (normalized === "facebook") return "facebook";
  return null;
}

export function getPlatformLabel(platform: PlatformIconName) {
  return platformLabels[platform];
}

type PlatformIconSize = "sm" | "md";

interface PlatformIconProps extends React.HTMLAttributes<HTMLDivElement> {
  platform: PlatformIconName;
  size?: PlatformIconSize;
}

const sizeStyles: Record<
  PlatformIconSize,
  { container: string; icon: string }
> = {
  sm: { container: "w-5 h-5", icon: "w-4 h-4" },
  md: { container: "w-6 h-6", icon: "w-5 h-5" },
};

export function PlatformIcon({
  platform,
  size = "sm",
  className,
  title,
  ...props
}: PlatformIconProps) {
  const label = getPlatformLabel(platform);
  const ariaLabel = props["aria-label"] ?? label;
  const { icon } = sizeStyles[size];

  const IconComponent = {
    tiktok: TikTokCustomIcon,
    instagram: InstagramCustomIcon,
    youtube: YouTubeCustomIcon,
    x: TwitterCustomIcon,
    facebook: FacebookCustomIcon,
  }[platform];

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      title={title ?? label}
      className={cn("text-slate-400", className)}
      {...props}
    >
      <IconComponent className={icon} />
    </div>
  );
}
