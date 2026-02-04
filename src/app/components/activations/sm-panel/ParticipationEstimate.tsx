import React from 'react';
import { estimateParticipation } from '../../../../lib/sm-panel/pricing';
import type { TaskType } from '../../../../lib/sm-panel/constants';

interface ParticipationEstimateProps {
  totalBudget: number;
  baseRate: number;
  taskType: TaskType;
}

export function ParticipationEstimate({
  totalBudget,
  baseRate,
  taskType,
}: ParticipationEstimateProps) {
  const estimates = estimateParticipation(totalBudget, baseRate, taskType);

  if (totalBudget < baseRate || baseRate <= 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-4">
      <h4 className="font-medium text-slate-300 mb-2">Estimated Participation</h4>
      <ul className="text-sm space-y-1 text-slate-400">
        {Object.entries(estimates.byTier).map(([tier, count]) => (
          <li key={tier}>
            • If all {tier}: ~{count} creators
          </li>
        ))}
        <li className="font-semibold text-white mt-2">
          • Realistic mix: ~{estimates.averageMix} creators
        </li>
      </ul>
    </div>
  );
}
