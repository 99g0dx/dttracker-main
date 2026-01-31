/**
 * Format a number with locale-aware thousands separators
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Format a number with compact notation (e.g., 1.2K, 3.4M)
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (value < 1000) return value.toString();
  if (value < 1000000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1000000000) return `${(value / 1000000).toFixed(1)}M`;
  return `${(value / 1000000000).toFixed(1)}B`;
}

/**
 * Calculate percentage change between two values
 */
export function calculateDelta(current: number | null, previous: number | null): {
  value: number;
  percentage: number | null;
  isPositive: boolean;
} {
  if (current === null || previous === null) {
    return {
      value: current !== null ? current : (previous !== null ? -previous : 0),
      percentage: null,
      isPositive: true,
    };
  }

  if (previous === 0) {
    return {
      value: current,
      percentage: current > 0 ? 100 : null,
      isPositive: current >= 0,
    };
  }

  const delta = current - previous;
  const percentage = (delta / previous) * 100;

  return {
    value: delta,
    percentage,
    isPositive: delta >= 0,
  };
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString();
}
