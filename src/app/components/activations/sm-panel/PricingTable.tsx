import React from 'react';
import { getPricingBreakdown } from '../../../../lib/sm-panel/pricing';
import type { TaskType } from '../../../../lib/sm-panel/constants';
import { formatNumber } from '../../../../lib/utils/format';

interface PricingTableProps {
  baseRate: number;
  taskType: TaskType;
}

export function PricingTable({ baseRate, taskType }: PricingTableProps) {
  const breakdown = getPricingBreakdown(baseRate, taskType);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="text-left py-2 text-slate-400 font-medium">Tier</th>
            <th className="text-left py-2 text-slate-400 font-medium">Range</th>
            <th className="text-right py-2 text-slate-400 font-medium">Payment</th>
            <th className="text-right py-2 text-slate-400 font-medium">Max % Pool</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row) => (
            <tr key={row.tier} className="border-b border-white/[0.06]">
              <td className="py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span>{row.icon}</span>
                  <span className="font-medium text-white">{row.tier}</span>
                </span>
              </td>
              <td className="py-2 text-slate-400">{row.range}</td>
              <td className="py-2 text-right font-semibold text-primary">
                ₦{formatNumber(Number(row.payment))}
              </td>
              <td className="py-2 text-right text-slate-400">
                {Math.round(row.poolCapPercentage)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {taskType === 'story' && (
        <div className="mt-3 text-xs text-amber-400/90 bg-amber-500/10 p-2 rounded-md border border-amber-500/20">
          Story posts pay 25–50% more for Mid+ creators due to higher visibility
        </div>
      )}
    </div>
  );
}
