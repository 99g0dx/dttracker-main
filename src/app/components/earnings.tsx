import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, Wallet as WalletIcon, Plus, ArrowUpRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  useCreatorWallet,
  useCreatorWalletTransactions,
  useCreatorWithdrawalRequests,
  useCreateCreatorWithdrawal,
} from "../../hooks/useCreatorWallet";
import type { CreatorWalletTransactionType } from "../../lib/api/creator-wallet";
import { format } from "date-fns";

interface EarningsProps {
  onNavigate: (path: string) => void;
}

function formatAmount(amount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTransactionLabel(type: CreatorWalletTransactionType): string {
  const labels: Record<CreatorWalletTransactionType, string> = {
    sm_panel_payment: "SM panel payment",
    contest_prize: "Contest prize",
    bonus: "Bonus",
    withdrawal: "Withdrawal",
    withdrawal_reversal: "Withdrawal reversed",
    adjustment: "Adjustment",
  };
  return labels[type] ?? type;
}

function maskAccount(account: string | null): string {
  if (!account || account.length < 4) return "****";
  return `****${account.slice(-4)}`;
}

export function Earnings({ onNavigate }: EarningsProps) {
  const { data: wallet, isLoading: walletLoading } = useCreatorWallet();
  const { data: transactions = [], isLoading: transactionsLoading } =
    useCreatorWalletTransactions(50, 0);
  const { data: withdrawalRequests = [], isLoading: withdrawalsLoading } =
    useCreatorWithdrawalRequests(20, 0);
  const createWithdrawal = useCreateCreatorWithdrawal();

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const availableBalance = wallet?.available_balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? 0;
  const lifetimeEarned = wallet?.lifetime_earned ?? 0;
  const currency = wallet?.currency ?? "NGN";

  const handleWithdrawSubmit = () => {
    const amount = typeof withdrawAmount === "number" ? withdrawAmount : Number(withdrawAmount);
    if (amount <= 0) {
      return;
    }
    if (amount > availableBalance) {
      return;
    }
    createWithdrawal.mutate(
      {
        amount,
        bank_name: bankName || undefined,
        account_number: accountNumber || undefined,
        account_name: accountName || undefined,
      },
      {
        onSuccess: () => {
          setWithdrawAmount("");
          setBankName("");
          setAccountNumber("");
          setAccountName("");
          setWithdrawOpen(false);
        },
      }
    );
  };

  const withdrawAmountNum =
    typeof withdrawAmount === "number" ? withdrawAmount : Number(withdrawAmount) || 0;
  const canWithdraw =
    withdrawAmountNum > 0 &&
    withdrawAmountNum <= availableBalance &&
    !createWithdrawal.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate("/dashboard")}
          className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Earnings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your creator wallet and withdrawal requests
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">
                Available balance
              </span>
              <WalletIcon className="w-5 h-5 text-slate-500" />
            </div>
            {walletLoading ? (
              <div className="h-10 bg-white/[0.04] rounded animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formatAmount(availableBalance, currency)}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Amount you can withdraw
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">
                Pending balance
              </span>
            </div>
            {walletLoading ? (
              <div className="h-10 bg-white/[0.04] rounded animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formatAmount(pendingBalance, currency)}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Pending withdrawals
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">
                Lifetime earned
              </span>
            </div>
            {walletLoading ? (
              <div className="h-10 bg-white/[0.04] rounded animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {formatAmount(lifetimeEarned, currency)}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Total earned to date
            </p>
          </CardContent>
        </Card>
      </div>

      {!wallet && !walletLoading && (
        <p className="text-sm text-slate-500">
          No earnings yet. Complete activations to receive payments.
        </p>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Withdraw</h2>
        <Button
          onClick={() => setWithdrawOpen(true)}
          disabled={availableBalance <= 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-1" />
          Request withdrawal
        </Button>
      </div>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">
            Withdrawal requests
          </h3>
          {withdrawalsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : withdrawalRequests.length === 0 ? (
            <p className="text-slate-500 py-6 text-center text-sm">
              No withdrawal requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {withdrawalRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <div>
                    <p className="font-medium text-white">
                      {formatAmount(req.amount, "NGN")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(req.requested_at), "MMM d, yyyy")} •{" "}
                      {req.bank_name ?? "—"} {req.account_number ? maskAccount(req.account_number) : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      req.status === "completed"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : req.status === "failed" || req.status === "cancelled"
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">
            Transaction history
          </h3>
          {transactionsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-slate-500 py-6 text-center text-sm">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpRight className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="font-medium text-white">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}
                        {tx.description ? ` • ${tx.description}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        tx.type === "withdrawal" || tx.type === "withdrawal_reversal"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }
                    >
                      {tx.type === "withdrawal" || tx.type === "withdrawal_reversal"
                        ? "-"
                        : "+"}
                      {formatAmount(tx.amount, "NGN")}
                    </p>
                    <p className="text-xs text-slate-500">
                      Balance: {formatAmount(tx.balance_after, "NGN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="bg-[#0D0D0D] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle>Request withdrawal</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter amount and bank details. Your request will be processed
              manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">
                Amount ({currency})
              </label>
              <Input
                type="number"
                min={1}
                max={availableBalance}
                step={1}
                value={withdrawAmount === "" ? "" : withdrawAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setWithdrawAmount("");
                  else setWithdrawAmount(Number(v));
                }}
                className="bg-white/[0.04] border-white/[0.08]"
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">
                Available: {formatAmount(availableBalance, currency)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">
                Bank name
              </label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08]"
                placeholder="e.g. GTBank"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">
                Account number
              </label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08]"
                placeholder="10 digits"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1">
                Account name
              </label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08]"
                placeholder="Full name on account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
              className="border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdrawSubmit}
              disabled={!canWithdraw}
              className="bg-primary text-primary-foreground"
            >
              {createWithdrawal.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
