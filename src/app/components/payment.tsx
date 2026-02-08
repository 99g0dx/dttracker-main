import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, CheckCircle2, Shield, Lock, Loader2, AlertCircle, Minus, Plus } from 'lucide-react';
import { useCreateCheckout, useBillingCatalog, useBillingSummary } from '../../hooks/useBilling';
import type { BillingCycle, BillingTier } from '../../lib/api/billing';
import { formatPrice } from '../../lib/api/billing';
import { supabase } from '../../lib/supabase';
import { getBillingCallbackUrl } from '../../lib/env';

interface PaymentProps {
  onNavigate: (path: string) => void;
}

export function Payment({ onNavigate }: PaymentProps) {
  const [searchParams] = useSearchParams();
  const planSlug = (searchParams.get('plan') || 'pro').toLowerCase();

  const { data: catalog, isLoading: plansLoading } = useBillingCatalog();
  const { data: billing, isLoading: billingLoading, error: billingError } = useBillingSummary();
  const createCheckout = useCreateCheckout();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const tierOptions: BillingTier[] = ['starter', 'pro', 'agency'];
  const cycleOptions: BillingCycle[] = ['monthly', 'yearly'];
  const planParts = planSlug.split(/[_-]/);
  const tierFromParam = tierOptions.find((tier) => planParts.includes(tier)) || 'pro';
  const cycleParam = searchParams.get('cycle')?.toLowerCase() as BillingCycle | undefined;
  const cycleFromParam = cycleOptions.find((cycle) => planParts.includes(cycle));
  const initialBillingCycle =
    (cycleParam && cycleOptions.includes(cycleParam) ? cycleParam : cycleFromParam) || 'monthly';
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const selectedTier = tierFromParam;
  const selectedTierConfig = useMemo(
    () => catalog?.tiers.find((tier) => tier.tier === selectedTier),
    [catalog, selectedTier]
  );
  const selectedPlan = useMemo(() => {
    if (!selectedTierConfig) return null;
    const preferred =
      billingCycle === 'monthly'
        ? selectedTierConfig.monthly
        : selectedTierConfig.yearly;
    return preferred || selectedTierConfig.monthly || selectedTierConfig.yearly || null;
  }, [selectedTierConfig, billingCycle]);
  const currency = catalog?.currency || 'USD';

  const initialExtraSeats = Math.max(0, Number(searchParams.get('seats') || 0));
  const [extraSeats, setExtraSeats] = useState(initialExtraSeats);
  const includedSeats = selectedPlan?.included_seats || 1;
  const extraSeatPrice = selectedPlan?.extra_seat_price_cents || 0;
  const basePrice = selectedPlan?.base_price_cents || 0;
  const totalSeats = includedSeats + extraSeats;
  const totalPrice = basePrice + extraSeats * extraSeatPrice;
  const isPaidTier = selectedTier !== 'free';
  const allowExtraSeats = isPaidTier && selectedPlan?.extra_seat_price_cents !== null;
  const cycleLabel = billingCycle === 'yearly' ? 'year' : 'month';
  const effectiveWorkspaceId = billing?.workspace_id || workspaceId;
  const initialProviderParam = (searchParams.get('provider') || 'paystack').toLowerCase();
  const [provider, setProvider] = useState<'paystack' | 'stripe'>(
    initialProviderParam === 'stripe' ? 'stripe' : 'paystack'
  );
  const isStripeConfigured = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  const isProviderReady = provider === 'paystack';
  const isCheckoutDisabled =
    createCheckout.isPending ||
    !selectedPlan ||
    !isPaidTier ||
    !effectiveWorkspaceId ||
    workspaceLoading ||
    !isProviderReady;

  useEffect(() => {
    if (selectedTier === 'free' || !selectedPlan) {
      setExtraSeats(0);
    }
  }, [selectedTier, selectedPlan]);

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
          throw new Error('Sign in to continue checkout.');
        }

        const { data: workspaceMember, error: workspaceMemberError } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', data.user.id)
          .limit(1)
          .maybeSingle();

        if (!workspaceMemberError && workspaceMember?.workspace_id) {
          if (isMounted) {
            setWorkspaceId(workspaceMember.workspace_id);
          }
          return;
        }

        const { data: legacyMember } = await supabase
          .from('team_members')
          .select('workspace_id')
          .eq('user_id', data.user.id)
          .limit(1)
          .maybeSingle();

        if (isMounted) {
          setWorkspaceId(legacyMember?.workspace_id || data.user.id);
        }
      } catch (err) {
        if (isMounted) {
          setWorkspaceError(err instanceof Error ? err.message : 'Unable to resolve workspace.');
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

  useEffect(() => {
    if (!selectedTierConfig) return;
    if (billingCycle === 'yearly' && !selectedTierConfig.yearly) {
      setBillingCycle('monthly');
    }
  }, [billingCycle, selectedTierConfig]);

  const planHighlights = useMemo(() => {
    if (!selectedPlan) return [];
    const formatLimit = (value: number | null, label: string) =>
      value === null ? `Unlimited ${label}` : `${value} ${label}`;
    const formatInterval = (minutes: number) => {
      if (minutes >= 1440) {
        const days = Math.round(minutes / 1440);
        return `Every ${days} day${days === 1 ? '' : 's'}`;
      }
      if (minutes >= 60) {
        const hours = Math.round(minutes / 60);
        return `Every ${hours} hour${hours === 1 ? '' : 's'}`;
      }
      return `Every ${minutes} minutes`;
    };
    const formatRetention = (days: number) =>
      days >= 36500 ? 'Unlimited retention' : `${days}-day retention`;
    const formatPlatform = (platform: string) => {
      if (platform.toLowerCase() === 'x') return 'X';
      return platform.charAt(0).toUpperCase() + platform.slice(1);
    };
    const platformLabel = selectedPlan.platforms.length
      ? selectedPlan.platforms.map(formatPlatform).join(', ')
      : 'No platforms';

    const highlights = [
      formatLimit(selectedPlan.max_active_campaigns, 'active campaigns'),
      formatLimit(selectedPlan.max_creators_per_campaign, 'creators per campaign'),
      `Platforms: ${platformLabel}`,
      `Scrape interval: ${formatInterval(selectedPlan.scrape_interval_minutes)}`,
      formatRetention(selectedPlan.retention_days),
      `Seats included: ${selectedPlan.included_seats}`,
    ];

    if (selectedPlan.api_access) highlights.push('API access');
    if (selectedPlan.white_label) highlights.push('White-label reports');
    return highlights;
  }, [selectedPlan]);

  const handleCheckout = async () => {
    if (!selectedPlan || !isPaidTier) return;
    if (provider === 'stripe') {
      return;
    }

    const checkoutWorkspaceId = billing?.workspace_id || workspaceId;
    if (!checkoutWorkspaceId) {
      setWorkspaceError('Unable to resolve workspace for checkout.');
      return;
    }

    try {
      await createCheckout.mutateAsync({
        workspaceId: checkoutWorkspaceId,
        tier: selectedTier,
        billingCycle,
        extraSeats,
        callbackUrl: getBillingCallbackUrl(),
      });
      // The mutation will redirect to Paystack automatically
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
  };

  const checkoutErrorMessage = createCheckout.error?.message || '';
  const isAuthError = /invalid jwt|session expired|not authenticated/i.test(
    checkoutErrorMessage
  );

  const resetSession = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore sign-out errors
    }
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
    window.location.href = '/login';
  };

  // If already subscribed, redirect to subscription page
  useEffect(() => {
    if (billing?.is_paid && billing?.subscription?.status === 'active') {
      onNavigate('/subscription');
    }
  }, [billing, onNavigate]);

  // Format price for display
  if (plansLoading || billingLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('/subscription')}
          className="w-10 h-10 rounded-lg bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Complete Your Purchase</h1>
          <p className="text-sm text-muted-foreground mt-1">Secure checkout powered by Paystack</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border sticky top-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Order Summary</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-foreground">
                      DTTracker {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {billingCycle === 'yearly' ? 'Yearly subscription (20% off)' : 'Monthly subscription'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Seats included: {includedSeats}
                    </p>
                  </div>
                  <p className="font-semibold text-foreground">
                    {selectedPlan ? formatPrice(selectedPlan.base_price_cents, currency) : '--'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Subtotal (before tax)</p>
                    <p className="text-muted-foreground">
                      {selectedPlan ? formatPrice(totalPrice, currency) : '--'}
                    </p>
                  </div>
                  {allowExtraSeats && extraSeats > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm text-muted-foreground">Extra seats x{extraSeats}</p>
                      <p className="text-muted-foreground">
                        {formatPrice(extraSeats * extraSeatPrice, currency)}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-muted-foreground">Tax</p>
                    <p className="text-muted-foreground">Calculated at checkout</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-foreground">Total</p>
                    <p className="text-xl font-semibold text-foreground">
                      {selectedPlan ? formatPrice(totalPrice, currency) : '--'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed {billingCycle} • Cancel anytime
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Secure checkout via Paystack</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Secure payment processing</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Billing cycle</h3>
                  <p className="text-sm text-muted-foreground">
                    Toggle yearly to save 20%.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-border bg-black/40 p-1">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      billingCycle === 'monthly'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      billingCycle === 'yearly'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              {selectedPlan && (
                <div className="bg-muted/40 rounded-lg p-4 mb-6 border border-border/60">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Seats</p>
                      <p className="text-xs text-muted-foreground">
                        Included: {includedSeats}.{' '}
                        {allowExtraSeats
                          ? `Extra seats are ${formatPrice(extraSeatPrice, currency)} each.`
                          : 'Extra seats are not available on this plan.'}
                      </p>
                    </div>
                    {allowExtraSeats ? (
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          className="h-9 w-9 p-0"
                          onClick={() => setExtraSeats(Math.max(0, extraSeats - 1))}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <div className="min-w-[90px] text-center">
                          <p className="text-xs text-muted-foreground">Extra seats</p>
                          <p className="text-lg font-semibold text-foreground">{extraSeats}</p>
                        </div>
                        <Button
                          variant="outline"
                          className="h-9 w-9 p-0"
                          onClick={() => setExtraSeats(extraSeats + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <div className="text-sm text-muted-foreground">
                          Total seats: <span className="text-foreground">{totalSeats}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Total seats: <span className="text-foreground">{totalSeats}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-muted/40 rounded-lg p-4 mb-6 border border-border/60">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment provider</p>
                    <p className="text-xs text-muted-foreground">
                      Choose how you'd like to pay for your subscription.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setProvider('paystack')}
                      className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                        provider === 'paystack'
                          ? 'bg-primary text-primary-foreground border-border'
                          : 'border-border/80 text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      Paystack
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvider('stripe')}
                      className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                        provider === 'stripe'
                          ? 'bg-primary text-primary-foreground border-border'
                          : 'border-border/80 text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      Stripe
                    </button>
                  </div>
                </div>
                {provider === 'stripe' && (
                  <p className="text-xs text-amber-400 mt-3">
                    {isStripeConfigured
                      ? 'Stripe checkout is not wired yet. Please use Paystack for now.'
                      : 'Stripe is not configured yet. Add `VITE_STRIPE_PUBLISHABLE_KEY` to enable it.'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="120" height="120" rx="20" fill="#00C3F7"/>
                    <path d="M30 60L50 40V80L30 60Z" fill="white"/>
                    <path d="M50 40L70 20V100L50 80V40Z" fill="white"/>
                    <path d="M70 20L90 40V60L70 80V20Z" fill="white"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {provider === 'stripe' ? 'Pay with Stripe' : 'Pay with Paystack'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {provider === 'stripe'
                      ? 'Credit card, Apple Pay, Google Pay & more'
                      : 'Credit card, debit card, bank transfer & more'}
                  </p>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-4 mb-6 border border-border/60">
                <p className="text-sm text-muted-foreground mb-2">
                  {provider === 'stripe'
                    ? "You'll be redirected to Stripe's secure checkout to complete your payment."
                    : "You'll be redirected to Paystack's secure checkout to complete your payment."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {provider === 'stripe'
                    ? 'Stripe supports global cards and local payment methods based on your region.'
                    : 'Paystack accepts cards from all countries and converts to your local currency at checkout.'}
                </p>
              </div>

              {/* Plan features preview */}
              {selectedPlan && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">
                    What's included in {selectedTier}:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {planHighlights.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {workspaceError && (
                <div className="flex items-start gap-3 p-4 mb-6 bg-red-500/10 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">Checkout unavailable</p>
                    <p className="text-xs text-red-400/80">{workspaceError}</p>
                  </div>
                </div>
              )}

              {billingError && (
                <div className="flex items-start gap-3 p-4 mb-6 bg-red-500/10 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">Unable to load billing details</p>
                    <p className="text-xs text-red-400/80">
                      Please refresh the page or sign in again to continue.
                    </p>
                  </div>
                </div>
              )}

              {createCheckout.error && isAuthError && (
                <div className="flex items-start gap-3 p-4 mb-6 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-400 mb-1">Session expired</p>
                    <p className="text-xs text-amber-400/80">
                      Your session is no longer valid. Please sign in again to continue checkout.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="h-9 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                    onClick={resetSession}
                  >
                    Reset session
                  </Button>
                </div>
              )}

              {createCheckout.error && !isAuthError && (
                <div className="flex items-start gap-3 p-4 mb-6 bg-red-500/10 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">Payment Error</p>
                    <p className="text-xs text-red-400/80">
                      {createCheckout.error.message || 'Failed to initialize checkout. Please try again.'}
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCheckout}
                disabled={isCheckoutDisabled}
                className={`w-full h-12 font-medium ${
                  provider === 'stripe'
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {createCheckout.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting to Paystack...
                  </span>
                ) : workspaceLoading ? (
                  'Loading workspace...'
                ) : !isPaidTier ? (
                  'Select a paid plan to continue'
                ) : !effectiveWorkspaceId ? (
                  'Sign in to continue'
                ) : provider === 'stripe' ? (
                  'Stripe unavailable'
                ) : (
                  `Continue to ${provider === 'stripe' ? 'Stripe' : 'Paystack'} • ${
                    selectedPlan ? formatPrice(totalPrice, currency) : '--'
                  }/${cycleLabel}`
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                By continuing, you agree to our Terms of Service and Privacy Policy.
                Your subscription will automatically renew each billing cycle until canceled.
              </p>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-lg border border-border/60">
            <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Secure Payment</p>
              <p className="text-xs text-muted-foreground">
                Your payment information is processed securely by{' '}
                {provider === 'stripe' ? 'Stripe' : 'Paystack'}. We never see or store your card details.
                {provider === 'stripe'
                  ? ' Stripe is PCI-DSS Level 1 certified.'
                  : ' Paystack is PCI-DSS Level 1 certified, the highest level of security.'}
              </p>
            </div>
          </div>

          {/* Accepted Payment Methods */}
          <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
            <span className="text-xs text-muted-foreground">Accepted payment methods:</span>
            <div className="flex items-center gap-3 flex-wrap">
              {provider === 'stripe' ? (
                <>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Visa</div>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Mastercard</div>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Apple Pay</div>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Google Pay</div>
                </>
              ) : (
                <>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Visa</div>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Mastercard</div>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">Bank Transfer</div>
                  <div className="px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground">USSD</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
