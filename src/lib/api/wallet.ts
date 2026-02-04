import { supabase } from '../supabase';
import type { ApiResponse } from '../types/database';

export interface WorkspaceWallet {
  id: string;
  workspace_id: string;
  balance: number;
  locked_balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  workspace_id: string;
  type: 'fund' | 'lock' | 'unlock' | 'payout' | 'refund';
  amount: number;
  balance_after: number | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getWalletBalance(
  workspaceId: string | null
): Promise<ApiResponse<WorkspaceWallet>> {
  if (!workspaceId) {
    return { data: null, error: new Error('Workspace ID required') };
  }
  try {
    const { data, error } = await supabase
      .from('workspace_wallets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) {
      return {
        data: {
          id: '',
          workspace_id: workspaceId,
          balance: 0,
          locked_balance: 0,
          currency: 'NGN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      };
    }
    return { data: data as WorkspaceWallet, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getWalletTransactions(
  workspaceId: string | null,
  limit = 50,
  offset = 0
): Promise<ApiResponse<WalletTransaction[]>> {
  if (!workspaceId) {
    return { data: null, error: new Error('Workspace ID required') };
  }
  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: null, error };
    return { data: (data || []) as WalletTransaction[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function fundWallet(
  workspaceId: string,
  amount: number
): Promise<ApiResponse<WorkspaceWallet>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return { data: null, error: new Error('Missing Supabase URL') };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/wallet-fund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...(import.meta.env.VITE_SUPABASE_ANON_KEY && {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        }),
      },
      body: JSON.stringify({ workspaceId, amount }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: new Error(result?.error || result?.message || 'Failed to fund wallet'),
      };
    }

    if (result.error) {
      return { data: null, error: new Error(result.error) };
    }

    return { data: result.wallet as WorkspaceWallet, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
