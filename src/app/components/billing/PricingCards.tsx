import React, { useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Check, Zap, Crown, Building2, Star } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  BillingTier,
  BillingCycle,
  PlanCatalogEntry,
  formatPrice,
} from "../../../lib/api/billing";
import { SeatSelector } from "./SeatSelector";

interface TierConfig {
  tier: BillingTier;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  highlight?: boolean;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    tier: "free",
    name: "Free",
    description: "Get started with basic tracking",
    icon: <Zap className="w-5 h-5" />,
    features: [
      "1 active campaign",
      "10 creators per campaign",
      "TikTok only",
      "48-hour scrape interval",
      "30-day data retention",
      "Basic analytics",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    description: "For independent artists & managers",
    icon: <Star className="w-5 h-5" />,
    features: [
      "3 active campaigns",
      "25 creators per campaign",
      "TikTok & Instagram",
      "12-hour scrape interval",
      "180-day data retention",
      "Email support",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    description: "For professional managers & labels",
    icon: <Crown className="w-5 h-5" />,
    features: [
      "10 active campaigns",
      "100 creators per campaign",
      "All 5 platforms",
      "4-hour scrape interval",
      "Unlimited data retention",
      "Advanced analytics",
      "Team collaboration (2 seats included)",
      "Priority support",
    ],
    highlight: true,
  },
  {
    tier: "agency",
    name: "Agency",
    description: "For agencies & large labels",
    icon: <Building2 className="w-5 h-5" />,
    features: [
      "Unlimited campaigns",
      "Unlimited creators",
      "All 5 platforms",
      "30-minute scrape interval",
      "Unlimited data retention",
      "API access",
      "White-label reports",
      "Team collaboration (3 seats included)",
      "Dedicated account manager",
    ],
  },
];

interface PricingCardsProps {
  plans: Record<BillingTier, { monthly?: PlanCatalogEntry; yearly?: PlanCatalogEntry }>;
  currentTier?: BillingTier;
  currentBillingCycle?: BillingCycle;
  onSelectPlan: (tier: BillingTier, billingCycle: BillingCycle, extraSeats: number) => void;
  isLoading?: boolean;
}

export function PricingCards({
  plans,
  currentTier,
  currentBillingCycle,
  onSelectPlan,
  isLoading,
}: PricingCardsProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedSeats, setSelectedSeats] = useState<Record<BillingTier, number>>({
    free: 0,
    starter: 0,
    pro: 0,
    agency: 0,
  });

  const isCurrentPlan = (tier: BillingTier) => {
    return currentTier === tier && currentBillingCycle === billingCycle;
  };

  const getPlan = (tier: BillingTier) => {
    if (tier === "free") {
      return plans.free?.monthly;
    }
    return billingCycle === "yearly" ? plans[tier]?.yearly : plans[tier]?.monthly;
  };

  const calculateTotal = (tier: BillingTier) => {
    const plan = getPlan(tier);
    if (!plan) return 0;
    const extraSeats = selectedSeats[tier] || 0;
    return plan.base_price_cents + extraSeats * (plan.extra_seat_price_cents || 0);
  };

  return (
    <div className="space-y-6">
      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              billingCycle === "monthly"
                ? "bg-white/[0.08] text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
              billingCycle === "yearly"
                ? "bg-white/[0.08] text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            Yearly
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIER_CONFIGS.map((config) => {
          const plan = getPlan(config.tier);
          const isCurrent = isCurrentPlan(config.tier);
          const isHighlight = config.highlight;
          const extraSeats = selectedSeats[config.tier] || 0;
          const total = calculateTotal(config.tier);

          return (
            <Card
              key={config.tier}
              className={cn(
                "relative overflow-hidden transition-all",
                isHighlight
                  ? "bg-gradient-to-b from-primary/15 to-[#0D0D0D] border-primary/40"
                  : "bg-[#0D0D0D] border-white/[0.08]",
                isCurrent && "ring-2 ring-primary/50"
              )}
            >
              {/* Popular Badge */}
              {isHighlight && !isCurrent && (
                <div className="absolute top-0 right-0 bg-primary text-black text-xs font-medium px-3 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-black text-xs font-medium px-3 py-1 rounded-bl-lg">
                  Current Plan
                </div>
              )}

              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isHighlight ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-slate-400"
                    )}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{config.name}</h3>
                    <p className="text-xs text-slate-500">{config.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold text-white">
                      {plan ? formatPrice(total) : "$0"}
                    </span>
                    {config.tier !== "free" && (
                      <span className="text-slate-500 text-sm">
                        /{billingCycle === "yearly" ? "year" : "month"}
                      </span>
                    )}
                  </div>
                  {config.tier !== "free" && billingCycle === "yearly" && plan && (
                    <p className="text-xs text-emerald-400 mt-1">
                      {formatPrice(Math.round(plan.base_price_cents / 12))}/month billed annually
                    </p>
                  )}
                </div>

                {/* Seat Selector (for paid plans) */}
                {config.tier !== "free" && plan && (
                  <div className="mb-4">
                    <SeatSelector
                      includedSeats={plan.included_seats}
                      extraSeats={extraSeats}
                      extraSeatPrice={plan.extra_seat_price_cents || 0}
                      billingCycle={billingCycle}
                      maxSeats={plan.max_seats ?? undefined}
                      onChange={(seats) =>
                        setSelectedSeats((prev) => ({ ...prev, [config.tier]: seats }))
                      }
                    />
                  </div>
                )}

                {/* CTA Button */}
                {config.tier === "free" ? (
                  <Button
                    disabled
                    className="w-full h-10 bg-white/[0.03] border border-white/[0.08] text-slate-500 cursor-default mb-4"
                  >
                    {isCurrent ? "Current Plan" : "Free Forever"}
                  </Button>
                ) : isCurrent ? (
                  <Button
                    disabled
                    className="w-full h-10 bg-primary/20 border border-primary/30 text-primary cursor-default mb-4"
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => onSelectPlan(config.tier, billingCycle, extraSeats)}
                    disabled={isLoading}
                    className={cn(
                      "w-full h-10 font-medium mb-4",
                      isHighlight
                        ? "bg-primary hover:bg-primary/90 text-black"
                        : "bg-white/[0.08] hover:bg-white/[0.12] text-white"
                    )}
                  >
                    {currentTier && currentTier !== "free" && config.tier !== currentTier
                      ? currentTier === "agency" ||
                        (currentTier === "pro" && config.tier === "starter")
                        ? "Downgrade"
                        : "Upgrade"
                      : "Get Started"}
                  </Button>
                )}

                {/* Features */}
                <ul className="space-y-2">
                  {config.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div
                        className={cn(
                          "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                          isHighlight ? "bg-primary/20" : "bg-white/[0.06]"
                        )}
                      >
                        <Check
                          className={cn(
                            "w-2.5 h-2.5",
                            isHighlight ? "text-primary" : "text-slate-400"
                          )}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
