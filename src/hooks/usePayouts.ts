import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as payoutsApi from "../lib/api/payouts";
import type { CreateWorkspacePayoutParams } from "../lib/api/payouts";
import { toast } from "sonner";
import { walletKeys } from "./useWallet";

export const payoutKeys = {
  all: ["payouts"] as const,
  withdrawalRequests: (workspaceId: string | null) =>
    [...payoutKeys.all, "withdrawalRequests", workspaceId] as const,
};

export function useWithdrawalRequests(
  workspaceId: string | null,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: payoutKeys.withdrawalRequests(workspaceId),
    queryFn: async () => {
      const result = await payoutsApi.getWithdrawalRequests(
        workspaceId,
        limit,
        offset
      );
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: !!workspaceId,
  });
}

export function useWorkspacePayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateWorkspacePayoutParams) => {
      const result = await payoutsApi.createWorkspacePayout(params);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: payoutKeys.withdrawalRequests(variables.workspace_id),
      });
      queryClient.invalidateQueries({
        queryKey: walletKeys.balance(variables.workspace_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["wallet", "transactions", variables.workspace_id],
      });
      toast.success("Payout completed");
    },
    onError: (error: Error) => {
      toast.error(`Payout failed: ${error.message}`);
    },
  });
}
