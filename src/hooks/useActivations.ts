import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as activationsApi from "../lib/api/activations";
import { toast } from "sonner";

export const activationsKeys = {
  all: ["activations"] as const,
  lists: (workspaceId: string | null, filters?: object) =>
    [...activationsKeys.all, "list", workspaceId, filters ?? {}] as const,
  detail: (id: string) => [...activationsKeys.all, "detail", id] as const,
  submissions: (activationId: string) =>
    [...activationsKeys.all, "submissions", activationId] as const,
  leaderboard: (activationId: string) =>
    [...activationsKeys.all, "leaderboard", activationId] as const,
};

export function useActivations(
  workspaceId: string | null,
  filters?: {
    type?: "contest" | "sm_panel" | "creator_request";
    status?: string;
    visibility?: "public" | "community" | "all";
  },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: activationsKeys.lists(workspaceId, filters),
    queryFn: async () => {
      const result = await activationsApi.listActivations(workspaceId, filters);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: (options?.enabled ?? true) && !!workspaceId,
  });
}

export function useActivation(id: string | null) {
  return useQuery({
    queryKey: activationsKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const result = await activationsApi.getActivation(id);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!id,
  });
}

export function useContestLeaderboard(activationId: string | null) {
  return useQuery({
    queryKey: activationsKeys.leaderboard(activationId ?? ""),
    queryFn: async () => {
      if (!activationId) return null;
      const result = await activationsApi.getContestLeaderboard(activationId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!activationId,
  });
}

export function useActivationSubmissions(activationId: string | null) {
  return useQuery({
    queryKey: activationsKeys.submissions(activationId ?? ""),
    queryFn: async () => {
      if (!activationId) return [];
      const result =
        await activationsApi.getActivationSubmissions(activationId);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: !!activationId,
  });
}

export function useCreateActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      activation: Parameters<typeof activationsApi.createActivation>[0]
    ) => {
      const result = await activationsApi.createActivation(activation);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: activationsKeys.lists(variables.workspace_id),
      });
      toast.success("Activation created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });
}

export function useUpdateActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof activationsApi.updateActivation>[1];
    }) => {
      const result = await activationsApi.updateActivation(id, updates);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: activationsKeys.detail(data.id),
        });
        queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      }
      toast.success("Activation updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useDeleteActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await activationsApi.deleteActivation(id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Activation deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}

export function useCloseActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await activationsApi.closeActivation(id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Activation closed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to close: ${error.message}`);
    },
  });
}

export function usePublishActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activationId: string) => {
      const result = await activationsApi.publishActivation(activationId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: activationsKeys.detail(data.id),
        });
        queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      }
      toast.success("Activation published");
    },
    onError: (error: Error) => {
      toast.error(`Failed to publish: ${error.message}`);
    },
  });
}

export function useSyncActivationToDobbleTap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activationId: string) => {
      const result = await activationsApi.syncActivationToDobbleTap(activationId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: activationsKeys.detail(data.id),
        });
        queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      }
      toast.success("Activation synced to Dobble Tap");
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync to Dobble Tap: ${error.message}`);
    },
  });
}

export function useApproveSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      paymentAmount,
    }: {
      submissionId: string;
      paymentAmount?: number;
    }) => {
      const result = await activationsApi.approveSubmission(
        submissionId,
        paymentAmount
      );
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: activationsKeys.submissions(data.activation_id),
        });
        queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      }
      toast.success("Submission approved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });
}

export function useRejectSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const result = await activationsApi.rejectSubmission(submissionId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: activationsKeys.submissions(data.activation_id),
        });
        queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      }
      toast.success("Submission rejected");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}

export function useScrapeSubmission(activationId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: string | { submissionId: string; silent?: boolean }
    ) => {
      const submissionId =
        typeof input === "string" ? input : input.submissionId;
      const result = await activationsApi.scrapeSubmissionMetrics(submissionId);
      if (result.error) throw result.error;
      return {
        data: result.data,
        silent: typeof input === "object" && input.silent,
      };
    },
    onSuccess: (result, input) => {
      const submissionId =
        typeof input === "string" ? input : input.submissionId;
      const silent = typeof input === "object" && input.silent;
      if (activationId) {
        queryClient.invalidateQueries({
          queryKey: activationsKeys.submissions(activationId),
        });
        queryClient.invalidateQueries({
          queryKey: activationsKeys.leaderboard(activationId),
        });
      }
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      if (!silent) {
        toast.success("Metrics updated");
      }
    },
    onError: (error: Error, input) => {
      const silent = typeof input === "object" && input?.silent;
      if (!silent) {
        toast.error(`Scrape failed: ${error.message}`);
      }
    },
  });
}

export function useFinalizeWinners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activationId,
      winners,
    }: {
      activationId: string;
      winners: Array<{
        submissionId: string;
        rank: number;
        prizeAmount: number;
      }>;
    }) => {
      const result = await activationsApi.finalizeContestWinners(
        activationId,
        winners
      );
      if (result.error) throw result.error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: activationsKeys.detail(variables.activationId),
      });
      queryClient.invalidateQueries({
        queryKey: activationsKeys.submissions(variables.activationId),
      });
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Winners finalized");
    },
    onError: (error: Error) => {
      toast.error(`Failed to finalize: ${error.message}`);
    },
  });
}
