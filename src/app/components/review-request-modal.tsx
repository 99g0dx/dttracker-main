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
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-[#111111] border border-white/[0.08] shadow-xl">
        <DialogHeader className="p-6 border-b border-white/[0.08]">
          <DialogTitle className="text-2xl font-semibold text-white">
            Review Your Creator Request
          </DialogTitle>
          <DialogDescription className="text-slate-400 mt-1 text-sm">
            You have selected <span className="font-medium text-white">{totalItems}</span>{" "}
            {totalItems === 1 ? "creator" : "creators"} from DTTracker’s network. Review
            your selection and continue to provide campaign details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selected Creators */}
          <div className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-slate-500 text-center py-16">
                No creators selected. Add creators to proceed.
              </p>
            ) : (
              cart.map((creator) => (
                <div
                  key={creator.id}
                  className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white font-semibold text-lg">
                      {creator.name?.[0]?.toUpperCase() || "?"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm truncate">
                        {creator.name || "Unknown Creator"}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {creator.handle && (
                          <p className="text-xs text-slate-400 truncate">
                            @{creator.handle.replace(/^@/, "")}
                          </p>
                        )}
                        {(() => {
                          const platformIcon = normalizePlatform(
                            creator.platform as string
                          );
                          if (!platformIcon) return null;
                          return (
                            <>
                              <PlatformIcon
                                platform={platformIcon}
                                size="sm"
                                className="sm:hidden"
                                aria-label={`${getPlatformLabel(platformIcon)} creator`}
                              />
                              <PlatformIcon
                                platform={platformIcon}
                                size="md"
                                className="hidden sm:flex"
                                aria-label={`${getPlatformLabel(platformIcon)} creator`}
                              />
                            </>
                          );
                        })()}
                      </div>
                      {creator.follower_count && (
                        <p className="text-xs text-slate-500 mt-1">
                          {(creator.follower_count / 1000).toFixed(1)}K followers
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeCreator(creator.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-500/20 transition-colors"
                    aria-label={`Remove ${creator.name}`}
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* What Happens Next */}
          {cart.length > 0 && (
            <div className="flex items-start gap-3 p-5 bg-primary/5 border border-primary/20 rounded-xl">
              <Info className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-white font-medium text-sm mb-2">What happens next?</h4>
                <ol className="list-decimal list-inside text-slate-400 text-xs space-y-2">
                  <li>Provide campaign details: type, brief, deliverables, and timeline</li>
                  <li>DTTracker will review your request and provide a quote</li>
                  <li>Once approved, our team coordinates with selected creators</li>
                  <li>Track your request status and receive updates</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-white/[0.08] p-6 flex justify-end gap-3">
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
            className="bg-primary hover:bg-primary/90 text-black font-medium flex items-center gap-2"
          >
            Continue to Brief <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
