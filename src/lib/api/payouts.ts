import { supabase } from "../supabase";
import type { ApiResponse } from "../types/database";

export interface WithdrawalRequest {
  id: string;
  workspace_id: string;
  activation_submission_id: string | null;
  creator_id: string | null;
  amount: number;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
  payment_reference: string | null;
  payment_provider: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspacePayoutParams {
  workspace_id: string;
  amount: number;
  activation_submission_id?: string | null;
  creator_id?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
}

export interface CreateWorkspacePayoutSuccess {
  success: true;
  withdrawal_request_id: string;
  amount: number;
  new_balance: number;
}

export async function createWorkspacePayout(
  params: CreateWorkspacePayoutParams
): Promise<ApiResponse<CreateWorkspacePayoutSuccess>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return { data: null, error: new Error("Missing Supabase URL") };
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/workspace-payout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          ...(import.meta.env.VITE_SUPABASE_ANON_KEY && {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          }),
        },
        body: JSON.stringify({
          workspace_id: params.workspace_id,
          amount: params.amount,
          activation_submission_id: params.activation_submission_id ?? null,
          creator_id: params.creator_id ?? null,
          bank_name: params.bank_name ?? null,
          account_number: params.account_number ?? null,
          account_name: params.account_name ?? null,
        }),
      }
    );

    const result = (await response.json()) as
      | CreateWorkspacePayoutSuccess
      | { error?: string; message?: string };

    if (!response.ok) {
      const msg =
        (result as { error?: string }).error ??
        (result as { message?: string }).message ??
        `Server error (${response.status})`;
      return { data: null, error: new Error(msg) };
    }

    if ("error" in result && result.error) {
      return { data: null, error: new Error(result.error) };
    }

    return {
      data: result as CreateWorkspacePayoutSuccess,
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getWithdrawalRequests(
  workspaceId: string | null,
  limit = 50,
  offset = 0
): Promise<ApiResponse<WithdrawalRequest[]>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: null, error };
    const rows = (data || []) as Record<string, unknown>[];
    return {
      data: rows.map((r) => ({
        id: String(r.id ?? ""),
        workspace_id: String(r.workspace_id ?? ""),
        activation_submission_id: (r.activation_submission_id as string) ?? null,
        creator_id: (r.creator_id as string) ?? null,
        amount: Number(r.amount) || 0,
        status: String(r.status ?? "pending"),
        bank_name: (r.bank_name as string) ?? null,
        account_number: (r.account_number as string) ?? null,
        account_name: (r.account_name as string) ?? null,
        requested_at: String(r.requested_at ?? ""),
        processed_at: (r.processed_at as string) ?? null,
        processed_by: (r.processed_by as string) ?? null,
        payment_reference: (r.payment_reference as string) ?? null,
        payment_provider: (r.payment_provider as string) ?? null,
        failure_reason: (r.failure_reason as string) ?? null,
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
