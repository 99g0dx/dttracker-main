import { supabase } from '../supabase';

// Types
export interface BillingPlan {
  slug: string;
  name: string;
  description: string;
  price_amount: number; // USD cents
  currency: string;
  interval: string;
  features: Record<string, boolean>;
  limits: {
    campaigns: number;
    creators_per_campaign: number;
    team_members: number;
  };
}

export interface Subscription {
  id: string;
  workspace_id: string;
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  plan_slug: string;
  trial_start_at: string | null;
  trial_end_at: string | null;
  trial_used: boolean;
  current_period_start_at: string | null;
  current_period_end_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  billing_email: string | null;
  last_payment_at: string | null;
}

export interface BillingSummary {
  subscription: Subscription;
  plan: BillingPlan;
  is_paid: boolean;
  is_trialing: boolean;
  can_start_trial: boolean;
  days_until_trial_end: number | null;
  days_until_period_end: number | null;
}

export interface CheckoutResponse {
  success: boolean;
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface TrialResponse {
  success: boolean;
  message: string;
  subscription: {
    status: string;
    plan_slug: string;
    trial_start_at: string;
    trial_end_at: string;
  };
}

export interface CancelResponse {
  success: boolean;
  message: string;
  effective_immediately: boolean;
  access_until?: string;
}

// API Functions

/**
 * Get billing summary for current user's workspace
 */
export async function getBillingSummary(): Promise<BillingSummary> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('billing-summary', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch billing summary');
  }

  return response.data;
}

/**
 * Start a 14-day trial
 */
export async function startTrial(): Promise<TrialResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('billing-start-trial', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to start trial');
  }

  if (response.data.error) {
    throw new Error(response.data.message || response.data.error);
  }

  return response.data;
}

/**
 * Create a checkout session for a plan
 * Returns URL to redirect user to Paystack hosted checkout
 */
export async function createCheckout(planSlug: string, callbackUrl?: string): Promise<CheckoutResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('billing-checkout', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      plan_slug: planSlug,
      callback_url: callbackUrl || `${window.location.origin}/billing/success`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create checkout');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

/**
 * Cancel subscription (schedules cancellation at period end for paid, immediate for trial)
 */
export async function cancelSubscription(): Promise<CancelResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('billing-cancel', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to cancel subscription');
  }

  if (response.data.error) {
    throw new Error(response.data.message || response.data.error);
  }

  return response.data;
}

/**
 * Get all available plans
 */
export async function getPlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to fetch plans');
  }

  return (data || []).map(plan => ({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    price_amount: plan.price_amount,
    currency: plan.currency,
    interval: plan.interval,
    features: plan.features_json || {},
    limits: plan.limits_json || { campaigns: 2, creators_per_campaign: 5, team_members: 1 },
  }));
}

/**
 * Format price for display
 */
export function formatPrice(amountInCents: number, currency: string = 'USD'): string {
  if (amountInCents === 0) return 'Free';

  const amount = amountInCents / 100;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Check if subscription has access to a feature
 */
export function hasFeature(subscription: BillingSummary | null, feature: string): boolean {
  if (!subscription) return false;

  // During trial or active subscription, check plan features
  if (subscription.is_paid) {
    return subscription.plan.features?.[feature] ?? false;
  }

  // Free plan features only
  return subscription.plan.features?.[feature] ?? false;
}

/**
 * Check if subscription is within a resource limit
 * Returns true if within limit, false if exceeded
 * -1 means unlimited
 */
export function isWithinLimit(
  subscription: BillingSummary | null,
  resource: keyof BillingPlan['limits'],
  currentCount: number
): boolean {
  if (!subscription) return false;

  const limit = subscription.plan.limits?.[resource];
  if (limit === undefined) return true; // No limit defined
  if (limit === -1) return true; // Unlimited

  return currentCount < limit;
}

/**
 * Get the limit for a resource (-1 = unlimited)
 */
export function getLimit(
  subscription: BillingSummary | null,
  resource: keyof BillingPlan['limits']
): number {
  if (!subscription) return 0;
  return subscription.plan.limits?.[resource] ?? 0;
}
