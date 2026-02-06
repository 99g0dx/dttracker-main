import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Loader2 } from "lucide-react";
import { useActivations } from "../../../hooks/useActivations";
import { useWalletBalance } from "../../../hooks/useWallet";
import { useSendOfferToActivation } from "../../../hooks/useCreators";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import type { CreatorWithSocialAndStats } from "../../../lib/types/database";
import { formatNumber } from "../../../lib/utils/format";

interface SendOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CreatorWithSocialAndStats | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SendOfferModal({
  open,
  onOpenChange,
  creator,
}: SendOfferModalProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { data: activations = [] } = useActivations(activeWorkspaceId, {
    status: "live",
  });
  const { data: wallet } = useWalletBalance(activeWorkspaceId);
  const sendOffer = useSendOfferToActivation();

  const [activationId, setActivationId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [message, setMessage] = useState("");

  const availableBalance = wallet?.balance ?? 0;
  const amountNum = amount;
  const canSend =
    creator &&
    activationId &&
    amountNum > 0 &&
    amountNum <= availableBalance &&
    message.trim().length > 0;

  const handleSend = async () => {
    if (!creator || !activationId || amountNum <= 0 || !message.trim()) return;
    if (creator.id.startsWith("manual-")) {
      return;
    }
    try {
      await sendOffer.mutateAsync({
        creatorId: creator.id,
        activationId,
        amount: amountNum,
        message: message.trim(),
      });
      onOpenChange(false);
      setActivationId("");
      setAmount(0);
      setMessage("");
    } catch {
      // toast from mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D0D0D] border-white/[0.08] w-[92vw] max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-semibold text-white">
            Send Offer to {creator?.handle || "Creator"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400 mt-1">
            Invite this creator to participate in an activation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Activation
            </label>
            <select
              value={activationId}
              onChange={(e) => setActivationId(e.target.value)}
              className="h-11 w-full rounded-lg bg-white/[0.02] border border-white/[0.06] px-3.5 py-2.5 text-sm text-white transition-all outline-none hover:border-white/[0.1] hover:bg-white/[0.03] focus:border-white/[0.15] focus:bg-white/[0.04] focus:ring-2 focus:ring-white/[0.08]"
              style={{
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
              }}
            >
              <option value="" className="bg-[#18181B]">Select activation</option>
              {activations.map((a) => (
                <option key={a.id} value={a.id} className="bg-[#18181B]">
                  {a.title} ({a.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Compensation (NGN)
            </label>
            <Input
              type="text"
              inputMode="numeric"
              value={amount ? formatNumber(amount) : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "");
                const num = parseFloat(raw) || 0;
                setAmount(num);
              }}
              placeholder="e.g. 150,000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal text-slate-300 block">
              Brief
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! We'd love to have you..."
              required
              rows={3}
            />
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5" style={{ boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)' }}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Wallet balance</span>
              <span className="text-white font-medium">{formatAmount(availableBalance)}</span>
            </div>
            {amountNum > 0 && (
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-white/[0.06]">
                <span className="text-slate-400">After offer</span>
                <span className={amountNum > availableBalance ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
                  {formatAmount(availableBalance - amountNum)}
                </span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 min-h-[44px] flex-1 sm:flex-initial border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sendOffer.isPending}
            className="h-11 min-h-[44px] flex-1 sm:flex-initial bg-primary text-black hover:bg-primary/90 disabled:opacity-50"
          >
            {sendOffer.isPending && (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            )}
            Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
