import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2 } from 'lucide-react';
import { useActivations } from '../../../hooks/useActivations';
import { useWalletBalance } from '../../../hooks/useWallet';
import { useSendOfferToActivation } from '../../../hooks/useCreators';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { CreatorWithSocialAndStats } from '../../../lib/types/database';
import { formatNumber } from '../../../lib/utils/format';

interface SendOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CreatorWithSocialAndStats | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
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
    status: 'live',
  });
  const { data: wallet } = useWalletBalance(activeWorkspaceId);
  const sendOffer = useSendOfferToActivation();

  const [activationId, setActivationId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [message, setMessage] = useState('');

  const availableBalance = wallet?.balance ?? 0;
  const amountNum = amount;
  const canSend = creator && activationId && amountNum > 0 && amountNum <= availableBalance;

  const handleSend = async () => {
    if (!creator || !activationId || amountNum <= 0) return;
    if (creator.id.startsWith('manual-')) {
      return;
    }
    try {
      await sendOffer.mutateAsync({
        creatorId: creator.id,
        activationId,
        amount: amountNum,
        message: message || undefined,
      });
      onOpenChange(false);
      setActivationId('');
      setAmount(0);
      setMessage('');
    } catch {
      // toast from mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D0D0D] border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="text-white">
            Send Offer to {creator?.handle || 'Creator'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Invite this creator to participate in an activation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">
              Activation
            </label>
            <select
              value={activationId}
              onChange={(e) => setActivationId(e.target.value)}
              className="h-10 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-white"
            >
              <option value="">Select activation</option>
              {activations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">
              Compensation (NGN)
            </label>
            <Input
              type="text"
              inputMode="numeric"
              value={amount ? formatNumber(amount) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                const num = parseFloat(raw) || 0;
                setAmount(num);
              }}
              placeholder="e.g. 150,000"
              className="bg-white/[0.04] border-white/[0.08]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">
              Personal message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! We'd love to have you..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-500"
            />
          </div>
          <div className="text-sm text-slate-400">
            Wallet balance: {formatAmount(availableBalance)}
            {amountNum > 0 && (
              <span
                className={
                  amountNum > availableBalance ? 'text-amber-400' : 'text-emerald-400'
                }
              >
                {' '}
                • After: {formatAmount(availableBalance - amountNum)}
              </span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/[0.08]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sendOffer.isPending}
            className="bg-primary text-black hover:bg-primary/90"
          >
            {sendOffer.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
