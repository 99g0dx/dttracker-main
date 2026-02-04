import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as walletApi from '../lib/api/wallet';
import { toast } from 'sonner';

export const walletKeys = {
  all: ['wallet'] as const,
  balance: (workspaceId: string | null) => [...walletKeys.all, 'balance', workspaceId] as const,
  transactions: (workspaceId: string | null, page?: number) =>
    [...walletKeys.all, 'transactions', workspaceId, page ?? 0] as const,
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
  });
}

export function useWalletTransactions(workspaceId: string | null, limit = 50, offset = 0) {
  return useQuery({
    queryKey: walletKeys.transactions(workspaceId, Math.floor(offset / limit)),
    queryFn: async () => {
      const result = await walletApi.getWalletTransactions(workspaceId, limit, offset);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: !!workspaceId,
  });
}

export function useFundWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, amount }: { workspaceId: string; amount: number }) => {
      const result = await walletApi.fundWallet(workspaceId, amount);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.balance(variables.workspaceId) });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions(variables.workspaceId) });
      toast.success('Wallet funded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to fund wallet: ${error.message}`);
    },
  });
}
