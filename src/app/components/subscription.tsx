import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Check, Zap, Crown, ArrowLeft, Loader2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { useSubscriptionStatus, useStartTrial, useCancelSubscription, usePlans } from "../../hooks/useBilling";

interface SubscriptionProps {
  onNavigate: (path: string) => void;
}

const freePlanFeatures = [
  "Up to 2 active campaigns",
  "Up to 5 creators per campaign",
  "Basic analytics dashboard",
  "Manual post tracking",
  "Email support",
  "Data export (CSV)",
];

const proPlanFeatures = [
  "Unlimited campaigns",
  "Unlimited creators",
  "Advanced analytics & insights",
  "Automated post scraping",
  "Multi-platform support (TikTok, Instagram, YouTube, Twitter, Facebook)",
  "Real-time performance tracking",
  "Custom reports & dashboards",
  "Priority support (24/7)",
  "API access",
  "Team collaboration",
  "Data retention (unlimited)",
  "White-label reports",
];

export function Subscription({ onNavigate }: SubscriptionProps) {
  const {
    isLoading,
    error,
    status,
    isPaid,
    isTrialing,
    canStartTrial,
    daysUntilTrialEnd,
    daysUntilPeriodEnd,
    plan,
    subscription,
  } = useSubscriptionStatus();

  const { data: plans } = usePlans();
  const startTrial = useStartTrial();
  const cancelSubscription = useCancelSubscription();

  const proPlan = plans?.find(p => p.slug === 'pro');

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const handleStartTrial = async () => {
    try {
      await startTrial.mutateAsync();
    } catch (error) {
      console.error('Failed to start trial:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      return;
    }
    try {
      await cancelSubscription.mutateAsync();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-slate-400">Failed to load subscription details</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // Determine current plan state
  const isOnFreePlan = !isPaid && !isTrialing;
  const isOnTrial = isTrialing;
  const isSubscribed = isPaid && status === 'active';
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled' || subscription?.cancel_at_period_end;

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
            {isSubscribed || isOnTrial ? 'Manage Subscription' : 'Choose Your Plan'}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 px-2">
            {isSubscribed || isOnTrial
              ? 'View and manage your current subscription'
              : 'Start with our free plan and upgrade anytime to unlock powerful features for professional campaign tracking.'
            }
          </p>
        </div>
      </div>

      {/* Current Status Banner */}
      {(isOnTrial || isPastDue || isCanceled) && (
        <Card className={`max-w-5xl mx-auto ${
          isPastDue ? 'bg-red-500/10 border-red-500/30' :
          isCanceled ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-primary/10 border-primary/30'
        }`}>
          <CardContent className="p-4 flex items-center gap-3">
            {isPastDue ? (
              <>
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Payment Past Due</p>
                  <p className="text-xs text-red-400/80">Please update your payment method to continue using Pro features.</p>
                </div>
                <Button
                  onClick={() => onNavigate('/payment?plan=pro')}
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
                  <p className="text-sm font-medium text-yellow-400">Subscription Canceled</p>
                  <p className="text-xs text-yellow-400/80">
                    You will retain access until {daysUntilPeriodEnd !== null ? `${daysUntilPeriodEnd} days remaining` : 'the end of your billing period'}.
                  </p>
                </div>
                <Button
                  onClick={() => onNavigate('/payment?plan=pro')}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  Resubscribe
                </Button>
              </>
            ) : isOnTrial ? (
              <>
                <Clock className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Trial Active</p>
                  <p className="text-xs text-slate-400">
                    {daysUntilTrialEnd !== null
                      ? `${daysUntilTrialEnd} day${daysUntilTrialEnd === 1 ? '' : 's'} remaining in your trial`
                      : 'Your trial is active'
                    }
                  </p>
                </div>
                <Button
                  onClick={() => onNavigate('/payment?plan=pro')}
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

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Free Plan */}
        <Card className={`bg-[#0D0D0D] relative overflow-hidden ${
          isOnFreePlan ? 'border-primary/30' : 'border-white/[0.08]'
        }`}>
          {isOnFreePlan && (
            <div className="absolute top-0 right-0 bg-primary text-black text-xs font-medium px-3 py-1 rounded-bl-lg">
              Current Plan
            </div>
          )}
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <Zap className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Starter</h3>
                <p className="text-sm text-slate-500">For getting started</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-white">$0</span>
                <span className="text-slate-500">/month</span>
              </div>
            </div>

            {isOnFreePlan ? (
              <Button
                disabled
                className="w-full h-10 bg-white/[0.03] border border-white/[0.08] text-slate-400 cursor-default mb-8"
              >
                Current Plan
              </Button>
            ) : (
              <Button
                disabled
                className="w-full h-10 bg-white/[0.03] border border-white/[0.08] text-slate-500 cursor-default mb-8"
              >
                Included Features
              </Button>
            )}

            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-400">
                Features included:
              </p>
              <ul className="space-y-3">
                {freePlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className={`relative overflow-hidden ${
          isSubscribed || isOnTrial
            ? 'bg-gradient-to-b from-primary/20 to-[#0D0D0D] border-primary/50'
            : 'bg-gradient-to-b from-primary/10 to-[#0D0D0D] border-primary/30'
        }`}>
          {/* Badge */}
          <div className={`absolute top-0 right-0 text-xs font-medium px-3 py-1 rounded-bl-lg ${
            isSubscribed ? 'bg-primary text-black' :
            isOnTrial ? 'bg-primary/80 text-black' :
            'bg-slate-800 text-slate-300'
          }`}>
            {isSubscribed ? 'Active' : isOnTrial ? 'Trial' : 'Popular'}
          </div>

          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Pro</h3>
                <p className="text-sm text-slate-400">For professionals</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-white">
                  {proPlan ? formatPrice(proPlan.price_amount) : '$49'}
                </span>
                <span className="text-slate-400">/month</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Billed monthly</p>
            </div>

            {isSubscribed ? (
              <div className="space-y-2 mb-8">
                <Button
                  disabled
                  className="w-full h-10 bg-primary/20 border border-primary/30 text-primary cursor-default"
                >
                  Current Plan
                </Button>
                {!subscription?.cancel_at_period_end && (
                  <Button
                    onClick={handleCancelSubscription}
                    disabled={cancelSubscription.isPending}
                    variant="ghost"
                    className="w-full h-10 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    {cancelSubscription.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Canceling...
                      </span>
                    ) : (
                      'Cancel Subscription'
                    )}
                  </Button>
                )}
              </div>
            ) : isOnTrial ? (
              <Button
                onClick={() => onNavigate("/payment?plan=pro")}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-black font-medium mb-8"
              >
                Subscribe Now
              </Button>
            ) : canStartTrial ? (
              <Button
                onClick={handleStartTrial}
                disabled={startTrial.isPending}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-black font-medium mb-8"
              >
                {startTrial.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Trial...
                  </span>
                ) : (
                  'Start 14-Day Free Trial'
                )}
              </Button>
            ) : (
              <Button
                onClick={() => onNavigate("/payment?plan=pro")}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-black font-medium mb-8"
              >
                Upgrade to Pro
              </Button>
            )}

            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-400">
                Everything in Free, plus:
              </p>
              <ul className="space-y-3">
                {proPlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Details (for active subscribers) */}
      {(isSubscribed || isOnTrial) && subscription && (
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-5xl mx-auto">
          <CardContent className="p-8">
            <h3 className="font-semibold text-white mb-4">Subscription Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="text-white capitalize">{status}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Plan</p>
                <p className="text-white">{plan?.name || 'Pro'}</p>
              </div>
              {isOnTrial && daysUntilTrialEnd !== null && (
                <div>
                  <p className="text-sm text-slate-500">Trial Ends</p>
                  <p className="text-white">{daysUntilTrialEnd} days remaining</p>
                </div>
              )}
              {isSubscribed && daysUntilPeriodEnd !== null && (
                <div>
                  <p className="text-sm text-slate-500">Next Billing</p>
                  <p className="text-white">In {daysUntilPeriodEnd} days</p>
                </div>
              )}
              {subscription.billing_email && (
                <div>
                  <p className="text-sm text-slate-500">Billing Email</p>
                  <p className="text-white">{subscription.billing_email}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ / Additional Info */}
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-5xl mx-auto">
        <CardContent className="p-8">
          <h3 className="font-semibold text-white mb-4">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Can I cancel anytime?
              </h4>
              <p className="text-sm text-slate-400">
                Yes, you can cancel your Pro subscription at any time. You'll
                retain access until the end of your billing period.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                What payment methods do you accept?
              </h4>
              <p className="text-sm text-slate-400">
                We accept all major credit cards (Visa, MasterCard), debit cards,
                bank transfers, and mobile money through Paystack.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Is there a free trial for Pro?
              </h4>
              <p className="text-sm text-slate-400">
                Yes! All new Pro subscriptions include a 14-day free trial. No
                credit card required to start.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                What happens after my trial ends?
              </h4>
              <p className="text-sm text-slate-400">
                After your 14-day trial, you'll need to subscribe to continue
                using Pro features. If you don't subscribe, you'll be moved to
                the free plan automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
