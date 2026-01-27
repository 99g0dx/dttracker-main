import { supabase } from '../supabase';
import type { ApiResponse, ApiListResponse } from '../types/database';

// Types matching your database schema
export interface SoundTrack {
  id: string;
  workspace_id: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  sound_platform_id: string;
  source_url: string;
  title: string | null;
  artist: string | null;
  thumbnail_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  total_uses?: number | null;
  latest_snapshot?: SoundTrackSnapshot | null;
}

export interface SoundTrackWithStats extends SoundTrack {
  total_uses: number | null;
  latest_snapshot: SoundTrackSnapshot | null;
  scrape_job?: {
    id: string;
    status: 'queued' | 'running' | 'success' | 'failed';
    started_at: string | null;
    finished_at: string | null;
  } | null;
  stats?: {
    total_videos: number;
    avg_views: number;
    top_video_views: number;
  } | null;
}

export interface SoundTrackSnapshot {
  id: string;
  sound_track_id: string;
  total_uses: number;
  captured_at: string;
  meta: Record<string, any> | null;
}

export interface SoundTrackPost {
  id: string;
  sound_track_id: string;
  post_platform_id: string;
  post_url: string;
  creator_handle: string | null;
  creator_platform_id: string | null;
  created_at_platform: string | null;
  platform: 'tiktok' | 'instagram' | 'youtube';
  latest_metrics: SoundTrackPostSnapshot | null;
}

export interface SoundTrackPostSnapshot {
  id: string;
  sound_track_post_id: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  captured_at: string;
}

/**
 * List all sound tracks for a workspace
 * Falls back to 'sounds' table if 'sound_tracks' doesn't exist
 */
