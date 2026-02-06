import React from 'react';

interface ServiceFeeDisplayProps {
  baseAmount: number;
  serviceFeeRate?: number;
  showBreakdown?: boolean;
  currency?: string;
}

export function ServiceFeeDisplay({
  baseAmount,
  serviceFeeRate = 0.10,
  showBreakdown = true,
  currency = '₦',
}: ServiceFeeDisplayProps) {
  const serviceFee = Math.round(baseAmount * serviceFeeRate * 100) / 100;
  const totalCost = baseAmount + serviceFee;

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace('NGN', currency);
  };

  if (!showBreakdown) {
    return <span className="text-sm text-slate-300">{formatAmount(totalCost)}</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Budget:</span>
        <span className="text-slate-300 font-medium">{formatAmount(baseAmount)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Service Fee ({Math.round(serviceFeeRate * 100)}%):</span>
        <span className="text-slate-300 font-medium">{formatAmount(serviceFee)}</span>
      </div>
      <div className="flex items-center justify-between text-sm pt-1 border-t border-white/[0.08]">
        <span className="text-slate-300 font-semibold">Total:</span>
        <span className="text-white font-semibold">{formatAmount(totalCost)}</span>
      </div>
    </div>
  );
}
