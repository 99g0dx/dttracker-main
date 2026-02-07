export const CONTEST_WINNER_COUNT = 20;
export const CONTEST_MIN_PRIZE_POOL = 2000;

export function buildPrizeStructure(
  totalBudget: number
): Record<string, number> {
  const first = totalBudget * 0.25;
  const second = totalBudget * 0.15;
  const third = totalBudget * 0.1;
  const remainingPool = totalBudget * 0.5;
  const remainingPerWinner = remainingPool / 17;
  const structure: Record<string, number> = {
    "1": first,
    "2": second,
    "3": third,
  };
  for (let r = 4; r <= 20; r++) structure[String(r)] = remainingPerWinner;
  return structure;
}

export function calculatePerformanceScore(
  views: number,
  likes: number,
  comments: number
): number {
  return views + likes * 2 + comments * 3;
}
