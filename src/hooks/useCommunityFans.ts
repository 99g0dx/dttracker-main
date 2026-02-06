import Papa from 'papaparse';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../contexts/WorkspaceContext';
import * as communityFansApi from '../lib/api/community-fans';
import type { CommunityFan, FanStats, ImportResult } from '../lib/api/community-fans';

export const communityFansKeys = {
  all: ['community_fans'] as const,
  lists: () => [...communityFansKeys.all, 'list'] as const,
  list: (workspaceId: string, filters?: { platform?: string; search?: string }) =>
    [...communityFansKeys.lists(), workspaceId, filters] as const,
  stats: (workspaceId: string) => [...communityFansKeys.all, 'stats', workspaceId] as const,
};

/**
 * Hook to fetch community fans for a workspace
 */
export function useCommunityFans(filters?: { platform?: string; search?: string }) {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: communityFansKeys.list(activeWorkspaceId || '', filters),
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      try {
        const result = await communityFansApi.listFans(activeWorkspaceId, filters);
        if (result.error) {
          // If table doesn't exist yet, return empty array instead of throwing
          if (result.error.message?.includes('does not exist') || 
              result.error.message?.includes('relation') ||
              result.error.message?.includes('permission denied')) {
            if (import.meta.env.DEV) {
              console.warn('community_fans table not found, returning empty array');
            }
            return [];
          }
          // For other errors, still return empty array to prevent crashes
          if (import.meta.env.DEV) {
            console.warn('Community fans query error:', result.error);
          }
          return [];
        }
        return result.data || [];
      } catch (error: any) {
        // Handle all errors gracefully - return empty array instead of throwing
        if (import.meta.env.DEV) {
          console.warn('Community fans query exception:', error);
        }
        return [];
      }
    },
    enabled: !!activeWorkspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: false, // Don't retry if table doesn't exist
  });
}

/**
 * Hook to fetch fan statistics
 */
export function useFanStats() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: communityFansKeys.stats(activeWorkspaceId || ''),
    queryFn: async () => {
      if (!activeWorkspaceId) return null;
      try {
        const result = await communityFansApi.getFanStats(activeWorkspaceId);
        if (result.error) {
          // If table doesn't exist yet, return null instead of throwing
          if (result.error.message?.includes('does not exist') || 
              result.error.message?.includes('relation') ||
              result.error.message?.includes('permission denied')) {
            if (import.meta.env.DEV) {
              console.warn('community_fans table not found, returning null');
            }
            return null;
          }
          // For other errors, still return null to prevent crashes
          if (import.meta.env.DEV) {
            console.warn('Fan stats query error:', result.error);
          }
          return null;
        }
        return result.data;
      } catch (error: any) {
        // Handle all errors gracefully - return null instead of throwing
        if (import.meta.env.DEV) {
          console.warn('Fan stats query exception:', error);
        }
        return null;
      }
    },
    enabled: !!activeWorkspaceId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false, // Don't retry if table doesn't exist
  });
}

/**
 * Hook to import fans from CSV
 */
export function useImportFans() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!activeWorkspaceId) {
        throw new Error('Workspace ID required');
      }

      const result = await communityFansApi.importFans(file, activeWorkspaceId);

      if (result.error) {
        throw result.error;
      }

      return result.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: communityFansKeys.all });
    },
  });
}

/**
 * Hook to delete a fan
 */
export function useDeleteFan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fanId: string) => {
      const result = await communityFansApi.deleteFan(fanId);
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: communityFansKeys.all });
    },
  });
}

/**
 * Hook to match fans to creators
 */
export function useMatchFansToCreators() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId) {
        throw new Error('Workspace ID required');
      }

      const result = await communityFansApi.matchFansToCreators(activeWorkspaceId);
      if (result.error) {
        throw result.error;
      }

      return result.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: communityFansKeys.all });
    },
  });
}
