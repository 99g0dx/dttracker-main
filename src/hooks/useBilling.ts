import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBillingSummary,
  startTrial,
  createCheckout,
  cancelSubscription,
  getPlans,
  BillingSummary,
  BillingPlan,
  TrialResponse,
  CheckoutResponse,
  CancelResponse,
} from '../lib/api/billing';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  summary: () => [...billingKeys.all, 'summary'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
};

/**
 * Hook to fetch billing summary for current workspace
 */
export function useBillingSummary() {
  return useQuery<BillingSummary, Error>({
    queryKey: billingKeys.summary(),
    queryFn: getBillingSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch available plans
 */
export function usePlans() {
  return useQuery<BillingPlan[], Error>({
    queryKey: billingKeys.plans(),
    queryFn: getPlans,
    staleTime: 1000 * 60 * 60, // 1 hour (plans don't change often)
  });
}

/**
 * Hook to start a trial
 */
export function useStartTrial() {
  const queryClient = useQueryClient();

  return useMutation<TrialResponse, Error, void>({
    mutationFn: startTrial,
    onSuccess: () => {
      // Invalidate billing summary to refetch
      queryClient.invalidateQueries({ queryKey: billingKeys.summary() });
    },
  });
}

/**
 * Hook to create checkout session
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutResponse, Error, { planSlug: string; callbackUrl?: string }>({
    mutationFn: ({ planSlug, callbackUrl }) => createCheckout(planSlug, callbackUrl),
    onSuccess: (data) => {
      // Redirect to Paystack checkout
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    },
  });
}

/**
 * Hook to cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation<CancelResponse, Error, void>({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      // Invalidate billing summary to refetch
      queryClient.invalidateQueries({ queryKey: billingKeys.summary() });
    },
  });
}

/**
 * Hook to check if user has access to a specific feature
 */
export function useHasFeature(feature: string): boolean {
  const { data: billing } = useBillingSummary();
  if (!billing) return false;

  // During trial or active subscription, check plan features
  if (billing.is_paid) {
    return billing.plan.features?.[feature] ?? false;
  }

  // Free plan features only
  return billing.plan.features?.[feature] ?? false;
}

/**
 * Hook to check if user is within a resource limit
 */
export function useIsWithinLimit(
  resource: 'campaigns' | 'creators_per_campaign' | 'team_members',
  currentCount: number
): { isWithinLimit: boolean; limit: number; isLoading: boolean } {
  const { data: billing, isLoading } = useBillingSummary();

  if (!billing) {
    return { isWithinLimit: false, limit: 0, isLoading };
  }

  const limit = billing.plan.limits?.[resource] ?? 0;

  // -1 means unlimited
  if (limit === -1) {
    return { isWithinLimit: true, limit: -1, isLoading };
  }

  return {
    isWithinLimit: currentCount < limit,
    limit,
    isLoading,
  };
}

/**
 * Hook to check subscription status
 */
export function useSubscriptionStatus() {
  const { data: billing, isLoading, error } = useBillingSummary();

  return {
    isLoading,
    error,
    status: billing?.subscription.status ?? 'free',
    isPaid: billing?.is_paid ?? false,
    isTrialing: billing?.is_trialing ?? false,
    canStartTrial: billing?.can_start_trial ?? false,
    daysUntilTrialEnd: billing?.days_until_trial_end ?? null,
    daysUntilPeriodEnd: billing?.days_until_period_end ?? null,
    plan: billing?.plan ?? null,
    subscription: billing?.subscription ?? null,
  };
}
