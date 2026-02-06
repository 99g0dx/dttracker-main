import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as creatorWalletApi from "../lib/api/creator-wallet";
import type { CreateCreatorWithdrawalRequestParams } from "../lib/api/creator-wallet";
import { toast } from "sonner";

export const creatorWalletKeys = {
  all: ["creatorWallet"] as const,
  wallet: () => [...creatorWalletKeys.all, "wallet"] as const,
  transactions: (page?: number) =>
    [...creatorWalletKeys.all, "transactions", page ?? 0] as const,
  withdrawalRequests: (page?: number) =>
    [...creatorWalletKeys.all, "withdrawalRequests", page ?? 0] as const,
};

export function useCreatorWallet() {
  return useQuery({
    queryKey: creatorWalletKeys.wallet(),
    queryFn: async () => {
      const result = await creatorWalletApi.getCreatorWallet();
      if (result.error) throw result.error;
      return result.data;
    },
    refetchOnWindowFocus: true,
  });
}

export function useCreatorWalletTransactions(limit = 50, offset = 0) {
  return useQuery({
    queryKey: creatorWalletKeys.transactions(Math.floor(offset / limit)),
    queryFn: async () => {
      const result = await creatorWalletApi.getCreatorWalletTransactions(
        limit,
        offset
      );
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
}

export function useCreatorWithdrawalRequests(limit = 20, offset = 0) {
  return useQuery({
    queryKey: creatorWalletKeys.withdrawalRequests(Math.floor(offset / limit)),
    queryFn: async () => {
      const result = await creatorWalletApi.getCreatorWithdrawalRequests(
        limit,
        offset
      );
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
}

export function useCreateCreatorWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCreatorWithdrawalRequestParams) => {
      const result = await creatorWalletApi.createCreatorWithdrawalRequest(
        params
      );
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorWalletKeys.wallet() });
      queryClient.invalidateQueries({
        queryKey: [...creatorWalletKeys.all, "withdrawalRequests"],
      });
      toast.success("Withdrawal request submitted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit withdrawal: ${error.message}`);
    },
  });
}