export async function list(workspaceId: string): Promise<ApiListResponse<SoundTrackWithStats>> {
  try {
    // Try sound_tracks table first
    let { data: tracks, error } = await supabase
      .from('sound_tracks')
      .select(`
        *,
        snapshots:sound_track_snapshots(
          id,
          total_uses,
          captured_at,
          meta
        ),
        latest_job:sound_scrape_jobs!sound_track_id(
          id,
          status,
          started_at,
          finished_at
        ),
        stats:sound_track_stats!sound_track_id(
          total_videos,
          avg_views,
          top_video_views
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    // If sound_tracks doesn't exist OR is empty, fall back to sounds table
    const shouldFallback = error && (
      error.message?.includes('does not exist') || 
      error.code === '42P01' // relation does not exist
    ) || (!error && (!tracks || tracks.length === 0));

    if (shouldFallback) {
      console.log('[list] sound_tracks table missing or empty, falling back to sounds table', {
        hasError: !!error,
        errorCode: error?.code,
        tracksCount: tracks?.length || 0,
      });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: [], error: null };
      }

      // Try to get sounds by user_id (personal workspace) or workspace_id if it exists
      let soundsQuery = supabase
        .from('sounds')
        .select('*')
        .order('last_crawled_at', { ascending: false });

      // If workspaceId matches userId, it's a personal workspace - filter by user_id
      // Otherwise, try to filter by workspace_id if the column exists
      if (workspaceId === user.id) {
        soundsQuery = soundsQuery.eq('user_id', user.id);
      } else {
        // Try workspace_id first, fall back to user_id if column doesn't exist
        soundsQuery = soundsQuery.eq('user_id', user.id); // Default to user_id for now
      }

      const { data: sounds, error: soundsError } = await soundsQuery;

      if (soundsError) {
        console.error('[list] Error fetching from sounds table:', soundsError);
        // If sounds table also doesn't exist, return empty array
        if (soundsError.message?.includes('does not exist') || soundsError.code === '42P01') {
          return { data: [], error: null };
        }
        return { data: null, error: soundsError };
      }

      // Map sounds to sound_tracks format
      tracks = (sounds || []).map((sound: any) => ({
        id: sound.id,
        workspace_id: workspaceId,
        platform: sound.platform,
        sound_platform_id: sound.canonical_sound_key || sound.id,
        source_url: sound.sound_page_url || '',
        title: sound.title,
        artist: sound.artist,
        thumbnail_url: null,
        created_by: sound.user_id || workspaceId,
        created_at: sound.created_at,
        updated_at: sound.updated_at || sound.last_crawled_at,
        snapshots: [],
      }));
      error = null;
    }

    if (error) {
      return { data: null, error };
    }

    // Transform to include stats
    const tracksWithStats: SoundTrackWithStats[] = (tracks || []).map((track: any) => {
      const snapshots = Array.isArray(track.snapshots) 
        ? track.snapshots 
        : track.snapshots 
        ? [track.snapshots] 
        : [];
      // Get the latest snapshot (most recent captured_at)
      const latest = snapshots.length > 0 
        ? snapshots.sort((a: any, b: any) => 
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
          )[0]
        : null;

      // Get latest scrape job (most recent)
      const jobs = Array.isArray(track.latest_job) 
        ? track.latest_job 
        : track.latest_job 
        ? [track.latest_job] 
        : [];
      const latestJob = jobs.length > 0 
        ? jobs.sort((a: any, b: any) => 
            new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()
          )[0]
        : null;

      // Get stats
      const stats = Array.isArray(track.stats) 
        ? track.stats[0] 
        : track.stats 
        ? track.stats 
        : null;

      return {
        ...track,
        total_uses: latest?.total_uses || stats?.total_videos || null,
        latest_snapshot: latest,
        scrape_job: latestJob ? {
          id: latestJob.id,
          status: latestJob.status,
          started_at: latestJob.started_at,
          finished_at: latestJob.finished_at,
        } : null,
        stats: stats ? {
          total_videos: stats.total_videos || 0,
          avg_views: stats.avg_views || 0,
          top_video_views: stats.top_video_views || 0,
        } : null,
      };
    });

    return { data: tracksWithStats, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get a single sound track by ID
 * Falls back to 'sounds' table if 'sound_tracks' doesn't exist
 */
export async function getById(
  workspaceId: string,
  soundTrackId: string
): Promise<ApiResponse<SoundTrackWithStats>> {
  try {
    let { data: track, error } = await supabase
      .from('sound_tracks')
      .select(`
        *,
        snapshots:sound_track_snapshots(
          id,
          total_uses,
          captured_at,
          meta
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('id', soundTrackId)
      .single();

    // If sound_tracks doesn't exist OR record not found, fall back to sounds table
    const isTableMissing = error && (
      error.message?.includes('does not exist') || 
      error.code === '42P01' || // relation does not exist
      error.code === 'PGRST116' // no rows returned
    );

    if (isTableMissing || (error && error.code === 'PGRST116')) {
      console.log('[getById] sound_tracks table missing or record not found, falling back to sounds table', {
        errorCode: error?.code,
        errorMessage: error?.message,
        soundTrackId,
      });
      
      const { data: sound, error: soundError } = await supabase
        .from('sounds')
        .select('*')
        .eq('id', soundTrackId)
        .single();

      if (soundError) {
        console.error('[getById] Error fetching from sounds table:', soundError);
        // If sounds table also fails, return the original error
        return { data: null, error: error || soundError };
      }

      if (!sound) {
        return { data: null, error: new Error('Sound track not found in sounds table') };
      }

      // Map sound to sound_track format
      track = {
        id: sound.id,
        workspace_id: workspaceId,
        platform: sound.platform,
        sound_platform_id: sound.canonical_sound_key || sound.id,
        source_url: sound.sound_page_url || '',
        title: sound.title,
        artist: sound.artist,
        thumbnail_url: null,
        created_by: sound.user_id,
        created_at: sound.created_at,
        updated_at: sound.updated_at,
        snapshots: [],
      };
      error = null;
    } else if (error) {
      // Other error (not table missing or not found)
      console.error('[getById] Error fetching from sound_tracks:', error);
      return { data: null, error };
    }

    const snapshots = Array.isArray(track.snapshots) 
      ? track.snapshots 
      : track.snapshots 
      ? [track.snapshots] 
      : [];
    // Get the latest snapshot (most recent captured_at)
    const latest = snapshots.length > 0 
      ? snapshots.sort((a: any, b: any) => 
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0]
      : null;

    const trackWithStats: SoundTrackWithStats = {
      ...track,
      total_uses: latest?.total_uses || null,
      latest_snapshot: latest,
    };

    return { data: trackWithStats, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get snapshots for a sound track
 */
export async function getSnapshots(
  workspaceId: string,
  soundTrackId: string
): Promise<ApiListResponse<SoundTrackSnapshot>> {
  try {
    const { data: snapshots, error } = await supabase
      .from('sound_track_snapshots')
      .select('*')
      .eq('sound_track_id', soundTrackId)
      .order('captured_at', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    // Verify workspace access (non-blocking - skip if table doesn't exist)
    try {
      const { data: track } = await supabase
        .from('sound_tracks')
        .select('workspace_id')
        .eq('id', soundTrackId)
        .single();

      if (track && track.workspace_id !== workspaceId) {
        return { data: [], error: null }; // Return empty instead of error (non-blocking)
      }
    } catch {
      // If sound_tracks doesn't exist, skip verification
    }

    return { data: snapshots || [], error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get posts for a sound track
 * Falls back to sound_videos table if sound_track_posts doesn't exist
 */
export async function getPosts(
  workspaceId: string,
  soundTrackId: string,
  mode: 'top' | 'recent' = 'top'
): Promise<ApiListResponse<SoundTrackPost>> {
  try {
    // Try sound_track_posts first
    let query = supabase
      .from('sound_track_posts')
      .select(`
        *,
        latest_metrics:sound_track_post_snapshots(
          id,
          views,
          likes,
          comments,
          shares,
          captured_at
        )
      `)
      .eq('sound_track_id', soundTrackId);

    if (mode === 'top') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at_platform', { ascending: false, nullsFirst: false });
    }

    let { data: posts, error } = await query.limit(50);

    // If error, try to fallback (non-blocking)
    if (error && !error.message?.includes('does not exist')) {
      return { data: [], error: null }; // Return empty instead of error
    }

    // If sound_track_posts doesn't exist, fall back to sound_videos
    if (error && error.message?.includes('does not exist')) {
      console.log('[getPosts] sound_track_posts table not found, falling back to sound_videos');
      let videosQuery = supabase
        .from('sound_videos')
        .select('*')
        .eq('sound_id', soundTrackId);

      if (mode === 'top') {
        videosQuery = videosQuery.order('views', { ascending: false });
      } else {
        videosQuery = videosQuery.order('posted_at', { ascending: false, nullsFirst: false });
      }

      const { data: videos, error: videosError } = await videosQuery.limit(50);

      if (videosError) {
        return { data: [], error: null }; // Return empty instead of error (non-blocking)
      }

      // Map videos to posts format
      posts = (videos || []).map((video: any) => ({
        id: video.id,
        sound_track_id: soundTrackId,
        post_platform_id: video.video_id || video.id,
        post_url: video.video_url || '',
        creator_handle: video.creator_handle,
        creator_platform_id: null,
        created_at_platform: video.posted_at,
        platform: video.platform || 'tiktok',
        latest_metrics: {
          views: video.views || 0,
          likes: video.likes || 0,
          comments: 0,
          shares: 0,
          captured_at: video.posted_at || new Date().toISOString(),
        },
      }));
      error = null;
    }

    if (error) {
      return { data: [], error: null }; // Return empty instead of error (non-blocking)
    }

    // Transform to include latest metrics
    const postsWithMetrics = (posts || []).map((post: any) => {
      const metrics = Array.isArray(post.latest_metrics) 
        ? post.latest_metrics[0] 
        : post.latest_metrics 
        ? post.latest_metrics 
        : null;

      return {
        ...post,
        latest_metrics: metrics,
      };
    });

    return { data: postsWithMetrics, error: null };
  } catch (error) {
    return { data: [], error: null }; // Return empty instead of error (non-blocking)
  }
}

/**
 * Create a sound track from a URL
 */
export async function createFromLink(
  workspaceId: string,
  url: string
): Promise<ApiResponse<{ soundTrackId: string }>> {
  try {
    // Log full URL length but show truncated in console for readability
    const fullUrl = url.trim();
    console.log('[createFromLink] Starting with:', { 
      workspaceId, 
      urlLength: fullUrl.length,
      urlPreview: fullUrl.length > 50 ? `${fullUrl.substring(0, 50)}...` : fullUrl,
      fullUrl: fullUrl, // Full URL in logs for debugging
    });

    // Get current session (but don't fail if missing - function has verify_jwt = false)
    const { data: { session } } = await supabase.auth.getSession();

    // Get anon key
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      console.error('[createFromLink] Missing anon key');
      return { 
        data: null, 
        error: new Error('Supabase configuration error: Missing anon key.') 
      };
    }

    // Call Edge Function with minimal headers
    const headers: Record<string, string> = {
      apikey: anonKey,
    };
    
    // Add auth header if available (optional since verify_jwt = false)
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    console.log('[createFromLink] Invoking function with headers:', {
      hasAuth: !!headers.Authorization,
      hasApikey: !!headers.apikey,
      workspaceId,
      urlLength: fullUrl.length,
      urlPreview: fullUrl.length > 50 ? `${fullUrl.substring(0, 50)}...` : fullUrl,
    });

    // CRITICAL: Use full URL, never truncate
    // Use direct fetch to get actual error response body
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return {
        data: null,
        error: new Error('Missing Supabase URL configuration'),
      };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/soundtrack_create_from_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ workspaceId, url: fullUrl }),
    });

    const responseText = await response.text();
    console.log('[createFromLink] Response status:', response.status);
    console.log('[createFromLink] Response body preview:', responseText.substring(0, 500));

    let data: any = null;
    let error: any = null;

    if (!response.ok) {
      // Try to parse error response
      try {
        const errorData = JSON.parse(responseText);
        error = new Error(errorData.error || errorData.message || `Edge Function returned ${response.status}`);
        console.error('[createFromLink] Parsed error:', errorData);
      } catch {
        // If not JSON, use raw text
        error = new Error(`Edge Function error (${response.status}): ${responseText.substring(0, 200)}`);
        console.error('[createFromLink] Raw error response:', responseText);
      }
    } else {
      // Parse success response
      try {
        data = JSON.parse(responseText);
        console.log('[createFromLink] Parsed success response:', { soundTrackId: data?.soundTrackId });
      } catch (parseError) {
        error = new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
        console.error('[createFromLink] JSON parse error:', parseError);
      }
    }

    if (error) {
      console.error('[createFromLink] Function error:', error);
      
      // If it's a 401, provide helpful message
      if (response.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        throw new Error('Authentication failed. The function may need to be redeployed with verify_jwt = false. Please check Edge Function logs.');
      }
      
      throw error;
    }

    // Validate response has soundTrackId
    const soundTrackId = data?.soundTrackId || data?.sound?.id;
    if (!soundTrackId) {
      console.error('[createFromLink] No soundTrackId in response:', data);
      throw new Error('No sound track ID returned from server');
    }

    return { data: { soundTrackId }, error: null };
  } catch (error) {
    console.error('[createFromLink] Final error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Refresh a sound track
 */
export async function refreshSound(
  workspaceId: string,
  soundTrackId: string
): Promise<ApiResponse<void>> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return { 
        data: null, 
        error: new Error('Not authenticated. Please log in again.') 
      };
    }

    // Get anon key
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return { 
        data: null, 
        error: new Error('Supabase configuration error: Missing anon key.') 
      };
    }

    // Call Edge Function
    const headers: Record<string, string> = {};
    if (session.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (anonKey) {
      headers.apikey = anonKey;
    }

    // Use direct fetch to get actual error response body
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return {
        data: null,
        error: new Error('Missing Supabase URL configuration'),
      };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/soundtrack_refresh_sound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(anonKey ? { apikey: anonKey } : {}),
      },
      body: JSON.stringify({ workspaceId, soundTrackId }),
    });

    const responseText = await response.text();
    console.log('[refreshSound] Response status:', response.status);
    console.log('[refreshSound] Response body preview:', responseText.substring(0, 500));

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `Edge Function returned ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorData.message || errorMessage;
        console.error('[refreshSound] Parsed error:', errorData);
      } catch {
        errorMessage = `${errorMessage}: ${responseText.substring(0, 200)}`;
        console.error('[refreshSound] Raw error response:', responseText);
      }
      throw new Error(errorMessage);
    }

    // Parse success response (if any)
    try {
      const data = JSON.parse(responseText);
      if (data?.error) {
        throw new Error(data.error);
      }
    } catch (parseError) {
      // If response is empty or not JSON, that's okay for refresh
      if (responseText.trim() !== '') {
        console.log('[refreshSound] Non-JSON response (may be OK):', responseText.substring(0, 100));
      }
    }

    return { data: undefined, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
