import { supabase } from '../supabase';
import type {
  Post,
  PostInsert,
  PostUpdate,
  PostWithCreator,
  TimeSeriesDataPoint,
  CampaignMetrics,
  ApiResponse,
  ApiListResponse,
} from '../types/database';

/**
 * Fetch all posts for a campaign
 */
export async function listByCampaign(campaignId: string): Promise<ApiListResponse<PostWithCreator>> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:creators(*)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data as PostWithCreator[], error: null, count: data?.length || 0 };
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
      .from('posts')
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
export async function createMany(posts: PostInsert[]): Promise<ApiListResponse<Post>> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert(posts)
      .select();

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
export async function update(id: string, updates: PostUpdate): Promise<ApiResponse<Post>> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
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
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

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
export async function deleteAllInCampaign(campaignId: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('campaign_id', campaignId);

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
export async function getCampaignMetrics(campaignId: string): Promise<ApiResponse<CampaignMetrics>> {
  try {
    // Get all posts for total count
    const { data: allPosts, error: allPostsError } = await supabase
      .from('posts')
      .select('id')
      .eq('campaign_id', campaignId);

    if (allPostsError) {
      return { data: null, error: allPostsError };
    }

    // Get only KPI posts (TikTok + Instagram) for metrics
    const { data: kpiPosts, error } = await supabase
      .from('posts')
      .select('views, likes, comments, shares, engagement_rate, platform')
      .eq('campaign_id', campaignId)
      .in('platform', ['tiktok', 'instagram']);

    if (error) {
      return { data: null, error };
    }

    const totalPosts = allPosts?.length || 0;
    const kpiPostsCount = kpiPosts?.length || 0;

    if (totalPosts === 0) {
      return {
        data: {
          total_posts: 0,
          total_views: 0,
          total_likes: 0,
          total_comments: 0,
          total_shares: 0,
          avg_engagement_rate: 0,
          total_reach: 0,
        },
        error: null,
      };
    }

    // Calculate metrics only from KPI posts
    const metrics: CampaignMetrics = {
      total_posts: totalPosts, // Total includes all platforms
      total_views: kpiPosts?.reduce((sum, p) => sum + (p.views || 0), 0) || 0,
      total_likes: kpiPosts?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0,
      total_comments: kpiPosts?.reduce((sum, p) => sum + (p.comments || 0), 0) || 0,
      total_shares: kpiPosts?.reduce((sum, p) => sum + (p.shares || 0), 0) || 0,
      avg_engagement_rate: kpiPostsCount > 0
        ? Number(
            (kpiPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / kpiPostsCount).toFixed(2)
          )
        : 0,
      total_reach: kpiPosts?.reduce((sum, p) => sum + (p.views || 0), 0) || 0, // Reach = total views
    };

    return { data: metrics, error: null };
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
    // First, try to fetch from post_metrics table (historical snapshots)
    // This provides more accurate daily growth tracking
    const { data: metricsHistory, error: historyError } = await supabase
      .from('post_metrics')
      .select(`
        views,
        likes,
        comments,
        shares,
        engagement_rate,
        scraped_at,
        posts!inner(campaign_id, platform)
      `)
      .eq('posts.campaign_id', campaignId)
      .in('posts.platform', ['tiktok', 'instagram'])
      .order('scraped_at', { ascending: true });

    // If we have historical data, use it
    if (!historyError && metricsHistory && metricsHistory.length > 0) {
      // Group metrics by date from scraped_at
      const metricsByDate = new Map<string, TimeSeriesDataPoint>();

      metricsHistory.forEach((metric: any) => {
        // Extract date from scraped_at timestamp
        const dateStr = metric.scraped_at ? metric.scraped_at.split('T')[0] : null;
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
        // Sum metrics for each date (aggregate all posts scraped on that date)
        point.views += Number(metric.views || 0);
        point.likes += Number(metric.likes || 0);
        point.comments += Number(metric.comments || 0);
        point.shares += Number(metric.shares || 0);
      });

      // Calculate engagement rate for each date and sort by date
      const timeSeriesData = Array.from(metricsByDate.values())
        .map(point => {
          const totalEngagement = point.likes + point.comments + point.shares;
          const engagement_rate = point.views > 0
            ? Number(((totalEngagement / point.views) * 100).toFixed(2))
            : 0;

          return {
            ...point,
            engagement_rate,
          };
        })
        .sort((a, b) => {
          // Sort by date ascending
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

      return { data: timeSeriesData, error: null };
    }

    // Fallback to posts table if no historical data exists
    // This ensures backward compatibility and works for new campaigns
    const { data, error } = await supabase
      .from('posts')
      .select('views, likes, comments, shares, last_scraped_at, created_at, updated_at')
      .eq('campaign_id', campaignId)
      .in('platform', ['tiktok', 'instagram']);

    if (error) {
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Group metrics by date using last_scraped_at, with fallback to created_at
    const metricsByDate = new Map<string, TimeSeriesDataPoint>();

    data.forEach((post: any) => {
      // Use last_scraped_at if available, otherwise fall back to created_at or updated_at
      let dateStr: string;
      if (post.last_scraped_at) {
        dateStr = post.last_scraped_at.split('T')[0];
      } else if (post.created_at) {
        dateStr = post.created_at.split('T')[0];
      } else if (post.updated_at) {
        dateStr = post.updated_at.split('T')[0];
      } else {
        // If no date available, use today's date
        dateStr = new Date().toISOString().split('T')[0];
      }

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
      // Ensure all values are numbers and handle null/undefined
      point.views += Number(post.views || 0);
      point.likes += Number(post.likes || 0);
      point.comments += Number(post.comments || 0);
      point.shares += Number(post.shares || 0);
    });

    // Calculate engagement rate for each date and sort by date
    const timeSeriesData = Array.from(metricsByDate.values())
      .map(point => {
        const totalEngagement = point.likes + point.comments + point.shares;
        const engagement_rate = point.views > 0
          ? Number(((totalEngagement / point.views) * 100).toFixed(2))
          : 0;

        return {
          ...point,
          engagement_rate,
        };
      })
      .sort((a, b) => {
        // Sort by date ascending
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

    return { data: timeSeriesData, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
