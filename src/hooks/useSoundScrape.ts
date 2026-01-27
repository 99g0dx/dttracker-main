import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as scrapeApi from '../lib/api/sound-scrape-jobs';
import type { SoundScrapeJob, SoundTrackVideo, SoundTrackStats } from '../lib/api/sound-scrape-jobs';

export const soundScrapeKeys = {
  all: ['sound-scrape'] as const,
  job: (workspaceId: string, soundTrackId: string) => [...soundScrapeKeys.all, 'job', workspaceId, soundTrackId] as const,
  videos: (workspaceId: string, soundTrackId: string, sortBy: string) => [...soundScrapeKeys.all, 'videos', workspaceId, soundTrackId, sortBy] as const,
  stats: (workspaceId: string, soundTrackId: string) => [...soundScrapeKeys.all, 'stats', workspaceId, soundTrackId] as const,
};

/**
 * Hook to get scrape job status
 */
export function useScrapeJob(workspaceId: string | null, soundTrackId: string | null) {
  return useQuery({
    queryKey: soundScrapeKeys.job(workspaceId || '', soundTrackId || ''),
    queryFn: async () => {
      if (!workspaceId || !soundTrackId) return null;
      const result = await scrapeApi.getScrapeJob(workspaceId, soundTrackId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!workspaceId && !!soundTrackId,
    refetchInterval: (query) => {
      const job = query.state.data as SoundScrapeJob | null;
      // Poll every 3 seconds if job is running or queued, every 10 seconds if no job but sound exists (might be starting)
      // Stop polling if job is completed or failed
      if (job?.status === 'running' || job?.status === 'queued') {
        return 3000; // Poll every 3 seconds when actively scraping
      }
      if (job?.status === 'success' || job?.status === 'failed') {
        return false; // Stop polling when done
      }
      // If no job yet but sound exists, poll every 10 seconds to catch when job is created
      return 10000;
    },
  });
}

/**
 * Hook to get videos from scrape results
 */
export function useSoundTrackVideos(
  workspaceId: string | null,
  soundTrackId: string | null,
  sortBy: 'views' | 'recent' = 'views',
  limit = 50
) {
  return useQuery({
    queryKey: soundScrapeKeys.videos(workspaceId || '', soundTrackId || '', sortBy),
    queryFn: async () => {
      if (!workspaceId || !soundTrackId) return [];
      const result = await scrapeApi.getSoundTrackVideos(workspaceId, soundTrackId, limit, sortBy);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!workspaceId && !!soundTrackId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    // Poll more aggressively when no videos yet (might be scraping)
    refetchInterval: (query) => {
      const videos = query.state.data || [];
      // If no videos yet, poll every 10 seconds (might be scraping)
      // Once videos exist, stop polling (they'll update via webhook)
      return videos.length === 0 ? 10000 : false;
    },
  });
}

/**
 * Hook to get stats from scrape results
 */
export function useSoundTrackStats(workspaceId: string | null, soundTrackId: string | null) {
  return useQuery({
    queryKey: soundScrapeKeys.stats(workspaceId || '', soundTrackId || ''),
    queryFn: async () => {
      if (!workspaceId || !soundTrackId) return null;
      const result = await scrapeApi.getSoundTrackStats(workspaceId, soundTrackId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!workspaceId && !!soundTrackId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to start a new scrape
 */
export function useStartScrape() {
  const queryClient = useQueryClient();

  return {
    mutateAsync: async ({
      workspaceId,
      soundTrackId,
      soundUrl,
      maxItems = 200,
    }: {
      workspaceId: string;
      soundTrackId: string;
      soundUrl: string;
      maxItems?: number;
    }) => {
      const result = await scrapeApi.startScrape(workspaceId, soundTrackId, soundUrl, maxItems);
      if (result.error) throw result.error;

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: soundScrapeKeys.job(workspaceId, soundTrackId) });
      queryClient.invalidateQueries({ queryKey: soundScrapeKeys.stats(workspaceId, soundTrackId) });

      toast.success('Scraping started! Results will appear when ready.');
      return result.data!;
    },
  };
}
