import { supabase } from "../supabase";
import type {
  Sound,
  SoundVideo,
  SoundWithVideos,
  ApiResponse,
  ApiListResponse,
} from "../types/database";

/**
 * Fetch all sounds for the current user
 */
export async function list(): Promise<ApiListResponse<SoundWithVideos>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: sounds, error } = await supabase
      .from("sounds")
      .select(
        `
        *,
        videos:sound_videos(*)
      `,
      )
      .eq("user_id", user.id)
      .order("last_crawled_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    // Transform to include computed stats
    const soundsWithStats: SoundWithVideos[] = (sounds || []).map(
      (sound: any) => {
        const videos = sound.videos || [];
        return {
          ...sound,
          videos,
          videos_count: videos.length,
          total_views: videos.reduce(
            (sum: number, v: SoundVideo) => sum + v.views,
            0,
          ),
          top_video_views: Math.max(
            ...videos.map((v: SoundVideo) => v.views),
            0,
          ),
        };
      },
    );

    return { data: soundsWithStats, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get a single sound with videos
 */
export async function getById(
  soundId: string,
): Promise<ApiResponse<SoundWithVideos>> {
  try {
    const { data: sound, error } = await supabase
      .from("sounds")
      .select(
        `
        *,
        videos:sound_videos(*)
      `,
      )
      .eq("id", soundId)
      .single();

    if (error) {
      return { data: null, error };
    }

    const videos = sound.videos || [];
    const soundWithStats: SoundWithVideos = {
      ...sound,
      videos,
      videos_count: videos.length,
      total_views: videos.reduce(
        (sum: number, v: SoundVideo) => sum + v.views,
        0,
      ),
      top_video_views: Math.max(...videos.map((v: SoundVideo) => v.views), 0),
    };

    return { data: soundWithStats, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get videos for a sound with sorting
 */
export async function getVideos(
  soundId: string,
  sortBy: "views" | "engagement" | "recent" = "views",
  limit = 50,
): Promise<ApiListResponse<SoundVideo>> {
  try {
    let query = supabase
      .from("sound_videos")
      .select("*")
      .eq("sound_id", soundId)
      .limit(limit);

    if (sortBy === "views") {
      query = query.order("views", { ascending: false });
    } else if (sortBy === "engagement") {
      query = query.order("engagement_rate", { ascending: false });
    } else if (sortBy === "recent") {
      query = query.order("posted_at", { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Delete a sound and all its videos
 */
export async function deleteSound(soundId: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.from("sounds").delete().eq("id", soundId);

    if (error) {
      return { data: null, error };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Link a sound to a campaign
 */
export async function linkToCampaign(
  campaignId: string,
  soundId: string,
  soundUrl?: string,
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from("campaigns")
      .update({
        sound_id: soundId,
        sound_url: soundUrl,
      })
      .eq("id", campaignId);

    if (error) {
      return { data: null, error };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Unlink sound from campaign
 */
export async function unlinkFromCampaign(
  campaignId: string,
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from("campaigns")
      .update({
        sound_id: null,
        sound_url: null,
      })
      .eq("id", campaignId);

    if (error) {
      return { data: null, error };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Trigger refresh of sound indexing
 */
export async function refreshSound(
  soundId: string,
): Promise<ApiResponse<Sound>> {
  try {
    // Get current session to ensure we have a valid auth token
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return {
        data: null,
        error: new Error("Not authenticated. Please log in again."),
      };
    }

    // Explicitly pass Authorization and apikey headers
    const headers: Record<string, string> = {};
    if (session.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    // Include apikey header (Supabase anon key) for edge function authentication
    // The Supabase client should handle this automatically, but we include it explicitly
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    if (anonKey) {
      headers.apikey = anonKey;
    }

    const { data, error } = await supabase.functions.invoke("sound-tracking", {
      body: { action: "refresh", sound_id: soundId },
      headers,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return { data: data.sound, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
