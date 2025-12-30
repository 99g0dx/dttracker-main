import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type {
  CampaignShareLink,
  CampaignShareLinkInsert,
  CampaignShareLinkUpdate,
  Campaign,
  PostWithCreator,
  TimeSeriesDataPoint,
  ApiResponse,
  ApiListResponse,
} from "../types/database";

// Create an unauthenticated client for public share links
// This ensures compatibility across all browsers without requiring auth state
const getUnauthenticatedClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Don't persist session for public access
      autoRefreshToken: false, // No auth needed
    },
  });
};

// Generate UUID v4 for share tokens
function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise generate manually
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: simple UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hash password using Web Crypto API
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify password against hash
 */
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate a share link for a campaign
 */
export async function generateShareLink(
  campaignId: string,
  isPasswordProtected: boolean,
  password?: string,
  expiresAt?: string | null
): Promise<ApiResponse<CampaignShareLink>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    // Delete any existing share links for this campaign (only one link allowed)
    const { error: deleteError } = await supabase
      .from("campaign_share_links")
      .delete()
      .eq("campaign_id", campaignId);

    if (deleteError) {
      console.warn("Error deleting existing share links:", deleteError);
      // Continue anyway - try to create the new link
    }

    // Generate share token
    const shareToken = generateUUID();

    // Hash password if provided
    let passwordHash: string | null = null;
    if (isPasswordProtected && password) {
      passwordHash = await hashPassword(password);
    }

    const shareLinkData: CampaignShareLinkInsert = {
      campaign_id: campaignId,
      share_token: shareToken,
      password_hash: passwordHash,
      is_password_protected: isPasswordProtected,
      created_by: user.id,
      expires_at: expiresAt || null,
    };

    const { data: shareLink, error } = await supabase
      .from("campaign_share_links")
      .insert(shareLinkData)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: shareLink, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get campaign data by share token (for public viewing)
 */
