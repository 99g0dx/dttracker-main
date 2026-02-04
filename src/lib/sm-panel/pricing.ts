import {
  CREATOR_TIERS,
  TASK_MULTIPLIERS,
  POOL_CAPS,
  type CreatorTierName,
  type TaskType,
} from './constants';

export function getCreatorTier(
  followers: number
): (typeof CREATOR_TIERS)[number] {
  return (
    CREATOR_TIERS.find(
      (tier) =>
        followers >= tier.minFollowers && followers <= tier.maxFollowers
    ) ?? CREATOR_TIERS[0]
  );
}

export function calculateCreatorPayment(
  followers: number,
  baseRate: number,
  taskType: TaskType,
  totalBudget: number,
  remainingBudget: number
): {
  payment: number;
  tier: (typeof CREATOR_TIERS)[number];
  tierName: CreatorTierName;
  multiplier: number;
  cappedByPool: boolean;
  allowed: boolean;
  reason?: string;
} {
  const tier = getCreatorTier(followers);
  const tierName = tier.name as CreatorTierName;

  const multiplier = TASK_MULTIPLIERS[taskType][tierName];
  const basePayment = baseRate * multiplier;
  const poolCap = POOL_CAPS[taskType][tierName];
  const maxAllowedFromPool = totalBudget * poolCap;
  const cappedPayment = Math.min(basePayment, maxAllowedFromPool);
  const cappedByPool = cappedPayment < basePayment;

  if (remainingBudget < cappedPayment) {
    return {
      payment: 0,
      tier,
      tierName,
      multiplier,
      cappedByPool: false,
      allowed: false,
      reason: `Insufficient budget. Need ₦${cappedPayment.toLocaleString()}, only ₦${remainingBudget.toLocaleString()} remaining.`,
    };
  }

  return {
    payment: cappedPayment,
    tier,
    tierName,
    multiplier,
    cappedByPool,
    allowed: true,
  };
}

export function getPricingBreakdown(baseRate: number, taskType: TaskType) {
  return CREATOR_TIERS.map((tier) => {
    const tierName = tier.name as CreatorTierName;
    const multiplier = TASK_MULTIPLIERS[taskType][tierName];
    const payment = baseRate * multiplier;
    const poolCap = POOL_CAPS[taskType][tierName];

    return {
      tier: tier.name,
      range: `${tier.minFollowers.toLocaleString()}-${
        tier.maxFollowers === Infinity ? '∞' : tier.maxFollowers.toLocaleString()
      }`,
      multiplier,
      payment,
      poolCapPercentage: poolCap * 100,
      color: tier.color,
      icon: tier.icon,
    };
  });
}

export function estimateParticipation(
  totalBudget: number,
  baseRate: number,
  taskType: TaskType
): {
  byTier: Record<string, number>;
  total: number;
  averageMix: number;
} {
  const byTier: Record<string, number> = {};

  CREATOR_TIERS.forEach((tier) => {
    const tierName = tier.name as CreatorTierName;
    const multiplier = TASK_MULTIPLIERS[taskType][tierName];
    const payment = baseRate * multiplier;
    byTier[tier.name] = payment > 0 ? Math.floor(totalBudget / payment) : 0;
  });

  const weights: Record<CreatorTierName, number> = {
    Nano: 0.4,
    Micro: 0.3,
    Mid: 0.2,
    Macro: 0.08,
    Mega: 0.02,
  };

  let totalWeightedParticipants = 0;
  CREATOR_TIERS.forEach((tier) => {
    const tierName = tier.name as CreatorTierName;
    const multiplier = TASK_MULTIPLIERS[taskType][tierName];
    const payment = baseRate * multiplier;
    const weight = weights[tierName];
    if (payment > 0) {
      totalWeightedParticipants += (totalBudget / payment) * weight;
    }
  });

  const averageMix = Math.floor(totalWeightedParticipants);

  return {
    byTier,
    total: averageMix,
    averageMix,
  };
}
