import React from "react";
import { Minus, Plus, Users } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatPrice, BillingCycle } from "../../../lib/api/billing";

interface SeatSelectorProps {
  includedSeats: number;
  extraSeats: number;
  extraSeatPrice: number;
  billingCycle: BillingCycle;
  onChange: (extraSeats: number) => void;
  maxSeats?: number;
  disabled?: boolean;
}

export function SeatSelector({
  includedSeats,
  extraSeats,
  extraSeatPrice,
  billingCycle,
  onChange,
  maxSeats = 50,
  disabled = false,
}: SeatSelectorProps) {
  const totalSeats = includedSeats + extraSeats;

  const handleDecrement = () => {
    if (extraSeats > 0) {
      onChange(extraSeats - 1);
    }
  };

  const handleIncrement = () => {
    if (maxSeats === null || totalSeats < maxSeats) {
      onChange(extraSeats + 1);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Team Seats</span>
        </div>
        <span className="text-xs text-slate-500">
          {includedSeats} included
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={disabled || extraSeats === 0}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
            extraSeats === 0 || disabled
              ? "bg-white/[0.03] text-slate-600 cursor-not-allowed"
              : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
          )}
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex-1 h-8 rounded-md bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
          <span className="text-sm font-medium text-white">{totalSeats} seats</span>
        </div>

        <button
          onClick={handleIncrement}
          disabled={disabled || (maxSeats !== null && totalSeats >= maxSeats)}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
            disabled || (maxSeats !== null && totalSeats >= maxSeats)
              ? "bg-white/[0.03] text-slate-600 cursor-not-allowed"
              : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {extraSeats > 0 && (
        <p className="text-xs text-slate-500">
          +{extraSeats} extra {extraSeats === 1 ? "seat" : "seats"} ={" "}
          <span className="text-slate-400">
            {formatPrice(extraSeats * extraSeatPrice)}/{billingCycle === "yearly" ? "year" : "month"}
          </span>
        </p>
      )}
    </div>
  );
}