export async function getCampaignByShareToken(
  token: string,
  password?: string
): Promise<ApiResponse<{ campaign: Campaign; posts: PostWithCreator[]; chartData: TimeSeriesDataPoint[] }>> {
  try {
    // Use unauthenticated client for public share links (better browser compatibility)
    const publicClient = getUnauthenticatedClient();
    
    // Fetch share link
    const { data: shareLink, error: shareLinkError } = await publicClient
      .from("campaign_share_links")
      .select("*")
      .eq("share_token", token)
      .single();

    if (shareLinkError || !shareLink) {
      console.error("Share link fetch error:", shareLinkError);
      return { data: null, error: new Error("Invalid share link") };
    }

    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return { data: null, error: new Error("Share link has expired") };
    }

    // Check password if protected
    if (shareLink.is_password_protected) {
      if (!password) {
        return { data: null, error: new Error("Password required") };
      }
      if (!shareLink.password_hash) {
        return {
          data: null,
          error: new Error("Invalid share link configuration"),
        };
      }
      const isValidPassword = await verifyPassword(
        password,
        shareLink.password_hash
      );
      if (!isValidPassword) {
        return { data: null, error: new Error("Invalid password") };
      }
    }

    // Track access analytics (non-blocking, uses public client for browser compatibility)
    // This ensures no session/cookie conflicts across different browsers
    try {
      await publicClient
        .from("campaign_share_links")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", shareLink.id);
    } catch (updateError) {
      // Analytics failure is non-critical - silently ignore to avoid console noise
      // The RLS policy will reject this for anonymous users, which is expected
    }

    // Fetch campaign using public client
    const { data: campaign, error: campaignError } = await publicClient
      .from("campaigns")
      .select("*")
      .eq("id", shareLink.campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("❌ Campaign fetch failed for share link:", {
        shareToken: token.substring(0, 8) + "...",
        campaignId: shareLink.campaign_id,
        errorCode: campaignError?.code,
        errorMessage: campaignError?.message,
        errorDetails: campaignError?.details,
        errorHint: campaignError?.hint,
      });
      return {
        data: null,
        error: new Error(`Campaign not found: ${campaignError?.message || "Unknown error"}. This may be due to RLS policy restrictions.`)
      };
    }

    // Fetch posts for the campaign using public client
    const { data: posts, error: postsError } = await publicClient
      .from("posts")
      .select(
        `
        *,
        creator:creators(*)
      `
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("❌ Posts fetch failed for share link:", {
        shareToken: token.substring(0, 8) + "...",
        campaignId: campaign.id,
        errorCode: postsError?.code,
        errorMessage: postsError?.message,
        errorDetails: postsError?.details,
        errorHint: postsError?.hint,
      });
      return { data: null, error: postsError };
    }

    // Fetch time series data for charts
    const chartData = await getShareLinkTimeSeriesData(publicClient, campaign.id);

    return {
      data: {
        campaign: campaign as Campaign,
        posts: (posts || []) as PostWithCreator[],
        chartData: chartData || [],
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get time series data for share link charts (no auth required)
 */
async function getShareLinkTimeSeriesData(
  client: ReturnType<typeof getUnauthenticatedClient>,
  campaignId: string
): Promise<TimeSeriesDataPoint[]> {
  try {
    // Fetch metrics history from post_metrics table
    const { data: metricsHistory, error: historyError } = await client
      .from("post_metrics")
      .select(
        `
        views,
        likes,
        comments,
        shares,
        engagement_rate,
        scraped_at,
        posts!inner(campaign_id, platform)
      `
      )
      .eq("posts.campaign_id", campaignId)
      .in("posts.platform", ["tiktok", "instagram"])
      .order("scraped_at", { ascending: true });

    // Enhanced error logging for chart data failures
    if (historyError) {
      console.error("❌ Failed to fetch post_metrics for charts:", {
        campaignId: campaignId.substring(0, 8) + "...",
        errorCode: historyError?.code,
        errorMessage: historyError?.message,
        errorDetails: historyError?.details,
        errorHint: historyError?.hint,
        possibleCause: "RLS policy may be blocking access. Ensure fix_share_link_rls.sql is applied correctly.",
      });
    } else if (!metricsHistory || metricsHistory.length === 0) {
      console.warn("⚠️ No historical metrics found for campaign:", {
        campaignId: campaignId.substring(0, 8) + "...",
        reason: "Either no data exists in post_metrics table, or RLS policy is blocking access",
      });
    } else {
      console.log("✅ Successfully fetched historical metrics:", {
        campaignId: campaignId.substring(0, 8) + "...",
        recordCount: metricsHistory.length,
        dateRange: metricsHistory.length > 0 ? {
          earliest: metricsHistory[0].scraped_at,
          latest: metricsHistory[metricsHistory.length - 1].scraped_at,
        } : null,
      });
    }

    // If we have historical data, use it
    if (!historyError && metricsHistory && metricsHistory.length > 0) {
      const metricsByDate = new Map<string, TimeSeriesDataPoint>();

      metricsHistory.forEach((metric: any) => {
        const dateStr = metric.scraped_at ? metric.scraped_at.split("T")[0] : null;
        if (!dateStr) return;

        if (!metricsByDate.has(dateStr)) {
          metricsByDate.set(dateStr, {
            date: dateStr,
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            engagement_rate: 0,
          });
        }

        const point = metricsByDate.get(dateStr)!;
        point.views += Number(metric.views || 0);
        point.likes += Number(metric.likes || 0);
        point.comments += Number(metric.comments || 0);
        point.shares += Number(metric.shares || 0);
      });

      const timeSeriesData = Array.from(metricsByDate.values())
        .map((point) => {
          const totalEngagement = point.likes + point.comments + point.shares;
          const engagement_rate =
            point.views > 0
              ? Number(((totalEngagement / point.views) * 100).toFixed(2))
              : 0;

          return {
            ...point,
            engagement_rate,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      return timeSeriesData;
    }

    // Fallback: use current post data
    console.log("📊 Falling back to current post data for charts");
    const { data: posts, error: postsError } = await client
      .from("posts")
      .select("views, likes, comments, shares, last_scraped_at, platform")
      .eq("campaign_id", campaignId)
      .in("platform", ["tiktok", "instagram"]);

    if (postsError) {
      console.error("❌ Fallback posts query also failed:", {
        campaignId: campaignId.substring(0, 8) + "...",
        errorCode: postsError?.code,
        errorMessage: postsError?.message,
      });
      return [];
    }

    if (!posts || posts.length === 0) {
      console.warn("⚠️ No posts found for campaign (fallback query):", {
        campaignId: campaignId.substring(0, 8) + "...",
      });
      return [];
    }

    console.log("✅ Using fallback post data:", {
      postCount: posts.length,
    });

    // Group by date
    const metricsByDate = new Map<string, TimeSeriesDataPoint>();
    posts.forEach((post: any) => {
      const dateStr = post.last_scraped_at
        ? post.last_scraped_at.split("T")[0]
        : new Date().toISOString().split("T")[0];

      if (!metricsByDate.has(dateStr)) {
        metricsByDate.set(dateStr, {
          date: dateStr,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          engagement_rate: 0,
        });
      }

      const point = metricsByDate.get(dateStr)!;
      point.views += Number(post.views || 0);
      point.likes += Number(post.likes || 0);
      point.comments += Number(post.comments || 0);
      point.shares += Number(post.shares || 0);
    });

    return Array.from(metricsByDate.values())
      .map((point) => {
        const totalEngagement = point.likes + point.comments + point.shares;
        const engagement_rate =
          point.views > 0
            ? Number(((totalEngagement / point.views) * 100).toFixed(2))
            : 0;
        return { ...point, engagement_rate };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error("❌ Unexpected error fetching time series data:", {
      campaignId: campaignId.substring(0, 8) + "...",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return [];
  }
}

/**
 * Get all share links for a campaign
 */
export async function getShareLinksForCampaign(
  campaignId: string
): Promise<ApiListResponse<CampaignShareLink>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    const { data: shareLinks, error } = await supabase
      .from("campaign_share_links")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return {
      data: shareLinks as CampaignShareLink[],
      error: null,
      count: shareLinks?.length || 0,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a share link (password, expiry, etc.)
 */
export async function updateShareLink(
  token: string,
  updates: {
    password?: string;
    isPasswordProtected?: boolean;
    expiresAt?: string | null;
  }
): Promise<ApiResponse<CampaignShareLink>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the share link's campaign
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("campaign_share_links")
      .select(
        `
        *,
        campaign:campaigns!inner(user_id)
      `
      )
      .eq("share_token", token)
      .single();

    if (shareLinkError || !shareLink) {
      return { data: null, error: new Error("Share link not found") };
    }

    const campaign = (shareLink as any).campaign;
    if (campaign.user_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to update this share link"),
      };
    }

    // Prepare update data
    const updateData: CampaignShareLinkUpdate = {};

    if (updates.isPasswordProtected !== undefined) {
      updateData.is_password_protected = updates.isPasswordProtected;
    }

    if (updates.password !== undefined) {
      if (updates.password && updates.isPasswordProtected) {
        updateData.password_hash = await hashPassword(updates.password);
      } else {
        updateData.password_hash = null;
      }
    }

    if (updates.expiresAt !== undefined) {
      updateData.expires_at = updates.expiresAt;
    }

    const { data: updated, error } = await supabase
      .from("campaign_share_links")
      .update(updateData)
      .eq("share_token", token)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: updated, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete/revoke a share link
 */
export async function deleteShareLink(
  token: string
): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the share link's campaign
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("campaign_share_links")
      .select(
        `
        *,
        campaign:campaigns!inner(user_id)
      `
      )
      .eq("share_token", token)
      .single();

    if (shareLinkError || !shareLink) {
      return { data: null, error: new Error("Share link not found") };
    }

    const campaign = (shareLink as any).campaign;
    if (campaign.user_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to delete this share link"),
      };
    }

    const { error } = await supabase
      .from("campaign_share_links")
      .delete()
      .eq("share_token", token);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
