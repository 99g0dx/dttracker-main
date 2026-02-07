import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Loader2,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  X,
  Calendar,
  DollarSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import {
  useWalletBalance,
  useWalletTransactions,
  useInitializeWalletFund,
  useWalletActivationSyncState,
  useValidateWalletActivationSync,
  useAutoFixWalletActivationSync,
} from "../../hooks/useWallet";
import { useWorkspacePayout } from "../../hooks/usePayouts";
import type {
  WalletTransaction,
  WalletTransactionFilters,
  WalletTransactionType,
  WorkspaceWallet,
} from "../../lib/api/wallet";
import { formatNumber } from "../../lib/utils/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { walletKeys } from "../../hooks/useWallet";

interface WalletProps {
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

function getTransactionIcon(type: WalletTransaction["type"]) {
  switch (type) {
    case "fund":
      return <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case "lock":
      return <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400" />;
    case "unlock":
      return <Lock className="w-4 h-4 text-muted-foreground" />;
    case "payout":
      return <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    case "refund":
      return <ArrowDownLeft className="w-4 h-4 text-red-600 dark:text-cyan-400" />;
    case "fee":
    case "service_fee":
      return <WalletIcon className="w-4 h-4 text-amber-700 dark:text-amber-400" />;
    default:
      return <WalletIcon className="w-4 h-4 text-muted-foreground" />;
  }
}

function getTransactionLabel(type: WalletTransaction["type"]): string {
  switch (type) {
    case "fund":
      return "Funding";
    case "lock":
      return "Budget locked";
    case "unlock":
      return "Budget released";
    case "payout":
      return "Payout";
    case "refund":
      return "Refund";
    case "fee":
    case "service_fee":
      return "Service Fee";
    default:
      return type;
  }
}

const TX_TYPES: WalletTransactionType[] = [
  "fund",
  "lock",
  "unlock",
  "payout",
  "refund",
  "fee",
  "service_fee",
];

function transactionsToCsv(
  transactions: WalletTransaction[],
  currency: string
): string {
  const headers = [
    "Date",
    "Type",
    "Amount",
    "Balance After",
    "Description",
    "Reference Type",
  ];
  const rows = transactions.map((tx) => [
    new Date(tx.created_at).toISOString(),
    tx.type,
    String(tx.amount),
    tx.balance_after != null ? String(tx.balance_after) : "",
    tx.description ?? "",
    tx.reference_type ?? "",
  ]);
  return [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
}

const HINT_AFTER_MS = 35000;
const POLL_INTERVAL_MS = 2000;
const POLL_DURATION_MS = 60000; // Poll every 2s for up to 60s after fund=success

export function Wallet({ onNavigate }: WalletProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const balanceWhenFundSuccessRef = React.useRef<number | null>(null);
  const [filterType, setFilterType] = useState<WalletTransactionType[]>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [minAmount, setMinAmount] = useState<number | "">("");
  const [maxAmount, setMaxAmount] = useState<number | "">("");
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: wallet, isLoading: balanceLoading } =
    useWalletBalance(activeWorkspaceId);

  const appliedFilters: WalletTransactionFilters = {
    ...(filterType.length ? { type: filterType } : {}),
    ...(dateStart || dateEnd
      ? {
          dateRange: {
            start: dateStart ? `${dateStart}T00:00:00.000Z` : "",
            end: dateEnd ? `${dateEnd}T23:59:59.999Z` : "",
          },
        }
      : {}),
    ...(minAmount !== "" ? { minAmount: Number(minAmount) } : {}),
    ...(maxAmount !== "" ? { maxAmount: Number(maxAmount) } : {}),
  };
  const hasFilters =
    filterType.length > 0 ||
    dateStart ||
    dateEnd ||
    minAmount !== "" ||
    maxAmount !== "";

  const { data: transactions = [], isLoading: transactionsLoading } =
    useWalletTransactions(activeWorkspaceId, 50, 0, appliedFilters);
  const initializeFund = useInitializeWalletFund();
  const workspacePayout = useWorkspacePayout();
  
  // Sync state hooks
  const { data: syncState, isLoading: syncStateLoading } = useWalletActivationSyncState(activeWorkspaceId);
  const validateSync = useValidateWalletActivationSync(activeWorkspaceId);
  const autoFixSync = useAutoFixWalletActivationSync(activeWorkspaceId);
  const [autoFixThreshold, setAutoFixThreshold] = useState<number>(10.0);
  const [autoFixDialogOpen, setAutoFixDialogOpen] = useState(false);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState<number>(0);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number | "">("");
  const [payoutCreatorId, setPayoutCreatorId] = useState("");
  const [payoutSubmissionId, setPayoutSubmissionId] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutAccountName, setPayoutAccountName] = useState("");

