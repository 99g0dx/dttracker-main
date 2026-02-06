import { supabase } from "../supabase";
import type { ApiResponse } from "../types/database";

export interface CreatorWallet {
  creator_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type CreatorWalletTransactionType =
  | "sm_panel_payment"
  | "contest_prize"
  | "bonus"
  | "withdrawal"
  | "withdrawal_reversal"
  | "adjustment";

export interface CreatorWalletTransaction {
  id: string;
  creator_id: string;
  type: CreatorWalletTransactionType;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

export interface CreatorWithdrawalRequest {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  requested_at: string;
  processed_at: string | null;
  payment_reference: string | null;
  payment_provider: string | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toCreatorWallet(raw: Record<string, unknown>): CreatorWallet {
  return {
    creator_id: String(raw.creator_id ?? ""),
    available_balance: Number(raw.available_balance) || 0,
    pending_balance: Number(raw.pending_balance) || 0,
    lifetime_earned: Number(raw.lifetime_earned) || 0,
    currency: String(raw.currency ?? "NGN"),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? new Date().toISOString()),
  };
}

export async function getCreatorWallet(): Promise<ApiResponse<CreatorWallet | null>> {
  try {
    const { data, error } = await supabase
      .from("creator_wallets")
      .select("*")
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }
    if (!data) {
      return { data: null, error: null };
    }
    return { data: toCreatorWallet(data as Record<string, unknown>), error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getCreatorWalletTransactions(
  limit = 50,
  offset = 0
): Promise<ApiResponse<CreatorWalletTransaction[]>> {
  try {
    const { data, error } = await supabase
      .from("creator_wallet_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: null, error };
    const rows = (data || []) as Record<string, unknown>[];
    return {
      data: rows.map((r) => ({
        id: String(r.id ?? ""),
        creator_id: String(r.creator_id ?? ""),
        type: r.type as CreatorWalletTransactionType,
        amount: Number(r.amount) || 0,
        balance_after: Number(r.balance_after) || 0,
        reference_type: (r.reference_type as string) ?? null,
        reference_id: (r.reference_id as string) ?? null,
        description: (r.description as string) ?? null,
        status: String(r.status ?? "completed"),
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        created_at: String(r.created_at ?? ""),
        processed_at: (r.processed_at as string) ?? null,
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getCreatorWithdrawalRequests(
  limit = 20,
  offset = 0
): Promise<ApiResponse<CreatorWithdrawalRequest[]>> {
  try {
    const { data, error } = await supabase
      .from("creator_withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: null, error };
    const rows = (data || []) as Record<string, unknown>[];
    return {
      data: rows.map((r) => ({
        id: String(r.id ?? ""),
        creator_id: String(r.creator_id ?? ""),
        amount: Number(r.amount) || 0,
        status: String(r.status ?? "pending"),
        bank_name: (r.bank_name as string) ?? null,
        account_number: (r.account_number as string) ?? null,
        account_name: (r.account_name as string) ?? null,
        requested_at: String(r.requested_at ?? ""),
        processed_at: (r.processed_at as string) ?? null,
        payment_reference: (r.payment_reference as string) ?? null,
        payment_provider: (r.payment_provider as string) ?? null,
        failure_reason: (r.failure_reason as string) ?? null,
        notes: (r.notes as string) ?? null,
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export interface CreateCreatorWithdrawalRequestParams {
  amount: number;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
}

export async function createCreatorWithdrawalRequest(
  params: CreateCreatorWithdrawalRequestParams
): Promise<ApiResponse<CreatorWithdrawalRequest>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data, error } = await supabase
      .from("creator_withdrawal_requests")
      .insert({
        creator_id: user.id,
        amount: params.amount,
        status: "pending",
        bank_name: params.bank_name ?? null,
        account_number: params.account_number ?? null,
        account_name: params.account_name ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error };
    const r = data as Record<string, unknown>;
    return {
      data: {
        id: String(r.id ?? ""),
        creator_id: String(r.creator_id ?? ""),
        amount: Number(r.amount) || 0,
        status: String(r.status ?? "pending"),
        bank_name: (r.bank_name as string) ?? null,
        account_number: (r.account_number as string) ?? null,
        account_name: (r.account_name as string) ?? null,
        requested_at: String(r.requested_at ?? ""),
        processed_at: (r.processed_at as string) ?? null,
        payment_reference: (r.payment_reference as string) ?? null,
        payment_provider: (r.payment_provider as string) ?? null,
        failure_reason: (r.failure_reason as string) ?? null,
        notes: (r.notes as string) ?? null,
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
