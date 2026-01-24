import React from 'react';
import { useBillingSummary } from '../../hooks/useBilling';
import { canAccessFeature, isWithinLimit, Feature, PlanLimits, getLimitReachedMessage, getFeatureLockedMessage } from '../../lib/entitlements';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Lock, Crown } from 'lucide-react';

interface EntitlementGateProps {
  children: React.ReactNode;
  feature?: Feature;
  resource?: keyof PlanLimits;
  currentCount?: number;
  fallback?: React.ReactNode;
  onUpgrade?: () => void;
}

/**
 * EntitlementGate - Conditionally renders children based on subscription status
 *
 * Usage:
 * ```tsx
 * // Feature-based gating
 * <EntitlementGate feature="advanced_analytics">
 *   <AdvancedAnalyticsDashboard />
 * </EntitlementGate>
 *
 * // Limit-based gating
 * <EntitlementGate resource="campaigns" currentCount={campaignCount}>
 *   <CreateCampaignButton />
 * </EntitlementGate>
 * ```
 */
export function EntitlementGate({
  children,
  feature,
  resource,
  currentCount = 0,
  fallback,
  onUpgrade,
}: EntitlementGateProps) {
  const { data: billing, isLoading } = useBillingSummary();

  // While loading, show nothing or a placeholder
  if (isLoading) {
    return null;
  }

  // Check feature access
  if (feature && !canAccessFeature(billing, feature)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <UpgradePrompt
        message={getFeatureLockedMessage(feature)}
        onUpgrade={onUpgrade}
      />
    );
  }

  // Check resource limits
  if (resource && !isWithinLimit(billing, resource, currentCount)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <UpgradePrompt
        message={getLimitReachedMessage(resource)}
        onUpgrade={onUpgrade}
      />
    );
  }

  return <>{children}</>;
}

interface UpgradePromptProps {
  message: string;
  onUpgrade?: () => void;
}

function UpgradePrompt({ message, onUpgrade }: UpgradePromptProps) {
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.location.href = '/subscription';
    }
  };

  return (
    <Card className="bg-[#0D0D0D] border-primary/20">
      <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-white font-medium mb-1">Upgrade Required</p>
          <p className="text-sm text-slate-400">{message}</p>
        </div>
        <Button
          onClick={handleUpgrade}
          className="bg-primary hover:bg-primary/90 text-black"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to check if a feature is accessible
 */
export function useFeatureAccess(feature: Feature): {
  hasAccess: boolean;
  isLoading: boolean;
} {
  const { data: billing, isLoading } = useBillingSummary();
  return {
    hasAccess: canAccessFeature(billing, feature),
    isLoading,
  };
}

/**
 * Hook to check if within a resource limit
 */
export function useResourceLimit(resource: keyof PlanLimits, currentCount: number): {
  isWithinLimit: boolean;
  limit: number;
  remaining: number;
  isLoading: boolean;
} {
  const { data: billing, isLoading } = useBillingSummary();

  const limit = billing?.plan?.limits?.[resource] ?? -1;
  const within = isWithinLimit(billing, resource, currentCount);
  const remaining = limit === -1 ? -1 : Math.max(0, limit - currentCount);

  return {
    isWithinLimit: within,
    limit,
    remaining,
    isLoading,
  };
}

/**
 * UpgradeBanner - Shows a banner prompting upgrade when near limits
 */
interface UpgradeBannerProps {
  resource: keyof PlanLimits;
  currentCount: number;
  threshold?: number; // Show warning when this percentage of limit is reached
  onUpgrade?: () => void;
}

export function UpgradeBanner({
  resource,
  currentCount,
  threshold = 0.8, // Default: show at 80% usage
  onUpgrade,
}: UpgradeBannerProps) {
  const { data: billing, isLoading } = useBillingSummary();

  if (isLoading) return null;

  const limit = billing?.plan?.limits?.[resource] ?? -1;

  // Don't show for unlimited
  if (limit === -1) return null;

  const usageRatio = currentCount / limit;

  // Don't show if below threshold
  if (usageRatio < threshold) return null;

  const remaining = Math.max(0, limit - currentCount);
  const isAtLimit = remaining === 0;

  return (
    <div
      className={`p-4 rounded-lg border ${
        isAtLimit
          ? 'bg-red-500/10 border-red-500/20'
          : 'bg-yellow-500/10 border-yellow-500/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isAtLimit ? 'bg-red-500/20' : 'bg-yellow-500/20'
          }`}
        >
          <Lock
            className={`w-4 h-4 ${isAtLimit ? 'text-red-400' : 'text-yellow-400'}`}
          />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${isAtLimit ? 'text-red-400' : 'text-yellow-400'}`}>
            {isAtLimit ? 'Limit Reached' : 'Approaching Limit'}
          </p>
          <p className="text-xs text-slate-400">
            {isAtLimit
              ? `You've used all ${limit} ${resource.replace('_', ' ')}.`
              : `${remaining} ${resource.replace('_', ' ')} remaining.`}
          </p>
        </div>
        <Button
          onClick={onUpgrade || (() => (window.location.href = '/subscription'))}
          size="sm"
          className={
            isAtLimit
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-yellow-500 hover:bg-yellow-600 text-black'
          }
        >
          Upgrade
        </Button>
      </div>
    </div>
  );
}
