import { supabase } from "../supabase";
import type { ApiResponse } from "../types/database";

export interface WorkspaceWallet {
  id: string;
  workspace_id: string;
  balance: number;
  locked_balance: number;
  pending_balance?: number;
  lifetime_spent?: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type WalletTransactionType =
  | "fund"
  | "lock"
  | "unlock"
  | "payout"
  | "refund"
  | "fee"
  | "service_fee"
  | "withdrawal";

export interface WalletTransaction {
  id: string;
  service_fee_amount?: number | null;
  workspace_id: string;
  type: WalletTransactionType;
  amount: number;
  balance_after: number | null;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  status?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getWalletBalance(
  workspaceId: string | null
): Promise<ApiResponse<WorkspaceWallet>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase
      .from("workspace_wallets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }
    if (!data) {
      return {
        data: {
          id: "",
          workspace_id: workspaceId,
          balance: 0,
          locked_balance: 0,
          pending_balance: 0,
          lifetime_spent: 0,
          currency: "NGN",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      };
    }
    // Coerce numeric fields (Postgres NUMERIC often returned as string)
    const raw = data as Record<string, unknown>;
    const walletData: WorkspaceWallet = {
      id: String(raw.id ?? ""),
      workspace_id: String(raw.workspace_id ?? workspaceId),
      balance: Number(raw.balance) || 0,
      locked_balance: Number(raw.locked_balance) || 0,
      pending_balance: Number(raw.pending_balance) || 0,
      lifetime_spent: Number(raw.lifetime_spent) || 0,
      currency: String(raw.currency ?? "NGN"),
      created_at: String(raw.created_at ?? new Date().toISOString()),
      updated_at: String(raw.updated_at ?? new Date().toISOString()),
    };
    return { data: walletData, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export interface WalletTransactionFilters {
  type?: WalletTransactionType[];
  dateRange?: { start: string; end: string };
  minAmount?: number;
  maxAmount?: number;
}

export async function getWalletTransactions(
  workspaceId: string | null,
  limit = 50,
  offset = 0,
  filters?: WalletTransactionFilters
): Promise<ApiResponse<WalletTransaction[]>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    let query = supabase
      .from("wallet_transactions")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (filters?.type?.length) {
      query = query.in("type", filters.type);
    }
    if (filters?.dateRange?.start) {
      query = query.gte("created_at", filters.dateRange.start);
    }
    if (filters?.dateRange?.end) {
      query = query.lte("created_at", filters.dateRange.end);
    }
    if (filters?.minAmount != null) {
      query = query.gte("amount", filters.minAmount);
    }
    if (filters?.maxAmount != null) {
      query = query.lte("amount", filters.maxAmount);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: null, error };
    return { data: (data || []) as WalletTransaction[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export interface WalletReconciliation {
  id: string;
  workspace_id: string;
  reconciliation_date: string;
  expected_balance: number;
  actual_balance: number;
  discrepancy: number;
  expected_locked: number;
  actual_locked: number;
  discrepancy_locked: number;
  transaction_count: number | null;
  status: string;
  created_at: string;
}

export interface WalletActivationSyncState {
  workspace_id: string;
  actual_balance: number;
  actual_locked: number;
  expected_locked_from_activations: number;
  total_budget_locked: number;
  total_spent_in_activations: number;
  live_activation_count: number;
  locked_discrepancy: number;
}

export interface WalletActivationValidation {
  valid: boolean;
  details: {
    workspace_id: string;
    actual_locked: number;
    expected_locked: number;
    discrepancy: number;
    total_budget_locked: number;
    total_spent: number;
    live_activation_count: number;
    is_valid: boolean;
    tolerance: number;
  };
  error?: string;
}

export interface WalletActivationReconciliation {
  wallet_reconciliation: WalletReconciliation;
  activation_validation: WalletActivationValidation;
  overall_sync_status: "synced" | "discrepancy";
  reconciliation_date: string;
}

export interface AutoFixResult {
  fixed: boolean;
  discrepancy: number;
  threshold: number;
  validation: WalletActivationValidation;
  reason?: string;
}

const RECONCILE_MIGRATION_HINT =
  "Reconciliation is not available until database migrations are applied. Run: supabase db push (or apply migration 20260212000008_wallet_reconciliations.sql in the Supabase Dashboard).";

export async function reconcileWallet(
  workspaceId: string | null
): Promise<ApiResponse<WalletReconciliation>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase.rpc("reconcile_wallet", {
      p_workspace_id: workspaceId,
    });
    if (error) {
      const msg = error.message ?? "";
      if (
        msg.includes("Could not find the function") ||
        msg.includes("schema cache") ||
        msg.includes("reconcile_wallet")
      ) {
        return {
          data: null,
          error: new Error(RECONCILE_MIGRATION_HINT),
        };
      }
      return { data: null, error };
    }
    return { data: data as WalletReconciliation, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Could not find the function") ||
      message.includes("schema cache") ||
      message.includes("reconcile_wallet")
    ) {
      return {
        data: null,
        error: new Error(RECONCILE_MIGRATION_HINT),
      };
    }
    return { data: null, error: err as Error };
  }
}

export interface InitializeWalletFundResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * Initialize Paystack payment for wallet funding. Returns URL to redirect user to Paystack.
 * After successful payment, Paystack redirects back and the webhook credits the wallet.
 * Pass redirectUrl (e.g. window.location.origin) so the callback URL is correct when env vars are unset.
 */
export async function initializeWalletFund(
  workspaceId: string,
  amount: number,
  redirectUrl?: string
): Promise<ApiResponse<InitializeWalletFundResponse>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return { data: null, error: new Error("Missing Supabase URL") };
    }

    let response: Response;
    try {
      response = await fetch(
        `${supabaseUrl}/functions/v1/wallet-fund-initialize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...(import.meta.env.VITE_SUPABASE_ANON_KEY && {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            }),
          },
          body: JSON.stringify({ workspaceId, amount, redirectUrl }),
        }
      );
    } catch (networkErr) {
      const msg =
        (networkErr as Error)?.message?.toLowerCase().includes("fetch") ||
        (networkErr as Error)?.message?.toLowerCase().includes("network")
          ? "Could not reach the server. Check your connection and that the Supabase project URL is correct. Deploy the function with: supabase functions deploy wallet-fund-initialize"
          : (networkErr as Error)?.message ?? "Network error";
      return { data: null, error: new Error(msg) };
    }

    let result: Record<string, unknown>;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      if (import.meta.env.DEV) {
        console.error("[initializeWalletFund] Failed to parse JSON response");
      }
      return {
        data: null,
        error: new Error(
          response.ok
            ? "Invalid response from server"
            : `Server error (${response.status}). Try again or deploy wallet-fund-initialize.`
        ),
      };
    }

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.error("[initializeWalletFund] Response not OK:", result);
      }
      return {
        data: null,
        error: new Error(
          (result?.error as string) ||
            (result?.message as string) ||
            "Failed to initialize payment"
        ),
      };
    }

    if (result.error) {
      if (import.meta.env.DEV) {
        console.error("[initializeWalletFund] Error in result:", result.error);
      }
      return { data: null, error: new Error(result.error as string) };
    }

    const nested = result.data as Record<string, unknown> | undefined;
    const authorizationUrl =
      (result.authorization_url as string) ||
      (nested?.authorization_url as string);
    if (!authorizationUrl || typeof authorizationUrl !== "string") {
      if (import.meta.env.DEV) {
        console.error("[initializeWalletFund] No authorization_url in result:", result);
      }
      return { data: null, error: new Error("No payment URL returned from server. Deploy wallet-fund-initialize and set PAYSTACK_SECRET_KEY.") };
    }
    return {
      data: {
        authorization_url: authorizationUrl,
        access_code: (result.access_code as string) || (nested?.access_code as string) || "",
        reference: (result.reference as string) || (nested?.reference as string) || "",
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


/**
 * Get wallet-activation sync state (expected vs actual locked balance)
 */
export async function getWalletActivationSyncState(
  workspaceId: string | null
): Promise<ApiResponse<WalletActivationSyncState | null>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase
      .from("wallet_activation_sync_state")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    // Handle 404 or missing view gracefully - return null data instead of error
    if (error) {
      // If it's a 404 or table/view doesn't exist, return null data (not an error)
      // PGRST116 = not found, PGRST205 = table/view not in schema cache
      if (
        error.code === "PGRST116" ||
        error.code === "PGRST205" ||
        error.message?.includes("relation") ||
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache")
      ) {
        return { data: null, error: null };
      }
      return { data: null, error };
    }
    if (!data) {
      // No sync state found - this is OK, return null
      return { data: null, error: null };
    }
    return { data: data as WalletActivationSyncState, error: null };
  } catch (err) {
    // Catch-all: if view doesn't exist, return null instead of error
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("relation") ||
      message.includes("does not exist") ||
      message.includes("PGRST116") ||
      message.includes("PGRST205") ||
      message.includes("schema cache")
    ) {
      return { data: null, error: null };
    }
    return { data: null, error: err as Error };
  }
}

/**
 * Validate wallet-activation sync (checks if locked_balance matches activations)
 */
export async function validateWalletActivationSync(
  workspaceId: string | null
): Promise<ApiResponse<WalletActivationValidation>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase.rpc("validate_wallet_activation_sync", {
      p_workspace_id: workspaceId,
    });
    if (error) {
      const msg = error.message ?? "";
      if (
        msg.includes("Could not find the function") ||
        msg.includes("schema cache") ||
        msg.includes("validate_wallet_activation_sync")
      ) {
        return {
          data: null,
          error: new Error(
            "Sync validation is not available until database migrations are applied. Run: supabase db push (or apply migration 20260216000001_wallet_activation_sync.sql in the Supabase Dashboard)."
          ),
        };
      }
      return { data: null, error };
    }
    return { data: data as WalletActivationValidation, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Could not find the function") ||
      message.includes("schema cache") ||
      message.includes("validate_wallet_activation_sync")
    ) {
      return {
        data: null,
        error: new Error(
          "Sync validation is not available until database migrations are applied. Run: supabase db push (or apply migration 20260216000001_wallet_activation_sync.sql in the Supabase Dashboard)."
        ),
      };
    }
    return { data: null, error: err as Error };
  }
}

/**
 * Enhanced reconciliation that checks both wallet transactions AND activation state
 */
export async function reconcileWalletWithActivations(
  workspaceId: string | null
): Promise<ApiResponse<WalletActivationReconciliation>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase.rpc("reconcile_wallet_with_activations", {
      p_workspace_id: workspaceId,
    });
    if (error) {
      const msg = error.message ?? "";
      if (
        msg.includes("Could not find the function") ||
        msg.includes("schema cache") ||
        msg.includes("reconcile_wallet_with_activations")
      ) {
        return {
          data: null,
          error: new Error(
            "Enhanced reconciliation is not available until database migrations are applied. Run: supabase db push (or apply migration 20260216000001_wallet_activation_sync.sql in the Supabase Dashboard)."
          ),
        };
      }
      return { data: null, error };
    }
    return { data: data as WalletActivationReconciliation, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Could not find the function") ||
      message.includes("schema cache") ||
      message.includes("reconcile_wallet_with_activations")
    ) {
      return {
        data: null,
        error: new Error(
          "Enhanced reconciliation is not available until database migrations are applied. Run: supabase db push (or apply migration 20260216000001_wallet_activation_sync.sql in the Supabase Dashboard)."
        ),
      };
    }
    return { data: null, error: err as Error };
  }
}

/**
 * Auto-fix small discrepancies between wallet and activation state
 */
export async function autoFixWalletActivationSync(
  workspaceId: string | null,
  threshold: number = 10.0
): Promise<ApiResponse<AutoFixResult>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase.rpc("auto_fix_wallet_activation_sync", {
      p_workspace_id: workspaceId,
      p_auto_fix_threshold: threshold,
    });
    if (error) {
      const msg = error.message ?? "";
      if (
        msg.includes("Could not find the function") ||
        msg.includes("schema cache") ||
        msg.includes("auto_fix_wallet_activation_sync")
      ) {
        return {
          data: null,
          error: new Error(
            "Auto-fix is not available until database migrations are applied. Run: supabase db push (or apply migration 20260216000001_wallet_activation_sync.sql in the Supabase Dashboard)."
          ),
        };
      }
      return { data: null, error };
    }
    return { data: data as AutoFixResult, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Could not find the function") ||
      message.includes("schema cache") ||
      message.includes("auto_fix_wallet_activation_sync")
    ) {
      return {
        data: null,
        error: new Error(
          "Auto-fix is not available until database migrations are applied. Run: supabase db push (or apply migration 20260216000001_wallet_activation_sync.sql in the Supabase Dashboard)."
        ),
      };
    }
    return { data: null, error: err as Error };
  }
}
