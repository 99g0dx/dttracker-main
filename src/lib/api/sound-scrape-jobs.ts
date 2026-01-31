import { supabase } from '../supabase';
import type { ApiResponse, ApiListResponse } from '../types/database';

export interface SoundScrapeJob {
  id: string;
  sound_track_id: string;
  workspace_id: string;
  provider: 'apify';
  status: 'queued' | 'running' | 'success' | 'failed';
  input: Record<string, any>;
  run_id: string | null;
  dataset_id: string | null;
  error: string | null;
  error_details: Record<string, any> | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoundTrackVideo {
  id: string;
  sound_track_id: string;
  workspace_id: string;
  video_id: string;
  video_url: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  creator_handle: string | null;
  creator_platform_id: string | null;
  creator_name: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  posted_at: string | null;
  scraped_at: string;
}

export interface SoundTrackStats {
  id: string;
  sound_track_id: string;
  workspace_id: string;
  total_uses: number;
  total_videos: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  top_video_views: number;
  top_video_likes: number;
  scraped_at: string;
}

/**
 * Get scrape job status for a sound track
 */
export async function getScrapeJob(
  workspaceId: string,
  soundTrackId: string
): Promise<ApiResponse<SoundScrapeJob | null>> {
  try {
    const { data: job, error } = await supabase
      .from('sound_scrape_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('sound_track_id', soundTrackId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data: job, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get videos for a sound track (from scrape results)
 */
export async function getSoundTrackVideos(
  workspaceId: string,
  soundTrackId: string,
  limit = 50,
  sortBy: 'views' | 'recent' = 'views'
): Promise<ApiListResponse<SoundTrackVideo>> {
  try {
    let query = supabase
      .from('sound_track_videos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('sound_track_id', soundTrackId)
      .limit(limit);

    if (sortBy === 'views') {
      query = query.order('views', { ascending: false });
    } else {
      query = query.order('posted_at', { ascending: false, nullsFirst: false });
    }

    const { data: videos, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: videos || [], error: null };
  } catch (error) {
    return { data: [], error: null }; // Non-blocking
  }
}

/**
 * Get stats for a sound track
 */
export async function getSoundTrackStats(
  workspaceId: string,
  soundTrackId: string
): Promise<ApiResponse<SoundTrackStats | null>> {
  try {
    const { data: stats, error } = await supabase
      .from('sound_track_stats')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('sound_track_id', soundTrackId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data: stats, error: null };
  } catch (error) {
    return { data: null, error: null }; // Non-blocking
  }
}

/**
 * Start a new scrape job for a sound track
 */
export async function startScrape(
  workspaceId: string,
  soundTrackId: string,
  soundUrl: string,
  maxItems = 200
): Promise<ApiResponse<{ jobId: string; runId: string }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return { data: null, error: new Error('Missing anon key') };
    }

    const { data, error } = await supabase.functions.invoke('soundtrack_start_scrape', {
      body: { soundTrackId, workspaceId, soundUrl, maxItems },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return { data: { jobId: data.jobId, runId: data.runId }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
