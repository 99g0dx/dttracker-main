import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  useBillingCatalog,
  useBillingSummary,
  useCancelSubscription,
  useCreateCheckout,
  useUpdateSeats,
} from "../../hooks/useBilling";
import type { BillingCycle, BillingTier } from "../../lib/api/billing";
import { formatPrice } from "../../lib/api/billing";
import { supabase } from "../../lib/supabase";

interface SubscriptionProps {
  onNavigate: (path: string) => void;
}

const TIER_ORDER: BillingTier[] = ["starter", "pro", "agency"];

export function Subscription({ onNavigate }: SubscriptionProps) {
  const { data: billing, isLoading, error } = useBillingSummary();
  const { data: catalog } = useBillingCatalog();
  const createCheckout = useCreateCheckout();
  const cancelSubscription = useCancelSubscription();
  const updateSeats = useUpdateSeats();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const checkoutErrorMessage = createCheckout.error?.message || "";
  const isAuthError = /invalid jwt|session expired|not authenticated/i.test(
    checkoutErrorMessage,
  );

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedTier, setSelectedTier] = useState<BillingTier>("starter");
  const [extraSeats, setExtraSeats] = useState(0);

  useEffect(() => {
    if (!billing) return;
    setBillingCycle(billing.subscription.billing_cycle);
    setSelectedTier(billing.subscription.tier);
  }, [billing]);

  const selectedTierConfig = useMemo(
    () => catalog?.tiers.find((tier) => tier.tier === selectedTier),
    [catalog, selectedTier],
  );

  const selectedPlan = useMemo(() => {
    if (!selectedTierConfig) return null;
    return billingCycle === "monthly"
      ? selectedTierConfig.monthly
      : selectedTierConfig.yearly;
  }, [selectedTierConfig, billingCycle]);

  useEffect(() => {
    if (!billing || !selectedPlan) return;
    const isCurrent =
      billing.subscription.tier === selectedTier &&
      billing.subscription.billing_cycle === billingCycle;
    setExtraSeats(isCurrent ? billing.subscription.extra_seats : 0);
  }, [billing, selectedPlan, selectedTier, billingCycle]);

  useEffect(() => {
    let isMounted = true;

    if (billing?.workspace_id) {
      setWorkspaceId(billing.workspace_id);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchWorkspaceId = async () => {
      setWorkspaceLoading(true);
      setWorkspaceError(null);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          throw new Error("Sign in to continue checkout.");
        }

        const { data: workspaceMember, error: workspaceMemberError } =
          await supabase
            .from("workspace_members")
            .select("workspace_id")
            .eq("user_id", data.user.id)
            .limit(1)
            .maybeSingle();

        if (!workspaceMemberError && workspaceMember?.workspace_id) {
          if (isMounted) {
            setWorkspaceId(workspaceMember.workspace_id);
          }
          return;
        }

        const { data: legacyMember } = await supabase
          .from("team_members")
          .select("workspace_id")
          .eq("user_id", data.user.id)
          .limit(1)
          .maybeSingle();

        if (isMounted) {
          setWorkspaceId(legacyMember?.workspace_id || data.user.id);
        }
      } catch (err) {
        if (isMounted) {
          setWorkspaceError(
            err instanceof Error ? err.message : "Unable to resolve workspace.",
          );
        }
      } finally {
        if (isMounted) {
          setWorkspaceLoading(false);
        }
      }
    };

    fetchWorkspaceId();

    return () => {
      isMounted = false;
    };
  }, [billing?.workspace_id]);

  const seatPrice = selectedPlan?.extra_seat_price_cents || 0;
  const basePrice = selectedPlan?.base_price_cents || 0;
  const includedSeats = selectedPlan?.included_seats || 0;
  const maxExtraSeats = selectedPlan?.max_seats != null ? selectedPlan.max_seats - includedSeats : Infinity;
  const totalPrice = basePrice + extraSeats * seatPrice;
  const totalSeats = includedSeats + extraSeats;
  const currency = catalog?.currency || "USD";
  const effectiveWorkspaceId = billing?.workspace_id || workspaceId;
  const isCheckoutDisabled =
    createCheckout.isPending ||
    cancelSubscription.isPending ||
    updateSeats.isPending ||
    !selectedPlan ||
    (selectedTier !== "free" && (workspaceLoading || !effectiveWorkspaceId));

  const handleCheckout = async () => {
    if (!selectedPlan) return;

    if (selectedTier === "free") {
      if (billing?.subscription.tier && billing.subscription.tier !== "free") {
        await cancelSubscription.mutateAsync({
          workspaceId: billing.workspace_id,
        });
      }
      return;
    }

    const checkoutWorkspaceId = billing?.workspace_id || workspaceId;
    if (!checkoutWorkspaceId) {
      setWorkspaceError("Unable to resolve workspace for checkout.");
      return;
    }

    const isCurrentPlan =
      billing?.subscription.tier === selectedTier &&
      billing?.subscription.billing_cycle === billingCycle;

    if (
      isCurrentPlan &&
      billing &&
      extraSeats !== billing.subscription.extra_seats
    ) {
      await updateSeats.mutateAsync({
        workspaceId: checkoutWorkspaceId,
        extraSeats,
      });
      return;
    }

    if (!isCurrentPlan) {
      onNavigate(
        `/payment?plan=${selectedTier}_${billingCycle}&seats=${extraSeats}`,
      );
      return;
    }

    await createCheckout.mutateAsync({
      workspaceId: checkoutWorkspaceId,
      tier: selectedTier,
      billingCycle,
      extraSeats,
    });
  };

  const resetSession = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore sign-out errors
    }
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const formatInterval = (minutes: number) => {
    if (minutes >= 1440) {
      const days = Math.round(minutes / 1440);
      return `Every ${days} day${days === 1 ? "" : "s"}`;
    }
    if (minutes >= 60) {
      const hours = Math.round(minutes / 60);
      return `Every ${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return `Every ${minutes} minutes`;
  };

  const renderLimit = (value: number | null) =>
    value === null ? "Unlimited" : value.toString();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-muted-foreground">Failed to load subscription details</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const isPastDue = billing?.subscription.status === "past_due";
  const isCurrentTier = billing?.subscription.tier === selectedTier;
  const isCurrentCycle = billing?.subscription.billing_cycle === billingCycle;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate("/settings")}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-2">
            Subscription & Seats
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Choose a plan, toggle billing, and set seats before checkout.
          </p>
        </div>
      </div>

      {isPastDue && (
        <Card className="bg-red-500/10 border-red-500/30 max-w-5xl mx-auto">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">
                Payment Past Due
              </p>
              <p className="text-xs text-red-400/80">
                Update payment to restore campaign creation and scraping.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {workspaceError && (
        <Card className="bg-red-500/10 border-red-500/30 max-w-5xl mx-auto">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">
                Checkout unavailable
              </p>
              <p className="text-xs text-red-400/80">{workspaceError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {createCheckout.error && isAuthError && (
        <Card className="bg-amber-500/10 border-amber-500/30 max-w-5xl mx-auto">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">
                Session expired
              </p>
              <p className="text-xs text-amber-400/80">
                Your session is no longer valid. Please sign in again to
                continue checkout.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-9 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={resetSession}
            >
              Reset session
            </Button>
          </CardContent>
        </Card>
      )}

      {createCheckout.error && !isAuthError && (
        <Card className="bg-red-500/10 border-red-500/30 max-w-5xl mx-auto">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Payment Error</p>
              <p className="text-xs text-red-400/80">
                {createCheckout.error.message ||
                  "Failed to initialize checkout. Please try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border max-w-6xl mx-auto">
        <CardContent className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Billing cycle</p>
            <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  billingCycle === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  billingCycle === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Yearly
              </button>
            </div>
            {billingCycle === "yearly" && (
              <p className="text-xs text-emerald-400 mt-2">You save 20%</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="text-muted-foreground">Active campaigns</p>
              <p className="text-foreground text-sm">
                {billing?.usage.active_campaigns_count ?? 0} /{" "}
                {renderLimit(billing?.plan.max_active_campaigns ?? null)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Creators per campaign</p>
              <p className="text-foreground text-sm">
                {renderLimit(billing?.plan.max_creators_per_campaign ?? null)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Scrape interval</p>
              <p className="text-foreground text-sm">
                {billing?.plan
                  ? formatInterval(billing.plan.scrape_interval_minutes)
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Team seats</p>
              <p className="text-foreground text-sm">
                {billing?.seats_used ?? 1} / {billing?.seats_total ?? 1}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {TIER_ORDER.map((tier) => {
          const tierConfig = catalog?.tiers.find((item) => item.tier === tier);
          const tierPlan =
            billingCycle === "monthly"
              ? tierConfig?.monthly
              : tierConfig?.yearly;
          const isSelected = tier === selectedTier;
          const isCurrentPlan =
            billing?.subscription.tier === tier &&
            billing?.subscription.billing_cycle === billingCycle;

          return (
            <Card
              key={tier}
              className={`bg-card border-border cursor-pointer transition-all ${
                isSelected
                  ? "border-primary/60 shadow-lg shadow-primary/20"
                  : ""
              }`}
              onClick={() => setSelectedTier(tier)}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {tier}
                    </p>
                    <h3 className="text-lg font-semibold text-foreground capitalize">
                      {tier === "free" ? "Free" : tier}
                    </h3>
                  </div>
                  {isCurrentPlan && (
                    <span className="text-xs px-2 py-1 rounded-full bg-muted/40 text-foreground">
                      Current
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-3xl font-semibold text-foreground">
                    {tierPlan
                      ? formatPrice(tierPlan.base_price_cents, currency)
                      : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tier === "free"
                      ? "No credit card required"
                      : `per ${billingCycle}`}
                  </p>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>
                      {tierPlan?.included_seats ?? 1} included seat
                      {tierPlan?.included_seats === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>
                      {renderLimit(tierPlan?.max_active_campaigns ?? null)}{" "}
                      active campaigns
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>
                      {renderLimit(tierPlan?.max_creators_per_campaign ?? null)}{" "}
                      creators per campaign
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>
                      {tierPlan
                        ? formatInterval(tierPlan.scrape_interval_minutes)
                        : "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border max-w-6xl mx-auto">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Selected plan</p>
              <h3 className="text-xl font-semibold text-foreground capitalize">
                {selectedTier} ({billingCycle})
              </h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total today</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatPrice(totalPrice, currency)}
              </p>
            </div>
          </div>

          {selectedTier !== "free" && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Seats</p>
                <p className="text-xs text-muted-foreground">
                  Included seats: {selectedPlan?.included_seats ?? 1}. Extra
                  seats are {formatPrice(seatPrice, currency)} each.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="h-9 w-9 p-0"
                  onClick={() => setExtraSeats(Math.max(0, extraSeats - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="min-w-[80px] text-center">
                  <p className="text-sm text-muted-foreground">Extra seats</p>
                  <p className="text-lg font-semibold text-foreground">
                    {extraSeats}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-9 w-9 p-0"
                  disabled={extraSeats >= maxExtraSeats}
                  onClick={() => setExtraSeats(Math.min(extraSeats + 1, maxExtraSeats))}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <div className="text-sm text-muted-foreground">
                  Total seats: <span className="text-foreground">{totalSeats}</span>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleCheckout}
            disabled={isCheckoutDisabled}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {createCheckout.isPending || updateSeats.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : workspaceLoading ? (
              "Loading workspace..."
            ) : selectedTier === "free" &&
              billing?.subscription.tier === "free" ? (
              "Current plan"
            ) : selectedTier === "free" ? (
              "Downgrade to Free"
            ) : !effectiveWorkspaceId ? (
              "Sign in to continue"
            ) : isCurrentTier &&
              isCurrentCycle &&
              extraSeats === billing?.subscription.extra_seats ? (
              "Current plan"
            ) : isCurrentTier && isCurrentCycle ? (
              "Update seats"
            ) : (
              "Continue to checkout"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
