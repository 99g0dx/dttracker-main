import { supabase } from "../supabase";
import type {
  Post,
  PostInsert,
  PostUpdate,
  PostWithCreator,
  TimeSeriesDataPoint,
  CampaignMetrics,
  ApiResponse,
  ApiListResponse,
} from "../types/database";

/**
 * Fetch all posts for a campaign
 */
export async function listByCampaign(
  campaignId: string
): Promise<ApiListResponse<PostWithCreator>> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        creator:creators(*)
      `
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return {
      data: data as PostWithCreator[],
      error: null,
      count: data?.length || 0,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create a single post
 */
export async function create(post: PostInsert): Promise<ApiResponse<Post>> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .insert(post)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create multiple posts (for CSV import)
 */
export async function createMany(
  posts: PostInsert[]
): Promise<ApiListResponse<Post>> {
  try {
    const { data, error } = await supabase.from("posts").insert(posts).select();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null, count: data?.length || 0 };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a post
 */
export async function update(
  id: string,
  updates: PostUpdate
): Promise<ApiResponse<Post>> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a post
 */
export async function deletePost(id: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.from("posts").delete().eq("id", id);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete all posts in a campaign
 */
export async function deleteAllInCampaign(
  campaignId: string
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("campaign_id", campaignId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get aggregated metrics for a campaign
 */
export async function getCampaignMetrics(
  campaignId: string
): Promise<ApiResponse<CampaignMetrics>> {
  try {
    const { data, error } = await supabase.rpc(
      "get_campaign_metrics_with_subcampaigns",
      { campaign_id: campaignId }
    );

    if (error) {
      return { data: null, error };
    }

    const payload = Array.isArray(data) ? data[0] : data;
    const metrics = payload?.aggregated_metrics ?? payload;

    if (!metrics) {
      return { data: null, error: new Error("No metrics returned") };
    }

    return { data: metrics as CampaignMetrics, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch posts for a campaign hierarchy (parent + subcampaigns)
 */
export async function listByCampaignHierarchy(
  campaignId: string,
  includeSubcampaigns: boolean
): Promise<ApiListResponse<PostWithCreator>> {
  try {
    let campaignIds = [campaignId];

    if (includeSubcampaigns) {
      const { data: subcampaigns, error: subcampaignsError } = await supabase
        .from("campaigns")
        .select("id")
        .eq("parent_campaign_id", campaignId);

      if (subcampaignsError) {
        return { data: null, error: subcampaignsError };
      }

      const subcampaignIds = (subcampaigns || []).map((c: any) => c.id);
      campaignIds = campaignIds.concat(subcampaignIds);
    }

    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        creator:creators(*)
      `
      )
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return {
      data: data as PostWithCreator[],
      error: null,
      count: data?.length || 0,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get time-series metrics data for charts
 * Uses post_metrics table for historical snapshots (more accurate for growth tracking)
 * Falls back to posts table if no historical data exists
 */
export async function getCampaignMetricsTimeSeries(
  campaignId: string
): Promise<ApiResponse<TimeSeriesDataPoint[]>> {
  try {
    // Get all campaign IDs (parent + subcampaigns) to ensure chart matches total metrics
    let campaignIds = [campaignId];

    const { data: subcampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("parent_campaign_id", campaignId);

    if (subcampaigns && subcampaigns.length > 0) {
      campaignIds = campaignIds.concat(subcampaigns.map((c: any) => c.id));
    }

    // First, try to fetch from post_metrics table (historical snapshots)
    // This provides more accurate daily growth tracking
    const { data: metricsHistory, error: historyError } = await supabase
      .from("post_metrics")
      .select(
        `
        post_id,
        views,
        likes,
        comments,
        shares,
        engagement_rate,
        scraped_at,
        posts!inner(campaign_id, platform)
      `
      )
      .in("posts.campaign_id", campaignIds)
      .order("scraped_at", { ascending: true });

    // If we have historical data, use it
    if (!historyError && metricsHistory && metricsHistory.length > 0) {
      // Group metrics by date
      const metricsByDate = new Map<string, any[]>();

      metricsHistory.forEach((metric: any) => {
        const dateStr = metric.scraped_at
          ? metric.scraped_at.split("T")[0]
          : null;
        if (!dateStr) return;

        if (!metricsByDate.has(dateStr)) {
          metricsByDate.set(dateStr, []);
        }
        metricsByDate.get(dateStr)!.push(metric);
      });

      // Sort dates
      const sortedDates = Array.from(metricsByDate.keys()).sort();

      // Track latest metric for each post to handle cumulative totals (fill-forward)
      const currentPostMetrics = new Map<string, any>();
      const timeSeriesData: TimeSeriesDataPoint[] = [];

      sortedDates.forEach((date) => {
        // Update current metrics with data from this date
        const daysMetrics = metricsByDate.get(date) || [];
        daysMetrics.forEach((m) => {
          currentPostMetrics.set(m.post_id, m);
        });

        // Calculate daily totals from current state of all posts
        let views = 0,
          likes = 0,
          comments = 0,
          shares = 0;

        currentPostMetrics.forEach((m) => {
          views += Number(m.views || 0);
          likes += Number(m.likes || 0);
          comments += Number(m.comments || 0);
          shares += Number(m.shares || 0);
        });

        const totalEngagement = likes + comments + shares;
        const engagement_rate =
          views > 0 ? Number(((totalEngagement / views) * 100).toFixed(2)) : 0;

        timeSeriesData.push({
          date,
          views,
          likes,
          comments,
          shares,
          engagement_rate,
        });
      });

      return { data: timeSeriesData, error: null };
    }

    // Fallback to posts table if no historical data exists
    // This ensures backward compatibility and works for new campaigns
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, views, likes, comments, shares, last_scraped_at, created_at, updated_at"
      )
      .in("campaign_id", campaignIds);

    if (error) {
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Group posts by date using last_scraped_at, with fallback to created_at
    const postsByDate = new Map<string, any[]>();

    data.forEach((post: any) => {
      // Use last_scraped_at if available, otherwise fall back to created_at or updated_at
      let dateStr: string;
      if (post.last_scraped_at) {
        dateStr = post.last_scraped_at.split("T")[0];
      } else if (post.created_at) {
        dateStr = post.created_at.split("T")[0];
      } else if (post.updated_at) {
        dateStr = post.updated_at.split("T")[0];
      } else {
        // If no date available, use today's date
        dateStr = new Date().toISOString().split("T")[0];
      }

      if (!postsByDate.has(dateStr)) {
        postsByDate.set(dateStr, []);
      }
      postsByDate.get(dateStr)!.push(post);
    });

    // Sort dates
    const sortedDates = Array.from(postsByDate.keys()).sort();

    // Track latest state for each post
    const currentPosts = new Map<string, any>();
    const timeSeriesData: TimeSeriesDataPoint[] = [];

    sortedDates.forEach((date) => {
      // Update current posts with data from this date
      const daysPosts = postsByDate.get(date) || [];
      daysPosts.forEach((p) => {
        currentPosts.set(p.id, p);
      });

      // Calculate daily totals
      let views = 0,
        likes = 0,
        comments = 0,
        shares = 0;

      currentPosts.forEach((p) => {
        views += Number(p.views || 0);
        likes += Number(p.likes || 0);
        comments += Number(p.comments || 0);
        shares += Number(p.shares || 0);
      });

      const totalEngagement = likes + comments + shares;
      const engagement_rate =
        views > 0 ? Number(((totalEngagement / views) * 100).toFixed(2)) : 0;

      timeSeriesData.push({
        date,
        views,
        likes,
        comments,
        shares,
        engagement_rate,
      });
    });

    return { data: timeSeriesData, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
