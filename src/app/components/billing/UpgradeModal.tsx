import React from "react";
import { X, Crown, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../../lib/utils";
import { BillingTier, formatPrice, PlanCatalogEntry } from "../../../lib/api/billing";

type LimitType = "campaigns" | "creators" | "seats" | "platform" | "scrape_interval";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (tier: BillingTier) => void;
  limitType: LimitType;
  currentTier: BillingTier;
  currentLimit?: number;
  suggestedTier: BillingTier;
  suggestedPlan?: PlanCatalogEntry;
}

const LIMIT_MESSAGES: Record<LimitType, { title: string; description: string }> = {
  campaigns: {
    title: "Campaign Limit Reached",
    description: "You've reached the maximum number of active campaigns for your plan.",
  },
  creators: {
    title: "Creator Limit Reached",
    description: "You've reached the maximum number of creators per campaign for your plan.",
  },
  seats: {
    title: "Seat Limit Reached",
    description: "You've used all available team seats on your current plan.",
  },
  platform: {
    title: "Platform Not Available",
    description: "This platform is not included in your current plan.",
  },
  scrape_interval: {
    title: "Scrape Interval Limit",
    description: "You need to wait before scraping again on your current plan.",
  },
};

const TIER_BENEFITS: Record<BillingTier, string[]> = {
  free: [],
  starter: [
    "3 active campaigns",
    "25 creators per campaign",
    "TikTok & Instagram",
    "12-hour scrape interval",
  ],
  pro: [
    "10 active campaigns",
    "100 creators per campaign",
    "All 3 platforms",
    "4-hour scrape interval",
    "5 team seats included",
  ],
  agency: [
    "Unlimited campaigns",
    "Unlimited creators",
    "All 3 platforms",
    "30-minute scrape interval",
    "15 team seats included",
    "API access",
  ],
};

export function UpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  limitType,
  currentTier,
  currentLimit,
  suggestedTier,
  suggestedPlan,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const { title, description } = LIMIT_MESSAGES[limitType];
  const benefits = TIER_BENEFITS[suggestedTier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#0D0D0D] border border-white/[0.08] rounded-xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-400">{description}</p>
            </div>
          </div>

          {/* Suggested Plan */}
          <div className="bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-white capitalize">
                  {suggestedTier} Plan
                </h4>
                {suggestedPlan && (
                  <p className="text-sm text-primary">
                    {formatPrice(suggestedPlan.base_price_cents)}/month
                  </p>
                )}
              </div>
            </div>

            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-10 bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => onUpgrade(suggestedTier)}
              className="flex-1 h-10 bg-primary hover:bg-primary/90 text-black font-medium"
            >
              Upgrade Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UpgradeBannerProps {
  limitType: LimitType;
  currentUsage: number;
  limit: number;
  onUpgrade: () => void;
  className?: string;
}

export function UpgradeBanner({
  limitType,
  currentUsage,
  limit,
  onUpgrade,
  className,
}: UpgradeBannerProps) {
  const percentage = (currentUsage / limit) * 100;
  const isAtLimit = currentUsage >= limit;
  const isNearLimit = percentage >= 80;

  if (!isAtLimit && !isNearLimit) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border",
        isAtLimit
          ? "bg-red-500/10 border-red-500/20"
          : "bg-yellow-500/10 border-yellow-500/20",
        className
      )}
    >
      <AlertTriangle
        className={cn("w-5 h-5", isAtLimit ? "text-red-400" : "text-yellow-400")}
      />
      <div className="flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            isAtLimit ? "text-red-400" : "text-yellow-400"
          )}
        >
          {isAtLimit ? "Limit Reached" : "Approaching Limit"}
        </p>
        <p className="text-xs text-slate-400">
          {isAtLimit
            ? `You've used all ${limit} ${limitType}. Upgrade to continue.`
            : `${currentUsage} of ${limit} ${limitType} used.`}
        </p>
      </div>
      <Button
        onClick={onUpgrade}
        size="sm"
        className={cn(
          isAtLimit
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-yellow-500 hover:bg-yellow-600 text-black"
        )}
      >
        Upgrade
      </Button>
    </div>
  );
}
