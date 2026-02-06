import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as walletApi from "../lib/api/wallet";
import type {
  WalletTransactionFilters,
  WalletActivationSyncState,
  WalletActivationValidation,
  WalletActivationReconciliation,
  AutoFixResult,
} from "../lib/api/wallet";
import { toast } from "sonner";

export const walletKeys = {
  all: ["wallet"] as const,
  balance: (workspaceId: string | null) =>
    [...walletKeys.all, "balance", workspaceId] as const,
  transactions: (
    workspaceId: string | null,
    page?: number,
    filters?: WalletTransactionFilters
  ) =>
    [
      ...walletKeys.all,
      "transactions",
      workspaceId,
      page ?? 0,
      filters ? JSON.stringify(filters) : "",
    ] as const,
  syncState: (workspaceId: string | null) =>
    [...walletKeys.all, "syncState", workspaceId] as const,
  syncValidation: (workspaceId: string | null) =>
    [...walletKeys.all, "syncValidation", workspaceId] as const,
};

export function useWalletBalance(workspaceId: string | null) {
  return useQuery({
    queryKey: walletKeys.balance(workspaceId),
    queryFn: async () => {
      const result = await walletApi.getWalletBalance(workspaceId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });
}

export function useWalletTransactions(
  workspaceId: string | null,
  limit = 50,
  offset = 0,
  filters?: WalletTransactionFilters
) {
  return useQuery({
    queryKey: walletKeys.transactions(
      workspaceId,
      Math.floor(offset / limit),
      filters
    ),
    queryFn: async () => {
      const result = await walletApi.getWalletTransactions(
        workspaceId,
        limit,
        offset,
        filters
      );
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: !!workspaceId,
  });
}

export function useReconcileWallet(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await walletApi.reconcileWallet(workspaceId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries({
        queryKey: walletKeys.balance(workspaceId ?? undefined),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.transactions(workspaceId ?? undefined),
      });
      toast.success("Wallet reconciled");
    },
    onError: (error: Error) => {
      toast.error(`Reconcile failed: ${error.message}`);
    },
  });
}

/** Initialize Paystack payment and redirect to Paystack. Wallet is credited via webhook on success. */
export function useInitializeWalletFund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      amount,
    }: {
      workspaceId: string;
      amount: number;
    }) => {
      const redirectUrl =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await walletApi.initializeWalletFund(
        workspaceId,
        amount,
        redirectUrl
      );
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (data) => {
      console.log("[useInitializeWalletFund] onSuccess received:", data);
      const url = data?.authorization_url;
      if (url && typeof url === "string") {
        console.log("[useInitializeWalletFund] Redirecting to Paystack:", url);
        try {
          sessionStorage.setItem("wallet_fund_pending", "1");
        } catch {
          // ignore if sessionStorage unavailable
        }
        // Show toast before redirect to confirm the action
        toast.success("Redirecting to Paystack...");
        // Small delay to ensure toast shows before redirect
        setTimeout(() => {
          window.location.href = url;
        }, 100);
      } else {
        console.error("[useInitializeWalletFund] No authorization_url in response:", data);
        toast.error(
          "Server did not return a payment URL. Check that wallet-fund-initialize is deployed and PAYSTACK_SECRET_KEY is set."
        );
      }
    },
    onError: (error: Error) => {
      if (import.meta.env.DEV) {
        console.error("[useInitializeWalletFund] onError:", error);
      }
      const msg = error.message || "Unknown error";
      const hint =
        msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network")
          ? " Check connection and deploy: supabase functions deploy wallet-fund-initialize"
          : "";
      toast.error(`Failed to fund wallet: ${msg}${hint}`);
    },
  });
}


/**
 * Get wallet-activation sync state
 */
export function useWalletActivationSyncState(workspaceId: string | null) {
  return useQuery({
    queryKey: walletKeys.syncState(workspaceId),
    queryFn: async () => {
      const result = await walletApi.getWalletActivationSyncState(workspaceId);
      // API handles missing view gracefully - returns { data: null, error: null }
      // If there's an error here, it's a real error (not a missing view)
      if (result.error && result.error.message !== "Workspace ID required") {
        throw result.error;
      }
      return result.data ?? null;
    },
    enabled: !!workspaceId,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
    retry: false, // Don't retry if view doesn't exist
    // Suppress error state for missing view (404s are handled gracefully)
    throwOnError: (error: any) => {
      // Don't throw if it's a "not found" error - these are handled gracefully
      const errorCode = (error as any)?.code;
      const errorMessage = error?.message || "";
      if (
        errorCode === "PGRST205" ||
        errorCode === "PGRST116" ||
        errorMessage.includes("not found") ||
        errorMessage.includes("schema cache")
      ) {
        return false; // Don't throw, treat as success (null data)
      }
      return true; // Throw real errors
    },
  });
}

/**
 * Validate wallet-activation sync
 */
export function useValidateWalletActivationSync(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await walletApi.validateWalletActivationSync(workspaceId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        walletKeys.syncValidation(workspaceId),
        data
      );
      if (data.valid) {
        toast.success("Wallet and activations are in sync");
      } else {
        const discrepancy = Math.abs(data.details.discrepancy);
        toast.warning(
          `Sync discrepancy detected: ${discrepancy.toFixed(2)} NGN`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(`Validation failed: ${error.message}`);
    },
  });
}

/**
 * Enhanced reconciliation with activation validation
 */
export function useReconcileWalletWithActivations(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await walletApi.reconcileWalletWithActivations(workspaceId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: walletKeys.balance(workspaceId ?? undefined),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.transactions(workspaceId ?? undefined),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.syncState(workspaceId ?? undefined),
      });
      queryClient.setQueryData(
        walletKeys.syncValidation(workspaceId),
        data.activation_validation
      );

      if (data.overall_sync_status === "synced") {
        toast.success("Wallet and activations are fully synced");
      } else {
        toast.warning("Discrepancies found. Review reconciliation details.");
      }
    },
    onError: (error: Error) => {
      toast.error(`Reconciliation failed: ${error.message}`);
    },
  });
}

/**
 * Auto-fix small sync discrepancies
 */
export function useAutoFixWalletActivationSync(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threshold: number = 10.0) => {
      const result = await walletApi.autoFixWalletActivationSync(
        workspaceId,
        threshold
      );
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: walletKeys.balance(workspaceId ?? undefined),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.transactions(workspaceId ?? undefined),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.syncState(workspaceId ?? undefined),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.syncValidation(workspaceId ?? undefined),
      });

      if (data.fixed) {
        toast.success(
          `Auto-fixed discrepancy of ${data.discrepancy.toFixed(2)} NGN`
        );
      } else {
        toast.info(
          data.reason ||
            `Discrepancy (${data.discrepancy.toFixed(2)} NGN) exceeds threshold (${data.threshold} NGN). Manual review required.`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(`Auto-fix failed: ${error.message}`);
    },
  });
}
