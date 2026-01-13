import * as React from "react";
import { cn } from "./utils";

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
  sm: { container: "h-[22px] w-[22px]", icon: "h-[14px] w-[14px]" },
  md: { container: "h-7 w-7", icon: "h-[18px] w-[18px]" },
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
  const { container, icon } = sizeStyles[size];
  const gradientId = React.useId();

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      title={title ?? label}
      className={cn(
        "flex items-center justify-center rounded-full bg-black/40 border border-white/10",
        container,
        className
      )}
      {...props}
    >
      {platform === "tiktok" && (
        <svg
          viewBox="0 0 24 24"
          className={icon}
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#25F4EE"
            d="M15.6 4.5c1 1.7 2.7 2.9 4.7 3.1v3.1c-1.9-.1-3.5-.8-4.7-1.8v6.3a5.7 5.7 0 1 1-5.7-5.7c.5 0 1 .1 1.4.2v3.2a2.6 2.6 0 1 0 1.8 2.5V3.9h2.5z"
            transform="translate(-0.6,0.6)"
          />
          <path
            fill="#FE2C55"
            d="M15.6 4.5c1 1.7 2.7 2.9 4.7 3.1v3.1c-1.9-.1-3.5-.8-4.7-1.8v6.3a5.7 5.7 0 1 1-5.7-5.7c.5 0 1 .1 1.4.2v3.2a2.6 2.6 0 1 0 1.8 2.5V3.9h2.5z"
            transform="translate(0.6,-0.6)"
          />
          <path
            fill="#FFFFFF"
            d="M15.6 4.5c1 1.7 2.7 2.9 4.7 3.1v3.1c-1.9-.1-3.5-.8-4.7-1.8v6.3a5.7 5.7 0 1 1-5.7-5.7c.5 0 1 .1 1.4.2v3.2a2.6 2.6 0 1 0 1.8 2.5V3.9h2.5z"
          />
        </svg>
      )}
      {platform === "instagram" && (
        <svg
          viewBox="0 0 24 24"
          className={icon}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="1" y2="0">
              <stop offset="0" stopColor="#f58529" />
              <stop offset="0.35" stopColor="#dd2a7b" />
              <stop offset="0.65" stopColor="#8134af" />
              <stop offset="1" stopColor="#515bd4" />
            </linearGradient>
          </defs>
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5"
            fill={`url(#${gradientId})`}
          />
          <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="17" cy="7" r="1.3" fill="#fff" />
        </svg>
      )}
      {platform === "youtube" && (
        <svg
          viewBox="0 0 24 24"
          className={icon}
          aria-hidden="true"
          focusable="false"
        >
          <rect x="3" y="6" width="18" height="12" rx="3" fill="#FF0000" />
          <path d="M11 9l5 3-5 3V9z" fill="#FFFFFF" />
        </svg>
      )}
      {platform === "x" && (
        <svg
          viewBox="0 0 24 24"
          className={icon}
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#FFFFFF"
            d="M6 4h3.4l3.1 4.3L16.6 4H20l-5.7 7.1L20.5 20h-3.4l-3.5-4.9-4 4.9H6l6.3-7.7L6 4z"
          />
        </svg>
      )}
      {platform === "facebook" && (
        <svg
          viewBox="0 0 24 24"
          className={icon}
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="10" fill="#1877F2" />
          <path
            fill="#FFFFFF"
            d="M13.2 7.5h2.1V5.2c-.4-.1-1.3-.2-2.4-.2-2.4 0-4 1.4-4 4v2H6.7v2.6h2.2v5.2h2.7v-5.2h2.2l.4-2.6h-2.6V9c0-.9.2-1.5 1.6-1.5z"
          />
        </svg>
      )}
    </div>
  );
}