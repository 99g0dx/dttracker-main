import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api/creator-request-invitations";
import { activationsKeys } from "./useActivations";
import type { CreatorRequestInvitationStatus } from "../lib/types/database";
import { toast } from "sonner";

export const creatorRequestInvitationsKeys = {
  all: ["creator_request_invitations"] as const,
  listByActivation: (activationId: string) =>
    [...creatorRequestInvitationsKeys.all, "activation", activationId] as const,
  myInvitations: (status?: CreatorRequestInvitationStatus) =>
    [...creatorRequestInvitationsKeys.all, "my", status ?? "all"] as const,
};

export function useActivationInvitations(
  activationId: string | null,
  options?: { withCreator?: boolean }
) {
  return useQuery({
    queryKey: [
      ...creatorRequestInvitationsKeys.listByActivation(activationId ?? ""),
      options?.withCreator ?? false,
    ],
    queryFn: async () => {
      if (!activationId) return [];
      const result = await api.listActivationInvitations(activationId, {
        withCreator: options?.withCreator,
      });
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: !!activationId,
  });
}

export function useMyInvitations(status?: CreatorRequestInvitationStatus) {
  return useQuery({
    queryKey: creatorRequestInvitationsKeys.myInvitations(status),
    queryFn: async () => {
      const result = await api.listMyInvitations(status);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
}

export function useCreateInvitations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activationId,
      invitations,
    }: {
      activationId: string;
      invitations: api.CreateInvitationInput[];
    }) => {
      const result = await api.createInvitations(activationId, invitations);
      if (result.error) throw result.error;
      return { activationId, invitations: result.data ?? [] };
    },
    onSuccess: ({ activationId }) => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestInvitationsKeys.listByActivation(activationId),
      });
      queryClient.invalidateQueries({
        queryKey: activationsKeys.detail(activationId),
      });
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      queryClient.invalidateQueries({
        queryKey: creatorRequestInvitationsKeys.myInvitations(),
      });
      toast.success("Invitations created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invitations: ${error.message}`);
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await api.acceptInvitation(invitationId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestInvitationsKeys.all,
      });
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Invitation accepted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to accept: ${error.message}`);
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await api.declineInvitation(invitationId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestInvitationsKeys.all,
      });
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Invitation declined");
    },
    onError: (error: Error) => {
      toast.error(`Failed to decline: ${error.message}`);
    },
  });
}

export function useReleasePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await api.releasePayment(invitationId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestInvitationsKeys.all,
      });
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Payment released");
    },
    onError: (error: Error) => {
      toast.error(`Failed to release payment: ${error.message}`);
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await api.cancelInvitation(invitationId);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestInvitationsKeys.all,
      });
      queryClient.invalidateQueries({ queryKey: activationsKeys.all });
      toast.success("Invitation cancelled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel invitation: ${error.message}`);
    },
  });
}
