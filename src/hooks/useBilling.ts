import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBillingSummary,
  getBillingCatalog,
  createCheckout,
  cancelSubscription,
  updateSeats,
  BillingSummary,
  BillingCatalogResponse,
  CheckoutResponse,
  CancelResponse,
  UpdateSeatsResponse,
} from '../lib/api/billing';
import { canAccessFeature, getEffectiveLimits, isWithinLimit, hasActiveSubscription, Feature, PlanLimits } from '../lib/entitlements';
import { useWorkspace } from '../contexts/WorkspaceContext';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  summary: () => [...billingKeys.all, 'summary'] as const,
  catalog: () => [...billingKeys.all, 'catalog'] as const,
};

/**
 * Hook to fetch billing summary for current workspace
 */
export function useBillingSummary() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery<BillingSummary, Error>({
    queryKey: [...billingKeys.summary(), activeWorkspaceId],
    queryFn: () => getBillingSummary(activeWorkspaceId || undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch available plans
 */
export function useBillingCatalog() {
  return useQuery<BillingCatalogResponse, Error>({
    queryKey: billingKeys.catalog(),
    queryFn: getBillingCatalog,
    staleTime: 1000 * 60 * 60,
  });
}

/**
 * Hook to create checkout session
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient();

  return useMutation<
    CheckoutResponse,
    Error,
    {
      workspaceId: string;
      tier: "free" | "starter" | "pro" | "agency";
      billingCycle: "monthly" | "yearly";
      extraSeats: number;
      callbackUrl?: string;
    }
  >({
    mutationFn: (payload) => createCheckout(payload),
    onSuccess: (data) => {
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

  return useMutation<CancelResponse, Error, { workspaceId: string }>({
    mutationFn: ({ workspaceId }) => cancelSubscription(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.summary() });
    },
  });
}

export function useUpdateSeats() {
  const queryClient = useQueryClient();

  return useMutation<UpdateSeatsResponse, Error, { workspaceId: string; extraSeats: number }>({
    mutationFn: ({ workspaceId, extraSeats }) =>
      updateSeats({ workspaceId, extraSeats }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.summary() });
    },
  });
}

/**
 * Hook to check if user has access to a specific feature
 */
export function useHasFeature(feature: Feature): boolean {
  const { data: billing } = useBillingSummary();
  return canAccessFeature(billing, feature);
}

/**
 * Hook to check if user is within a resource limit
 */
export function useIsWithinLimit(
  resource: keyof PlanLimits,
  currentCount: number
): { isWithinLimit: boolean; limit: number; isLoading: boolean } {
  const { data: billing, isLoading } = useBillingSummary();

  if (!billing) {
    return { isWithinLimit: false, limit: 0, isLoading };
  }

  const limits = getEffectiveLimits(billing);
  const limit = limits[resource];

  return {
    isWithinLimit: isWithinLimit(billing, resource, currentCount),
    limit,
    isLoading,
  };
}

/**
 * Hook to check if user can perform write actions (create campaigns, add creators, etc.)
 * Returns true when subscription is active (paid or valid trial)
 */
export function useCanWrite(): { canWrite: boolean; isLoading: boolean } {
  const { data: billing, isLoading } = useBillingSummary();
  return {
    canWrite: hasActiveSubscription(billing),
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
    daysUntilPeriodEnd: billing?.days_until_period_end ?? null,
    plan: billing?.plan ?? null,
    subscription: billing?.subscription ?? null,
  };
}
