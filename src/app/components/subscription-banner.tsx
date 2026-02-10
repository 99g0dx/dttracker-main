import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBillingSummary } from '../../hooks/useBilling';
import { shouldShowSubscriptionBanner } from '../../lib/entitlements';
import { Button } from './ui/button';

export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { data: billing, isLoading } = useBillingSummary();

  if (isLoading || !shouldShowSubscriptionBanner(billing)) return null;

  const subscriptionStatus = billing?.subscription?.status || 'free';
  const daysLeft = billing?.days_until_period_end ?? 0;
  const isTrialing = subscriptionStatus === 'trialing';
  const trialExpired = isTrialing && daysLeft <= 0;
  const activeTrial = isTrialing && daysLeft > 0;

  let message = 'Subscribe to continue using DTTracker.';
  if (activeTrial) {
    message =
      daysLeft === 1
        ? 'Your trial ends tomorrow. Subscribe to continue.'
        : `Your trial ends in ${daysLeft} days. Subscribe to continue.`;
  } else if (trialExpired) {
    message = 'Your free trial has ended. Subscribe to unlock full access.';
  } else if (subscriptionStatus === 'past_due') {
    message = 'Your payment is past due. Update billing to regain access.';
  } else if (subscriptionStatus === 'canceled' || subscriptionStatus === 'incomplete') {
    message = 'Your subscription is inactive. Subscribe to continue.';
  }

  return (
    <div
      role="banner"
      className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <p className="text-foreground">{message}</p>
      <Button
        size="sm"
        onClick={() => navigate('/subscription')}
        className="shrink-0"
      >
        Subscribe to continue
      </Button>
    </div>
  );
}
