import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as teamApi from '../lib/api/team';
import type {
  TeamMember,
  TeamMemberInsert,
  TeamMemberUpdate,
  TeamInvite,
  TeamInviteInsert,
  MemberScope,
  MemberScopeInsert,
  TeamMemberWithScopes,
  TeamInviteWithInviter,
} from '../lib/types/database';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// Query keys
export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  membersList: (workspaceId?: string) => [...teamKeys.members(), workspaceId || 'default'] as const,
  invites: () => [...teamKeys.all, 'invites'] as const,
  invitesList: (workspaceId?: string) => [...teamKeys.invites(), workspaceId || 'default'] as const,
  inviteByToken: (token: string) => [...teamKeys.invites(), 'token', token] as const,
  scopes: (memberId: string) => [...teamKeys.members(), memberId, 'scopes'] as const,
};

/**
 * Hook to fetch team members for a workspace
 */
export function useTeamMembers(workspaceId?: string) {
  return useQuery({
    queryKey: teamKeys.membersList(workspaceId),
    queryFn: async () => {
      const result = await teamApi.getTeamMembers(workspaceId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch team invites for a workspace
 */
export function useTeamInvites(workspaceId?: string) {
  return useQuery({
    queryKey: teamKeys.invitesList(workspaceId),
    queryFn: async () => {
      const result = await teamApi.getTeamInvites(workspaceId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a team invite by token (for public invite acceptance page)
 */
export function useTeamInviteByToken(token: string, enabled: boolean = true) {
  return useQuery({
    queryKey: teamKeys.inviteByToken(token),
    queryFn: async () => {
      const result = await teamApi.getTeamInviteByToken(token);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: enabled && !!token,
    staleTime: 1 * 60 * 1000, // 1 minute (shorter for public pages)
  });
}

/**
 * Hook to create a team invite
 */
export function useCreateTeamInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      email,
      role,
      scopes,
      message,
    }: {
      workspaceId: string;
      email: string;
      role: TeamMember['role'];
      scopes: Array<{ scope_type: MemberScope['scope_type']; scope_value: string }>;
      message?: string | null;
    }) => {
      const result = await teamApi.createTeamInvite(workspaceId, email, role, scopes, message);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate invites list
      queryClient.invalidateQueries({ queryKey: teamKeys.invitesList(variables.workspaceId) });
      toast.success('Invite sent successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invite: ${error.message}`);
    },
  });
}

/**
 * Hook to accept a team invite
 */
export function useAcceptTeamInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const result = await teamApi.acceptTeamInvite(token);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: async (data, token) => {
      if (data) {
        // Invalidate team members list
        queryClient.invalidateQueries({ queryKey: teamKeys.membersList(data.workspace_id) });
        // Invalidate invites list
        queryClient.invalidateQueries({ queryKey: teamKeys.invitesList(data.workspace_id) });
        // Invalidate invite by token
        queryClient.invalidateQueries({ queryKey: teamKeys.inviteByToken(token) });
      }
      toast.success('Invite accepted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to accept invite: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a team member
 */
export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, workspaceId }: { memberId: string; workspaceId: string }) => {
      const result = await teamApi.deleteTeamMember(memberId);
      if (result.error) {
        throw result.error;
      }
      return { memberId, workspaceId };
    },
    onSuccess: (data) => {
      // Invalidate team members list
      queryClient.invalidateQueries({ queryKey: teamKeys.membersList(data.workspaceId) });
      toast.success('Team member removed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove team member: ${error.message}`);
    },
  });
}

/**
 * Hook to update team member role
 */
export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      role,
      workspaceId,
    }: {
      memberId: string;
      role: TeamMember['role'];
      workspaceId: string;
    }) => {
      const result = await teamApi.updateTeamMemberRole(memberId, role);
      if (result.error) {
        throw result.error;
      }
      return { data: result.data, workspaceId };
    },
    onSuccess: (data) => {
      // Invalidate team members list
      queryClient.invalidateQueries({ queryKey: teamKeys.membersList(data.workspaceId) });
      toast.success('Team member role updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update team member role: ${error.message}`);
    },
  });
}

/**
 * Hook to revoke a team invite
 */
export function useRevokeTeamInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteId, workspaceId }: { inviteId: string; workspaceId: string }) => {
      const result = await teamApi.revokeTeamInvite(inviteId);
      if (result.error) {
        throw result.error;
      }
      return { inviteId, workspaceId };
    },
    onSuccess: (data) => {
      // Invalidate invites list
      queryClient.invalidateQueries({ queryKey: teamKeys.invitesList(data.workspaceId) });
      toast.success('Invite revoked successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke invite: ${error.message}`);
    },
  });
}

/**
 * Hook to get member scopes
 */
export function useMemberScopes(memberId: string) {
  return useQuery({
    queryKey: teamKeys.scopes(memberId),
    queryFn: async () => {
      const result = await teamApi.getMemberScopes(memberId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to add a scope to a team member
 */
export function useAddMemberScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scope, memberId }: { scope: MemberScopeInsert; memberId: string }) => {
      const result = await teamApi.addMemberScope(scope);
      if (result.error) {
        throw result.error;
      }
      return { data: result.data, memberId };
    },
    onSuccess: (data) => {
      // Invalidate member scopes
      queryClient.invalidateQueries({ queryKey: teamKeys.scopes(data.memberId) });
      toast.success('Scope added successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add scope: ${error.message}`);
    },
  });
}

/**
 * Hook to remove a scope from a team member
 */
export function useRemoveMemberScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scopeId, memberId }: { scopeId: string; memberId: string }) => {
      const result = await teamApi.removeMemberScope(scopeId);
      if (result.error) {
        throw result.error;
      }
      return { scopeId, memberId };
    },
    onSuccess: (data) => {
      // Invalidate member scopes
      queryClient.invalidateQueries({ queryKey: teamKeys.scopes(data.memberId) });
      toast.success('Scope removed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove scope: ${error.message}`);
    },
  });
}

/**
 * Get current user's workspace ID (for now, this is the user's ID)
 */
export function useCurrentWorkspaceId() {
  return useQuery({
    queryKey: ['workspace', 'current'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }
      return user.id; // For now, workspace_id = user_id
    },
    staleTime: Infinity, // Workspace ID doesn't change
  });
}


