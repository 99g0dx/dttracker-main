import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as soundTracksApi from '../lib/api/sound-tracks';
import type { SoundTrack, SoundTrackWithStats, SoundTrackSnapshot, SoundTrackPost } from '../lib/api/sound-tracks';

export const soundTracksKeys = {
  all: ['sound-tracks'] as const,
  lists: () => [...soundTracksKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...soundTracksKeys.lists(), workspaceId] as const,
  details: () => [...soundTracksKeys.all, 'detail'] as const,
  detail: (workspaceId: string, soundTrackId: string) => [...soundTracksKeys.details(), workspaceId, soundTrackId] as const,
  snapshots: (workspaceId: string, soundTrackId: string) => [...soundTracksKeys.all, 'snapshots', workspaceId, soundTrackId] as const,
  posts: (workspaceId: string, soundTrackId: string, mode: 'top' | 'recent') => [...soundTracksKeys.all, 'posts', workspaceId, soundTrackId, mode] as const,
};

/**
 * Hook to list all sound tracks for a workspace
 */
export function useSoundTracks(workspaceId: string | null) {
  return useQuery({
    queryKey: soundTracksKeys.list(workspaceId || ''),
    queryFn: async () => {
      if (!workspaceId) return [];
      const result = await soundTracksApi.list(workspaceId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get a single sound track
 */
export function useSoundTrack(workspaceId: string | null, soundTrackId: string | null) {
  return useQuery({
    queryKey: soundTracksKeys.detail(workspaceId || '', soundTrackId || ''),
    queryFn: async () => {
      if (!workspaceId || !soundTrackId) return null;
      const result = await soundTracksApi.getById(workspaceId, soundTrackId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!workspaceId && !!soundTrackId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to get snapshots for a sound track
 */
export function useSoundTrackSnapshots(workspaceId: string | null, soundTrackId: string | null) {
  return useQuery({
    queryKey: soundTracksKeys.snapshots(workspaceId || '', soundTrackId || ''),
    queryFn: async () => {
      if (!workspaceId || !soundTrackId) return [];
      const result = await soundTracksApi.getSnapshots(workspaceId, soundTrackId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!workspaceId && !!soundTrackId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get posts for a sound track
 */
export function useSoundTrackPosts(
  workspaceId: string | null,
  soundTrackId: string | null,
  mode: 'top' | 'recent' = 'top'
) {
  return useQuery({
    queryKey: soundTracksKeys.posts(workspaceId || '', soundTrackId || '', mode),
    queryFn: async () => {
      if (!workspaceId || !soundTrackId) return [];
      const result = await soundTracksApi.getPosts(workspaceId, soundTrackId, mode);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!workspaceId && !!soundTrackId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to create a sound track from a URL
 */
export function useCreateSoundTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, url }: { workspaceId: string; url: string }) => {
      const result = await soundTracksApi.createFromLink(workspaceId, url);
      if (result.error) throw result.error;
      return result.data!;
    },
    retry: 0, // Disable retries to prevent quota issues
    retryDelay: 0,
    onSuccess: (data, variables) => {
      // Invalidate the specific workspace list
      queryClient.invalidateQueries({ queryKey: soundTracksKeys.list(variables.workspaceId) });
      // Also invalidate all lists to be safe
      queryClient.invalidateQueries({ queryKey: soundTracksKeys.lists() });
      toast.success('Sound track created successfully');
    },
    onError: (error: Error) => {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('quota exceeded') || errorMessage.includes('bigquery')) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        toast.error(`Failed to create sound track: ${error.message}`);
      }
    },
  });
}

/**
 * Hook to refresh a sound track
 */
export function useRefreshSoundTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, soundTrackId }: { workspaceId: string; soundTrackId: string }) => {
      const result = await soundTracksApi.refreshSound(workspaceId, soundTrackId);
      if (result.error) throw result.error;
      return result.data!;
    },
    retry: 0, // Disable retries to prevent quota issues
    retryDelay: 0,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: soundTracksKeys.detail(variables.workspaceId, variables.soundTrackId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: soundTracksKeys.snapshots(variables.workspaceId, variables.soundTrackId) 
      });
      toast.success('Sound refresh started');
    },
    onError: (error: Error) => {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('quota exceeded') || errorMessage.includes('bigquery')) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        toast.error(`Failed to refresh sound: ${error.message}`);
      }
    },
  });
}
