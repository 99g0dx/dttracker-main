import React, { useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Clock,
  XCircle,
  Settings,
} from "lucide-react";
import {
  useBillingSummary,
  useBillingCatalog,
  useCreateCheckout,
  useCancelSubscription,
} from "../../hooks/useBilling";
import { PricingCards, UsageMeters } from "./billing";
import { BillingTier, BillingCycle } from "../../lib/api/billing";
import { getBillingCallbackUrl } from "../../lib/env";

interface SubscriptionProps {
  onNavigate: (path: string) => void;
}

export function Subscription({ onNavigate }: SubscriptionProps) {
  const {
    data: billing,
    isLoading: billingLoading,
    error: billingError,
  } = useBillingSummary();
  const { data: catalog, isLoading: catalogLoading } = useBillingCatalog();
  const createCheckout = useCreateCheckout();
  const cancelSubscription = useCancelSubscription();

  // Transform catalog into grouped format for PricingCards
  const groupedPlans = useMemo(() => {
    if (!catalog?.tiers) return null;

    const result: Record<BillingTier, { monthly?: any; yearly?: any }> = {
      free: {},
      starter: {},
      pro: {},
      agency: {},
    };

    catalog.tiers.forEach((tier) => {
      if (tier.tier in result) {
        result[tier.tier as BillingTier] = {
          monthly: tier.monthly,
          yearly: tier.yearly,
        };
      }
    });

    return result;
  }, [catalog]);

  const handleSelectPlan = async (
    tier: BillingTier,
    billingCycle: BillingCycle,
    extraSeats: number,
  ) => {
    if (!billing?.workspace_id) return;

    try {
      await createCheckout.mutateAsync({
        workspaceId: billing.workspace_id,
        tier,
        billingCycle,
        extraSeats,
        callbackUrl: getBillingCallbackUrl(),
      });
    } catch (error) {
      console.error("Failed to create checkout:", error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!billing?.workspace_id) return;

    if (
      !confirm(
        "Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.",
      )
    ) {
      return;
    }

    try {
      await cancelSubscription.mutateAsync({
        workspaceId: billing.workspace_id,
      });
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
    }
  };

  const isLoading = billingLoading || catalogLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (billingError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-slate-400">Failed to load subscription details</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const currentTier = billing?.subscription?.tier || "pro";
  const currentBillingCycle = billing?.subscription?.billing_cycle || "monthly";
  const status = billing?.subscription?.status || "active";
  const isPaid = billing?.is_paid || false;
  const isTrialing = billing?.is_trialing || false;
  const isPastDue = status === "past_due";
  const isCanceled =
    status === "canceled" || billing?.subscription?.cancel_at_period_end;
  const daysUntilPeriodEnd = billing?.days_until_period_end;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate("/settings")}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-left sm:text-center min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2 sm:mb-3">
            {isPaid || isTrialing ? "Manage Subscription" : "Choose Your Plan"}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 px-2">
            {isPaid || isTrialing
              ? "View and manage your current subscription"
              : "Start with a 14-day Pro trial and upgrade when you need more power"}
          </p>
        </div>
      </div>

      {/* Current Status Banner */}
      {(isTrialing || isPastDue || isCanceled) && (
        <Card
          className={`max-w-6xl mx-auto ${
            isPastDue
              ? "bg-red-500/10 border-red-500/30"
              : isCanceled
                ? "bg-yellow-500/10 border-yellow-500/30"
                : "bg-primary/10 border-primary/30"
          }`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            {isPastDue ? (
              <>
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">
                    Payment Past Due
                  </p>
                  <p className="text-xs text-red-400/80">
                    Please update your payment method to continue using paid
                    features.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    onNavigate(
                      `/payment?plan=${currentTier}_${currentBillingCycle}`,
                    )
                  }
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Update Payment
                </Button>
              </>
            ) : isCanceled ? (
              <>
                <XCircle className="w-5 h-5 text-yellow-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-400">
                    Subscription Canceled
                  </p>
                  <p className="text-xs text-yellow-400/80">
                    You will retain access until{" "}
                    {daysUntilPeriodEnd !== null
                      ? `${daysUntilPeriodEnd} days remaining`
                      : "the end of your billing period"}
                    .
                  </p>
                </div>
                <Button
                  onClick={() =>
                    onNavigate(
                      `/payment?plan=${currentTier}_${currentBillingCycle}`,
                    )
                  }
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  Resubscribe
                </Button>
              </>
            ) : isTrialing ? (
              <>
                <Clock className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Trial Active</p>
                  <p className="text-xs text-slate-400">
                    {daysUntilPeriodEnd !== null
                      ? `${daysUntilPeriodEnd} day${daysUntilPeriodEnd === 1 ? "" : "s"} remaining in your trial`
                      : "Your trial is active"}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    onNavigate(
                      `/payment?plan=${currentTier}_${currentBillingCycle}`,
                    )
                  }
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-black"
                >
                  Subscribe Now
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Usage Overview (for paid users) */}
      {(isPaid || isTrialing) && billing && (
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-6xl mx-auto">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Current Usage</h3>
              <span className="text-sm text-slate-400 capitalize">
                {currentTier} Plan ({currentBillingCycle})
              </span>
            </div>
            <UsageMeters
              campaigns={{
                current: billing.usage?.active_campaigns_count || 0,
                limit: billing.plan?.max_active_campaigns || -1,
              }}
              seats={{
                current: billing.seats_used || 1,
                limit: billing.seats_total || 1,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Pricing Cards */}
      {groupedPlans && (
        <div className="max-w-6xl mx-auto">
          <PricingCards
            plans={groupedPlans}
            currentTier={currentTier as BillingTier}
            currentBillingCycle={currentBillingCycle as BillingCycle}
            onSelectPlan={handleSelectPlan}
            isLoading={createCheckout.isPending}
          />
        </div>
      )}

      {/* Subscription Details (for active subscribers) */}
      {(isPaid || isTrialing) && billing?.subscription && (
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-6xl mx-auto">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Subscription Details</h3>
              {!billing.subscription.cancel_at_period_end && isPaid && (
                <Button
                  onClick={handleCancelSubscription}
                  disabled={cancelSubscription.isPending}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                >
                  {cancelSubscription.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Canceling...
                    </span>
                  ) : (
                    "Cancel Subscription"
                  )}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="text-white capitalize">{status}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Plan</p>
                <p className="text-white capitalize">
                  {currentTier} ({currentBillingCycle})
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Team Seats</p>
                <p className="text-white">
                  {billing.seats_used} / {billing.seats_total} used
                </p>
              </div>
              {daysUntilPeriodEnd !== null && (
                <div>
                  <p className="text-sm text-slate-500">
                    {isTrialing ? "Trial Ends" : "Next Billing"}
                  </p>
                  <p className="text-white">In {daysUntilPeriodEnd} days</p>
                </div>
              )}
            </div>

            {/* Manage Seats Button */}
            {isPaid && billing.subscription.extra_seats !== undefined && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <Button
                  onClick={() => onNavigate("/settings/team")}
                  variant="outline"
                  size="sm"
                  className="bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Team & Seats
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-6xl mx-auto">
        <CardContent className="p-6">
          <h3 className="font-semibold text-white mb-4">
            Frequently Asked Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Can I cancel anytime?
              </h4>
              <p className="text-sm text-slate-400">
                Yes, you can cancel your subscription at any time. You'll retain
                access until the end of your billing period.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                What payment methods do you accept?
              </h4>
              <p className="text-sm text-slate-400">
                We accept all major credit cards, debit cards, bank transfers,
                and mobile money through Paystack.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Can I change plans later?
              </h4>
              <p className="text-sm text-slate-400">
                Yes, you can upgrade or downgrade your plan at any time. Changes
                take effect immediately.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                How do extra seats work?
              </h4>
              <p className="text-sm text-slate-400">
                Each plan includes a set number of team seats. You can add up to
                2 extra seats during checkout or later from your settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
