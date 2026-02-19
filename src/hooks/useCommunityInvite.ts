import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "../contexts/WorkspaceContext";
import * as communityInviteApi from "../lib/api/community-invite";
import type {
  CommunityInviteLink,
  CommunityInviteVerifyResult,
  DobbleTapVerifyResult,
  JoinCommunityRequest,
  JoinCommunityResult,
} from "../lib/api/community-invite";
import { toast } from "sonner";

export const communityInviteKeys = {
  all: ["community_invite"] as const,
  link: (workspaceId: string) =>
    [...communityInviteKeys.all, "link", workspaceId] as const,
  verify: (token: string) =>
    [...communityInviteKeys.all, "verify", token] as const,
};

/**
 * Fetch the active community invite link for the current workspace
 */
export function useCommunityInviteLink() {
  const { activeWorkspaceId } = useWorkspace();

  return useQuery({
    queryKey: communityInviteKeys.link(activeWorkspaceId || ""),
    queryFn: async () => {
      if (!activeWorkspaceId) return null;
      try {
        return await communityInviteApi.getCommunityInviteLink(activeWorkspaceId);
      } catch {
        return null;
      }
    },
    enabled: !!activeWorkspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Generate a new invite link (revokes existing one)
 */
export function useGenerateInviteLink() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId) throw new Error("No active workspace");
      return communityInviteApi.generateCommunityInviteLink(activeWorkspaceId);
    },
    onSuccess: () => {
      if (activeWorkspaceId) {
        queryClient.invalidateQueries({
          queryKey: communityInviteKeys.link(activeWorkspaceId),
        });
      }
      toast.success("Community invite link generated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate invite link");
    },
  });
}

/**
 * Revoke the active invite link
 */
export function useRevokeInviteLink() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId) throw new Error("No active workspace");
      return communityInviteApi.revokeCommunityInviteLink(activeWorkspaceId);
    },
    onSuccess: () => {
      if (activeWorkspaceId) {
        queryClient.invalidateQueries({
          queryKey: communityInviteKeys.link(activeWorkspaceId),
        });
      }
      toast.success("Invite link revoked");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke invite link");
    },
  });
}

/**
 * Verify a community invite token (public, no auth needed)
 */
export function useCommunityInviteByToken(token: string | undefined) {
  return useQuery({
    queryKey: communityInviteKeys.verify(token || ""),
    queryFn: async (): Promise<CommunityInviteVerifyResult> => {
      if (!token) return { valid: false, error: "No token" };
      return communityInviteApi.verifyCommunityInviteToken(token);
    },
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/**
 * Verify if a user has a Dobble Tap account (public)
 */
export function useVerifyDobbleTapUser() {
  return useMutation({
    mutationFn: async (params: {
      inviteToken: string;
      email: string;
    }): Promise<DobbleTapVerifyResult> => {
      return communityInviteApi.verifyDobbleTapUser(
        params.inviteToken,
        params.email,
      );
    },
  });
}

/**
 * Join a community (public)
 */
export function useJoinCommunity() {
  return useMutation({
    mutationFn: async (request: JoinCommunityRequest): Promise<JoinCommunityResult> => {
      return communityInviteApi.joinCommunity(request);
    },
  });
}

export type { CommunityInviteLink, CommunityInviteVerifyResult, DobbleTapVerifyResult, JoinCommunityResult };
