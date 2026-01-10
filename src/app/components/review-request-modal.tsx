"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { X, ArrowRight, Info } from "lucide-react";
import { useCart } from "../../contexts/CartContext";
import { PlatformBadge } from "./platform-badge";
import type { CreatorWithStats } from "../../lib/types/database";

interface ReviewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

export function ReviewRequestModal({
  open,
  onOpenChange,
  onContinue,
}: ReviewRequestModalProps) {
  const { cart, removeCreator, totalItems } = useCart();

  const handleContinue = () => {
    if (cart.length === 0) return;
    onContinue();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Review Creator Request
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            You have selected {totalItems} {totalItems === 1 ? "creator" : "creators"} from
            DTTracker&apos;s network. Review your selection and continue to provide
            campaign details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Selected Creators List */}
          <div className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No creators selected. Please add creators to your request.
              </p>
            ) : (
              cart.map((creator) => (
                <div
                  key={creator.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                        <span className="text-lg font-semibold text-white">
                          {creator.name?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm truncate">
                        {creator.name || "Unknown Creator"}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {creator.handle && (
                          <p className="text-xs text-slate-400 truncate">
                            @{creator.handle.startsWith("@") ? creator.handle.slice(1) : creator.handle}
                          </p>
                        )}
                        {creator.platform && (
                          <PlatformBadge platform={creator.platform as any} />
                        )}
                      </div>
                      {creator.follower_count && (
                        <p className="text-xs text-slate-500 mt-1">
                          {(creator.follower_count / 1000).toFixed(0)}K followers
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCreator(creator.id)}
                    className="flex-shrink-0 w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors ml-2"
                    aria-label={`Remove ${creator.name}`}
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* What Happens Next Section */}
          {cart.length > 0 && (
            <div className="mt-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-white text-sm mb-2">
                    What happens next?
                  </h4>
                  <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside">
                    <li>
                      Provide campaign details including type, brief, deliverables,
                      and timeline
                    </li>
                    <li>
                      DTTracker will review your request and provide a quote
                    </li>
                    <li>
                      Once approved, our team will coordinate with the selected
                      creators
                    </li>
                    <li>
                      Track your request status and receive updates as it progresses
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t border-white/[0.08]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
          >
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={cart.length === 0}
            className="bg-primary hover:bg-primary/90 text-black font-medium"
          >
            Continue to Brief
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
