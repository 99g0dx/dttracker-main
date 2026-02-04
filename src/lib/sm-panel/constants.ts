export const CREATOR_TIERS = [
  {
    name: 'Nano',
    minFollowers: 0,
    maxFollowers: 5000,
    color: '#94a3b8',
    icon: '🌱',
  },
  {
    name: 'Micro',
    minFollowers: 5001,
    maxFollowers: 30000,
    color: '#60a5fa',
    icon: '⭐',
  },
  {
    name: 'Mid',
    minFollowers: 30001,
    maxFollowers: 100000,
    color: '#34d399',
    icon: '🎯',
  },
  {
    name: 'Macro',
    minFollowers: 100001,
    maxFollowers: 500000,
    color: '#fbbf24',
    icon: '🔥',
  },
  {
    name: 'Mega',
    minFollowers: 500001,
    maxFollowers: Infinity,
    color: '#f87171',
    icon: '🚀',
  },
] as const;

export type CreatorTierName =
  | 'Nano'
  | 'Micro'
  | 'Mid'
  | 'Macro'
  | 'Mega';

export type TaskType = 'like' | 'comment' | 'repost' | 'story';

export const TASK_MULTIPLIERS: Record<
  TaskType,
  Record<CreatorTierName, number>
> = {
  like: {
    Nano: 1.0,
    Micro: 2.0,
    Mid: 3.5,
    Macro: 5.0,
    Mega: 7.0,
  },
  comment: {
    Nano: 1.0,
    Micro: 2.0,
    Mid: 3.5,
    Macro: 5.0,
    Mega: 7.0,
  },
  repost: {
    Nano: 1.0,
    Micro: 2.0,
    Mid: 3.5,
    Macro: 5.0,
    Mega: 7.0,
  },
  story: {
    Nano: 1.25,
    Micro: 2.75,
    Mid: 5.25,
    Macro: 7.5,
    Mega: 10.5,
  },
};

export const POOL_CAPS: Record<TaskType, Record<CreatorTierName, number>> = {
  like: {
    Nano: 0.05,
    Micro: 0.08,
    Mid: 0.12,
    Macro: 0.2,
    Mega: 0.25,
  },
  comment: {
    Nano: 0.05,
    Micro: 0.08,
    Mid: 0.12,
    Macro: 0.2,
    Mega: 0.25,
  },
  repost: {
    Nano: 0.05,
    Micro: 0.08,
    Mid: 0.12,
    Macro: 0.2,
    Mega: 0.25,
  },
  story: {
    Nano: 0.05,
    Micro: 0.08,
    Mid: 0.15,
    Macro: 0.22,
    Mega: 0.28,
  },
};