  const applyFilters = () => {
    setFilterOpen(false);
  };
  const clearFilters = () => {
    setFilterType([]);
    setDateStart("");
    setDateEnd("");
    setMinAmount("");
    setMaxAmount("");
    setFilterOpen(false);
  };

  const scheduleBalanceRefetch = React.useCallback(() => {
    if (!activeWorkspaceId) return () => {};
    const balanceKey = walletKeys.balance(activeWorkspaceId);
    const refetch = () => {
      queryClient.refetchQueries({ queryKey: balanceKey });
      queryClient.refetchQueries({
        queryKey: ["wallet", "transactions", activeWorkspaceId],
      });
    };
    refetch();
    // Poll more aggressively so webhook-updated balance shows without manual refresh
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let t = POLL_INTERVAL_MS; t <= POLL_DURATION_MS; t += POLL_INTERVAL_MS) {
      timers.push(setTimeout(refetch, t));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [activeWorkspaceId, queryClient]);

  useEffect(() => {
    if (searchParams.get("fund") !== "success" || !activeWorkspaceId) return;

    balanceWhenFundSuccessRef.current = wallet?.balance ?? 0;

    toast.success("Payment successful. Your wallet will be updated shortly.");
    queryClient.invalidateQueries({ queryKey: walletKeys.balance(activeWorkspaceId) });
    queryClient.invalidateQueries({
      queryKey: ["wallet", "transactions", activeWorkspaceId],
    });

    const cleanupRefetch = scheduleBalanceRefetch();

    const hintTimeoutId = window.setTimeout(async () => {
      const balanceKey = walletKeys.balance(activeWorkspaceId);
      await queryClient.refetchQueries({ queryKey: balanceKey });
      const latest = queryClient.getQueryData<WorkspaceWallet>(balanceKey);
      const latestBalance = latest?.balance ?? 0;
      const previousBalance = balanceWhenFundSuccessRef.current;
      balanceWhenFundSuccessRef.current = null;
      if (previousBalance !== null && latestBalance === previousBalance) {
        toast.info("If your balance hasn't updated, refresh the page.");
      }
    }, HINT_AFTER_MS);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fund");
        return next;
      },
      { replace: true }
    );

    return () => {
      cleanupRefetch();
      clearTimeout(hintTimeoutId);
    };
  }, [searchParams, activeWorkspaceId, queryClient, setSearchParams, scheduleBalanceRefetch]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    queryClient.invalidateQueries({ queryKey: walletKeys.balance(activeWorkspaceId) });
    queryClient.invalidateQueries({
      queryKey: ["wallet", "transactions", activeWorkspaceId],
    });
    const pending = typeof sessionStorage !== "undefined" && sessionStorage.getItem("wallet_fund_pending") === "1";
    if (pending) {
      sessionStorage.removeItem("wallet_fund_pending");
      toast.success("Checking for updated balance…");
      return scheduleBalanceRefetch();
    }
  }, [activeWorkspaceId, queryClient, scheduleBalanceRefetch]);

  const availableBalance = wallet?.balance ?? 0;
  const lockedBalance = wallet?.locked_balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? 0;
  const lifetimeSpent = wallet?.lifetime_spent ?? 0;
  const currency = wallet?.currency ?? "NGN";

  const handleFund = () => {
    if (!activeWorkspaceId || fundAmount <= 0) {
      return;
    }
    if (fundAmount < 100) {
      toast.error("Minimum amount is ₦100");
      return;
    }
    initializeFund.mutate(
      { workspaceId: activeWorkspaceId, amount: fundAmount },
      {
        onSuccess: () => {
          setFundAmount(0);
          setFundDialogOpen(false);
        },
      }
    );
  };

  const handlePayoutSubmit = () => {
    const amount =
      typeof payoutAmount === "number" ? payoutAmount : Number(payoutAmount);
    if (!activeWorkspaceId || amount <= 0 || amount > availableBalance) {
      return;
    }
    workspacePayout.mutate(
      {
        workspace_id: activeWorkspaceId,
        amount,
        creator_id: payoutCreatorId.trim() || null,
        activation_submission_id: payoutSubmissionId.trim() || null,
        bank_name: payoutBankName.trim() || null,
        account_number: payoutAccountNumber.trim() || null,
        account_name: payoutAccountName.trim() || null,
      },
      {
        onSuccess: () => {
          setPayoutAmount("");
          setPayoutCreatorId("");
          setPayoutSubmissionId("");
          setPayoutBankName("");
          setPayoutAccountNumber("");
          setPayoutAccountName("");
          setPayoutDialogOpen(false);
        },
      }
    );
  };

  const payoutAmountNum =
    typeof payoutAmount === "number" ? payoutAmount : Number(payoutAmount) || 0;
  const canSubmitPayout =
    activeWorkspaceId &&
    payoutAmountNum > 0 &&
    payoutAmountNum <= availableBalance &&
    !workspacePayout.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate("/dashboard")}
          className="w-11 h-11 min-h-[44px] rounded-md bg-muted/60 hover:bg-muted active:bg-muted border border-border flex items-center justify-center transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground">
            Wallet
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Manage your workspace balance for activations
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 sm:grid-cols-2">
        <Card className="bg-card border-border rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardContent className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm sm:text-base font-medium text-muted-foreground">
                Available Balance
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    queryClient.invalidateQueries({
                      queryKey: walletKeys.balance(activeWorkspaceId),
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["wallet", "transactions", activeWorkspaceId],
                    });
                    toast.info("Refreshing balance...");
                  }}
                  disabled={balanceLoading || !activeWorkspaceId}
                  className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
                  title="Refresh balance"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${balanceLoading ? "animate-spin" : ""}`}
                  />
                </Button>
                <WalletIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            {balanceLoading ? (
              <div className="h-12 sm:h-14 bg-muted/70 rounded animate-pulse" />
            ) : (
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                {formatAmount(availableBalance, currency)}
              </p>
            )}
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
              Use this balance to fund contests and SM panels
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardContent className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm sm:text-base font-medium text-muted-foreground">
                Locked Balance
              </span>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            {balanceLoading ? (
              <div className="h-12 sm:h-14 bg-muted/70 rounded animate-pulse" />
            ) : (
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                {formatAmount(lockedBalance, currency)}
              </p>
            )}
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
              Budget reserved for active activations
            </p>
          </CardContent>
        </Card>
      </div>

      {(pendingBalance > 0 || lifetimeSpent > 0) && !balanceLoading && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {pendingBalance > 0 && (
            <span>
              Pending: {formatAmount(pendingBalance, currency)}
            </span>
          )}
          {lifetimeSpent > 0 && (
            <span>
              Total spent: {formatAmount(lifetimeSpent, currency)}
            </span>
          )}
        </div>
      )}

      {/* Wallet-Activation Sync Status */}
      {syncState && !syncStateLoading && (
        <Card className="bg-card border-border rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Wallet-Activation Sync Status
                </span>
                {Math.abs(syncState.locked_discrepancy) < 0.01 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => validateSync.mutate()}
                  disabled={validateSync.isPending}
                  variant="outline"
                  size="sm"
                  className="border-border"
                >
                  {validateSync.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Expected Locked (from activations)</span>
                <span className="text-sm font-medium text-foreground">
                  {formatAmount(syncState.expected_locked_from_activations, currency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Actual Locked</span>
                <span className="text-sm font-medium text-foreground">
                  {formatAmount(syncState.actual_locked, currency)}
                </span>
              </div>
              {Math.abs(syncState.locked_discrepancy) >= 0.01 && (
                <>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-xs text-amber-700 dark:text-amber-400">Discrepancy</span>
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {formatAmount(Math.abs(syncState.locked_discrepancy), currency)}
                    </span>
                  </div>
                  {Math.abs(syncState.locked_discrepancy) <= autoFixThreshold && (
                    <Button
                      onClick={() => setAutoFixDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="w-full border-border mt-2"
                    >
                      <Wrench className="w-4 h-4 mr-2" />
                      Auto-fix ({formatAmount(Math.abs(syncState.locked_discrepancy), currency)})
                    </Button>
                  )}
                </>
              )}
              {syncState.live_activation_count > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">Live Activations</span>
                  <span className="text-sm font-medium text-foreground">
                    {syncState.live_activation_count}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">Transactions</h2>
            <div className="flex items-center gap-2">
              <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`border-border ${hasFilters ? "bg-primary/10 border-primary/30 text-primary" : ""}`}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                    {hasFilters && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground font-medium">
                        {filterType.length + (dateStart || dateEnd ? 1 : 0) + (minAmount !== "" || maxAmount !== "" ? 1 : 0)}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-0 bg-popover border-border">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-medium text-foreground">Filters</span>
                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Transaction Type */}
                  <div className="px-4 py-3 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transaction Type</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {TX_TYPES.map((t) => {
                        const isSelected = filterType.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() =>
                              setFilterType((prev) =>
                                isSelected ? prev.filter((x) => x !== t) : [...prev, t]
                              )
                            }
                            className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground font-medium"
                                : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                          >
                            {getTransactionLabel(t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date Range</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">From</label>
                        <Input
                          type="date"
                          value={dateStart}
                          onChange={(e) => setDateStart(e.target.value)}
                          className="bg-muted/70 border-border text-foreground text-xs h-8 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">To</label>
                        <Input
                          type="date"
                          value={dateEnd}
                          onChange={(e) => setDateEnd(e.target.value)}
                          className="bg-muted/70 border-border text-foreground text-xs h-8 w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Amount Range */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount ({currency})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
                        <Input
                          type="number"
                          placeholder="Min"
                          value={minAmount === "" ? "" : minAmount}
                          onChange={(e) =>
                            setMinAmount(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="bg-muted/70 border-border text-foreground text-xs h-8 pl-6"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={maxAmount === "" ? "" : maxAmount}
                          onChange={(e) =>
                            setMaxAmount(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="bg-muted/70 border-border text-foreground text-xs h-8 pl-6"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFilterOpen(false)}
                      className="flex-1 h-8 text-xs border-border"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={applyFilters}
                      className="flex-1 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={() => setFundDialogOpen(true)}
                disabled={!activeWorkspaceId}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Fund Wallet
              </Button>
            </div>
          </div>

          {/* Active Filter Badges */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {filterType.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted text-foreground"
                >
                  {getTransactionLabel(t)}
                  <button
                    onClick={() => setFilterType((prev) => prev.filter((x) => x !== t))}
                    className="hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(dateStart || dateEnd) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted text-foreground">
                  {dateStart && dateEnd
                    ? `${dateStart} - ${dateEnd}`
                    : dateStart
                    ? `From ${dateStart}`
                    : `Until ${dateEnd}`}
                  <button
                    onClick={() => {
                      setDateStart("");
                      setDateEnd("");
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(minAmount !== "" || maxAmount !== "") && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted text-foreground">
                  {minAmount !== "" && maxAmount !== ""
                    ? `₦${formatNumber(Number(minAmount))} - ₦${formatNumber(Number(maxAmount))}`
                    : minAmount !== ""
                    ? `Min ₦${formatNumber(Number(minAmount))}`
                    : `Max ₦${formatNumber(Number(maxAmount))}`}
                  <button
                    onClick={() => {
                      setMinAmount("");
                      setMaxAmount("");
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {transactionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-muted/70 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <WalletIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No transactions yet</p>
              <p className="text-muted-foreground text-xs mt-1">
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
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border border-border hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      {getTransactionIcon(tx)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        tx.type === "fund" || tx.type === "refund"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {tx.type === "fund" || tx.type === "refund" ? "+" : "-"}
                      {formatAmount(Math.abs(tx.amount), currency)}
                    </p>
                    {tx.balance_after != null && (
                      <p className="text-xs text-muted-foreground">
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Fund Wallet</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add balance via Paystack. You will be redirected to complete
              payment securely. Minimum ₦100. Funds are used for activations
              (contests and SM panels).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Amount ({currency})
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={fundAmount ? formatNumber(fundAmount) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  const num = parseFloat(raw) || 0;
                  setFundAmount(num);
                }}
                placeholder="e.g. 100,000"
                className="bg-muted/70 border-border text-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFundDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFund}
              disabled={
                initializeFund.isPending || !fundAmount || fundAmount < 100
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {initializeFund.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Pay creator</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Record a payout from your workspace wallet. Amount will be
              deducted and a withdrawal request created. Bank transfer is
              manual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Amount ({currency}) *
              </label>
              <Input
                type="number"
                min={1}
                max={availableBalance}
                step={1}
                value={payoutAmount === "" ? "" : payoutAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setPayoutAmount("");
                  else setPayoutAmount(Number(v));
                }}
                className="bg-muted/70 border-border text-foreground"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {formatAmount(availableBalance, currency)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Creator ID (optional)
              </label>
              <Input
                value={payoutCreatorId}
                onChange={(e) => setPayoutCreatorId(e.target.value)}
                className="bg-muted/70 border-border text-foreground"
                placeholder="UUID"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Activation submission ID (optional)
              </label>
              <Input
                value={payoutSubmissionId}
                onChange={(e) => setPayoutSubmissionId(e.target.value)}
                className="bg-muted/70 border-border text-foreground"
                placeholder="UUID"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Bank name
              </label>
              <Input
                value={payoutBankName}
                onChange={(e) => setPayoutBankName(e.target.value)}
                className="bg-muted/70 border-border text-foreground"
                placeholder="e.g. GTBank"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Account number
              </label>
              <Input
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value)}
                className="bg-muted/70 border-border text-foreground"
                placeholder="10 digits"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Account name
              </label>
              <Input
                value={payoutAccountName}
                onChange={(e) => setPayoutAccountName(e.target.value)}
                className="bg-muted/70 border-border text-foreground"
                placeholder="Full name on account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayoutDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayoutSubmit}
              disabled={!canSubmitPayout}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {workspacePayout.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Submit payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={autoFixDialogOpen} onOpenChange={setAutoFixDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Auto-fix Sync Discrepancy</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Automatically fix small discrepancies between wallet and activation state.
              Only fixes discrepancies below the threshold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {syncState && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Discrepancy</span>
                  <span className="text-foreground font-medium">
                    {formatAmount(Math.abs(syncState.locked_discrepancy), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Auto-fix Threshold</span>
                  <span className="text-foreground font-medium">
                    {formatAmount(autoFixThreshold, currency)}
                  </span>
                </div>
                {Math.abs(syncState.locked_discrepancy) > autoFixThreshold && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                    Discrepancy exceeds threshold. Manual review required.
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Threshold (NGN)
              </label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={autoFixThreshold}
                onChange={(e) => setAutoFixThreshold(Number(e.target.value) || 0)}
                className="bg-muted/60 border-border text-foreground"
                placeholder="10.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only discrepancies below this amount will be auto-fixed
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAutoFixDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                autoFixSync.mutate(autoFixThreshold, {
                  onSuccess: () => {
                    setAutoFixDialogOpen(false);
                  },
                });
              }}
              disabled={
                autoFixSync.isPending ||
                !syncState ||
                Math.abs(syncState.locked_discrepancy) > autoFixThreshold
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {autoFixSync.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Auto-fix
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
