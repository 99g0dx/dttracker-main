import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  ArrowLeft,
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWalletBalance, useWalletTransactions, useFundWallet } from '../../hooks/useWallet';
import type { WalletTransaction } from '../../lib/api/wallet';
import { formatNumber } from '../../lib/utils/format';

interface WalletProps {
  onNavigate: (path: string) => void;
}

function formatAmount(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTransactionIcon(type: WalletTransaction['type']) {
  switch (type) {
    case 'fund':
      return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
    case 'lock':
      return <Lock className="w-4 h-4 text-amber-400" />;
    case 'unlock':
      return <Lock className="w-4 h-4 text-slate-400" />;
    case 'payout':
      return <ArrowUpRight className="w-4 h-4 text-rose-400" />;
    case 'refund':
      return <ArrowDownLeft className="w-4 h-4 text-cyan-400" />;
    default:
      return <WalletIcon className="w-4 h-4 text-slate-400" />;
  }
}

function getTransactionLabel(type: WalletTransaction['type']): string {
  switch (type) {
    case 'fund':
      return 'Funding';
    case 'lock':
      return 'Budget locked';
    case 'unlock':
      return 'Budget released';
    case 'payout':
      return 'Payout';
    case 'refund':
      return 'Refund';
    default:
      return type;
  }
}

export function Wallet({ onNavigate }: WalletProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { data: wallet, isLoading: balanceLoading } = useWalletBalance(activeWorkspaceId);
  const { data: transactions = [], isLoading: transactionsLoading } =
    useWalletTransactions(activeWorkspaceId);
  const fundWallet = useFundWallet();
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState<number>(0);

  const availableBalance = wallet?.balance ?? 0;
  const lockedBalance = wallet?.locked_balance ?? 0;
  const currency = wallet?.currency ?? 'NGN';

  const handleFund = () => {
    if (!activeWorkspaceId || fundAmount <= 0) {
      return;
    }
    fundWallet.mutate(
      { workspaceId: activeWorkspaceId, amount: fundAmount },
      {
        onSuccess: () => {
          setFundAmount(0);
          setFundDialogOpen(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('/dashboard')}
          className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Wallet
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your workspace balance for activations
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Available Balance</span>
              <WalletIcon className="w-5 h-5 text-slate-500" />
            </div>
            {balanceLoading ? (
              <div className="h-10 bg-white/[0.04] rounded animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formatAmount(availableBalance, currency)}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Use this balance to fund contests and SM panels
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Locked Balance</span>
              <Lock className="w-5 h-5 text-slate-500" />
            </div>
            {balanceLoading ? (
              <div className="h-10 bg-white/[0.04] rounded animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formatAmount(lockedBalance, currency)}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Budget reserved for active activations
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Transactions</h2>
            <Button
              onClick={() => setFundDialogOpen(true)}
              disabled={!activeWorkspaceId}
              className="bg-primary text-black hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Fund Wallet
            </Button>
          </div>

          {transactionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-white/[0.04] rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <WalletIcon className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">No transactions yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Fund your wallet to get started
              </p>
              <Button
                onClick={() => setFundDialogOpen(true)}
                variant="outline"
                className="mt-4"
              >
                Fund Wallet
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
                      {getTransactionIcon(tx)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        tx.type === 'fund' || tx.type === 'refund' || tx.type === 'unlock'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {tx.type === 'fund' || tx.type === 'refund' || tx.type === 'unlock'
                        ? '+'
                        : '-'}
                      {formatAmount(Math.abs(tx.amount), currency)}
                    </p>
                    {tx.balance_after != null && (
                      <p className="text-xs text-slate-500">
                        Balance: {formatAmount(tx.balance_after, currency)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
        <DialogContent className="bg-[#0D0D0D] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Fund Wallet</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add balance to your workspace wallet. This will be used to fund
              activations (contests and SM panels).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">
                Amount ({currency})
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={fundAmount ? formatNumber(fundAmount) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  const num = parseFloat(raw) || 0;
                  setFundAmount(num);
                }}
                placeholder="e.g. 100,000"
                className="bg-white/[0.04] border-white/[0.08] text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFundDialogOpen(false)}
              className="border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFund}
              disabled={
                fundWallet.isPending || !fundAmount || fundAmount <= 0
              }
              className="bg-primary text-black hover:bg-primary/90"
            >
              {fundWallet.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Fund Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
