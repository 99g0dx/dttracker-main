import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as campaignMembersApi from '../lib/api/campaign-members';
import type { CampaignMemberInsert } from '../lib/types/database';
import { toast } from 'sonner';

// Query keys
export const campaignMembersKeys = {
  all: ['campaign-members'] as const,
  lists: () => [...campaignMembersKeys.all, 'list'] as const,
  list: (campaignId: string) => [...campaignMembersKeys.lists(), campaignId] as const,
  teamMembers: () => [...campaignMembersKeys.all, 'team'] as const,
  access: (campaignId: string, userId: string) => [...campaignMembersKeys.all, 'access', campaignId, userId] as const,
};

/**
 * Hook to fetch all team members (potential users to share with)
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: campaignMembersKeys.teamMembers(),
    queryFn: async () => {
      const result = await campaignMembersApi.getTeamMembers();
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch members of a specific campaign
 */
export function useCampaignMembers(campaignId: string) {
  return useQuery({
    queryKey: campaignMembersKeys.list(campaignId),
    queryFn: async () => {
      const result = await campaignMembersApi.getCampaignMembers(campaignId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to check if a user has access to a campaign
 */
export function useCampaignAccess(campaignId: string, userId: string) {
  return useQuery({
    queryKey: campaignMembersKeys.access(campaignId, userId),
    queryFn: async () => {
      const result = await campaignMembersApi.checkCampaignAccess(campaignId, userId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!campaignId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to add a member to a campaign
 */
export function useAddCampaignMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (member: CampaignMemberInsert) => {
      const result = await campaignMembersApi.addCampaignMember(member);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate campaign members list
      queryClient.invalidateQueries({ queryKey: campaignMembersKeys.list(variables.campaign_id) });
      // Invalidate access check
      queryClient.invalidateQueries({ queryKey: campaignMembersKeys.access(variables.campaign_id, variables.user_id) });
      toast.success('Member added successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add member: ${error.message}`);
    },
  });
}

/**
 * Hook to update a member's role
 */
export function useUpdateCampaignMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, userId, role }: { campaignId: string; userId: string; role: 'owner' | 'editor' | 'viewer' }) => {
      const result = await campaignMembersApi.updateCampaignMemberRole(campaignId, userId, role);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate campaign members list
      queryClient.invalidateQueries({ queryKey: campaignMembersKeys.list(variables.campaignId) });
      // Invalidate access check
      queryClient.invalidateQueries({ queryKey: campaignMembersKeys.access(variables.campaignId, variables.userId) });
      toast.success('Member role updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}

/**
 * Hook to remove a member from a campaign
 */
export function useRemoveCampaignMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, userId }: { campaignId: string; userId: string }) => {
      const result = await campaignMembersApi.removeCampaignMember(campaignId, userId);
      if (result.error) {
        throw result.error;
      }
      return { campaignId, userId };
    },
    onMutate: async ({ campaignId, userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: campaignMembersKeys.list(campaignId) });

      // Snapshot previous value
      const previousMembers = queryClient.getQueryData(campaignMembersKeys.list(campaignId));

      // Optimistically remove from list
      queryClient.setQueryData(campaignMembersKeys.list(campaignId), (old: any[] | undefined) => {
        if (!old) return old;
        return old.filter(member => member.user_id !== userId);
      });

      return { previousMembers, campaignId };
    },
    onSuccess: (data) => {
      // Invalidate campaign members list
      queryClient.invalidateQueries({ queryKey: campaignMembersKeys.list(data.campaignId) });
      // Invalidate access check
      queryClient.invalidateQueries({ queryKey: campaignMembersKeys.access(data.campaignId, data.userId) });
      toast.success('Member removed successfully');
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousMembers && context?.campaignId) {
        queryClient.setQueryData(campaignMembersKeys.list(context.campaignId), context.previousMembers);
      }
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });
}
