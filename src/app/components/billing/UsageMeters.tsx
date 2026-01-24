import React from "react";
import { Users, FolderKanban, UserPlus } from "lucide-react";
import { cn } from "../../../lib/utils";

interface UsageMeterProps {
  label: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  showPercentage?: boolean;
}

function UsageMeter({ label, icon, current, limit, showPercentage = true }: UsageMeterProps) {
  const isUnlimited = limit === -1 || limit === null;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && current >= limit;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-slate-400">{icon}</div>
          <span className="text-sm text-slate-300">{label}</span>
        </div>
        <span
          className={cn(
            "text-sm font-medium",
            isAtLimit ? "text-red-400" : isNearLimit ? "text-yellow-400" : "text-slate-300"
          )}
        >
          {current} / {isUnlimited ? "Unlimited" : limit}
        </span>
      </div>

      {!isUnlimited && (
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              isAtLimit
                ? "bg-red-500"
                : isNearLimit
                ? "bg-yellow-500"
                : "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {showPercentage && !isUnlimited && (
        <p
          className={cn(
            "text-xs",
            isAtLimit
              ? "text-red-400"
              : isNearLimit
              ? "text-yellow-400"
              : "text-slate-500"
          )}
        >
          {isAtLimit
            ? "Limit reached - upgrade to continue"
            : isNearLimit
            ? `${Math.round(percentage)}% used - consider upgrading`
            : `${Math.round(percentage)}% used`}
        </p>
      )}
    </div>
  );
}

interface UsageMetersProps {
  campaigns: { current: number; limit: number };
  creatorsPerCampaign?: { current: number; limit: number };
  seats: { current: number; limit: number };
  className?: string;
}

export function UsageMeters({
  campaigns,
  creatorsPerCampaign,
  seats,
  className,
}: UsageMetersProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <UsageMeter
        label="Active Campaigns"
        icon={<FolderKanban className="w-4 h-4" />}
        current={campaigns.current}
        limit={campaigns.limit}
      />

      {creatorsPerCampaign && (
        <UsageMeter
          label="Creators (this campaign)"
          icon={<UserPlus className="w-4 h-4" />}
          current={creatorsPerCampaign.current}
          limit={creatorsPerCampaign.limit}
        />
      )}

      <UsageMeter
        label="Team Seats"
        icon={<Users className="w-4 h-4" />}
        current={seats.current}
        limit={seats.limit}
      />
    </div>
  );
}

interface CompactUsageMeterProps {
  current: number;
  limit: number;
  label: string;
}

export function CompactUsageMeter({ current, limit, label }: CompactUsageMeterProps) {
  const isUnlimited = limit === -1 || limit === null;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && current >= limit;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">{label}</span>
          <span
            className={cn(
              "text-xs font-medium",
              isAtLimit ? "text-red-400" : isNearLimit ? "text-yellow-400" : "text-slate-300"
            )}
          >
            {current}/{isUnlimited ? "∞" : limit}
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                isAtLimit
                  ? "bg-red-500"
                  : isNearLimit
                  ? "bg-yellow-500"
                  : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
