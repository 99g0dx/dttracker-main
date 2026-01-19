import { BillingSummary } from './api/billing';

/**
 * Plan limits configuration
 * -1 means unlimited
 */
export interface PlanLimits {
  campaigns: number;
  creators_per_campaign: number;
  team_members: number;
}

/**
 * Default limits for each plan
 */
const DEFAULT_LIMITS: Record<string, PlanLimits> = {
  starter: {
    campaigns: 2,
    creators_per_campaign: 5,
    team_members: 1,
  },
  pro: {
    campaigns: -1, // unlimited
    creators_per_campaign: -1, // unlimited
    team_members: -1, // unlimited
  },
  agency: {
    campaigns: -1,
    creators_per_campaign: -1,
    team_members: -1,
  },
};

/**
 * Features available for each plan
 */
export type Feature =
  | 'basic_analytics'
  | 'advanced_analytics'
  | 'api_access'
  | 'team_collaboration'
  | 'white_label'
  | 'priority_support'
  | 'automated_scraping'
  | 'custom_reports'
  | 'data_export';

const DEFAULT_FEATURES: Record<string, Feature[]> = {
  starter: ['basic_analytics', 'data_export'],
  pro: [
    'basic_analytics',
    'advanced_analytics',
    'api_access',
    'team_collaboration',
    'automated_scraping',
    'custom_reports',
    'data_export',
    'priority_support',
  ],
  agency: [
    'basic_analytics',
    'advanced_analytics',
    'api_access',
    'team_collaboration',
    'automated_scraping',
    'custom_reports',
    'data_export',
    'priority_support',
    'white_label',
  ],
};

/**
 * Get the effective plan slug based on subscription status
 */
export function getEffectivePlanSlug(billing: BillingSummary | null | undefined): string {
  if (!billing) return 'starter';

  // If paid or trialing, use the subscription's plan
  if (billing.is_paid || billing.is_trialing) {
    return billing.subscription?.plan_slug || billing.plan?.slug || 'pro';
  }

  // Default to starter/free plan
  return billing.plan?.slug || 'starter';
}

/**
 * Get effective limits based on subscription status
 */
export function getEffectiveLimits(billing: BillingSummary | null | undefined): PlanLimits {
  const planSlug = getEffectivePlanSlug(billing);

  // Check if plan has custom limits from database
  if (billing?.plan?.limits) {
    return {
      campaigns: billing.plan.limits.campaigns ?? DEFAULT_LIMITS[planSlug]?.campaigns ?? 2,
      creators_per_campaign: billing.plan.limits.creators_per_campaign ?? DEFAULT_LIMITS[planSlug]?.creators_per_campaign ?? 5,
      team_members: billing.plan.limits.team_members ?? DEFAULT_LIMITS[planSlug]?.team_members ?? 1,
    };
  }

  return DEFAULT_LIMITS[planSlug] || DEFAULT_LIMITS.starter;
}

/**
 * Check if user has access to a specific feature
 */
export function canAccessFeature(
  billing: BillingSummary | null | undefined,
  feature: Feature
): boolean {
  if (!billing) return DEFAULT_FEATURES.starter.includes(feature);

  const planSlug = getEffectivePlanSlug(billing);

  // Check database features first
  if (billing.plan?.features && feature in billing.plan.features) {
    return billing.plan.features[feature] === true;
  }

  // Fall back to default features
  return DEFAULT_FEATURES[planSlug]?.includes(feature) || false;
}

/**
 * Check if current usage is within the plan limit
 */
export function isWithinLimit(
  billing: BillingSummary | null | undefined,
  resource: keyof PlanLimits,
  currentCount: number
): boolean {
  const limits = getEffectiveLimits(billing);
  const limit = limits[resource];

  // -1 means unlimited
  if (limit === -1) return true;

  return currentCount < limit;
}

/**
 * Get the limit value for a resource
 */
export function getLimit(
  billing: BillingSummary | null | undefined,
  resource: keyof PlanLimits
): number {
  const limits = getEffectiveLimits(billing);
  return limits[resource];
}

/**
 * Get remaining quota for a resource
 * Returns -1 if unlimited
 */
export function getRemainingQuota(
  billing: BillingSummary | null | undefined,
  resource: keyof PlanLimits,
  currentCount: number
): number {
  const limit = getLimit(billing, resource);

  if (limit === -1) return -1; // unlimited

  return Math.max(0, limit - currentCount);
}

/**
 * Check if subscription is in a state that allows paid features
 */
export function hasPaidAccess(billing: BillingSummary | null | undefined): boolean {
  if (!billing) return false;
  return billing.is_paid || billing.is_trialing;
}

/**
 * Check if subscription is in grace period (past due but still has access)
 */
export function isInGracePeriod(billing: BillingSummary | null | undefined): boolean {
  if (!billing) return false;
  return billing.subscription?.status === 'past_due';
}

/**
 * Check if user should see upgrade prompts
 */
export function shouldShowUpgradePrompt(billing: BillingSummary | null | undefined): boolean {
  if (!billing) return true;

  // Show upgrade if on free plan
  if (!billing.is_paid && !billing.is_trialing) return true;

  // Show upgrade if trial is about to end (less than 3 days)
  if (billing.is_trialing && billing.days_until_trial_end !== null && billing.days_until_trial_end <= 3) {
    return true;
  }

  return false;
}

/**
 * Get a user-friendly message for when a limit is reached
 */
export function getLimitReachedMessage(resource: keyof PlanLimits): string {
  const messages: Record<keyof PlanLimits, string> = {
    campaigns: "You've reached your campaign limit. Upgrade to Pro for unlimited campaigns.",
    creators_per_campaign: "You've reached the creator limit for this campaign. Upgrade to Pro for unlimited creators.",
    team_members: "You've reached your team member limit. Upgrade to Pro for unlimited team members.",
  };
  return messages[resource];
}

/**
 * Get a user-friendly message for when a feature is locked
 */
export function getFeatureLockedMessage(feature: Feature): string {
  const messages: Record<Feature, string> = {
    basic_analytics: 'Basic analytics are included in all plans.',
    advanced_analytics: 'Advanced analytics are available on Pro and Agency plans.',
    api_access: 'API access is available on Pro and Agency plans.',
    team_collaboration: 'Team collaboration is available on Pro and Agency plans.',
    white_label: 'White-label reports are available on Agency plans.',
    priority_support: 'Priority support is available on Pro and Agency plans.',
    automated_scraping: 'Automated post scraping is available on Pro and Agency plans.',
    custom_reports: 'Custom reports are available on Pro and Agency plans.',
    data_export: 'Data export is included in all plans.',
  };
  return messages[feature];
}
