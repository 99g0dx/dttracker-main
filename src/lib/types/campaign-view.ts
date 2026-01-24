/**
 * Shared types for campaign view data
 * Used by both internal CampaignDetail and public SharedCampaignDashboard
 */

import type { Platform, PostWithRankings } from "./database";

/**
 * Chart data point for time series visualization
 */
export interface ChartDataPoint {
  date: string;
  dateValue?: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

/**
 * Chart range options
 */
export type ChartRange = "7d" | "14d" | "30d" | "all";

/**
 * Subcampaign summary for parent campaigns
 */
export interface SubcampaignSummary {
  id: string;
  name: string;
  status: string;
  postCount: number;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

/**
 * Campaign totals/KPI data
 */
export interface CampaignTotals {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

/**
 * Campaign share settings
 */
export interface CampaignShareSettings {
  isPasswordProtected: boolean;
  allowExport: boolean;
  expiresAt?: string | null;
}

/**
 * Unified campaign view data structure
 * Returned by both internal API and public share endpoint
 */
export interface CampaignViewData {
  campaign: {
    id: string;
    name: string;
    brand_name: string | null;
    status: string;
    cover_image_url: string | null;
    created_at: string;
    parent_campaign_id?: string | null;
  };
  totals: CampaignTotals;
  timeSeries: ChartDataPoint[];
  posts: PostWithRankings[];
  isParent?: boolean;
  subcampaigns?: SubcampaignSummary[];
  share?: CampaignShareSettings;
}

/**
 * Public share response from edge function
 */
export interface SharedCampaignResponse {
  campaign: {
    id: string;
    name: string;
    brandName: string | null;
    status: string;
    coverImageUrl: string | null;
    createdAt: string;
  };
  totals: CampaignTotals;
  timeSeries: Array<{
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  posts: Array<{
    id: string;
    platform: Platform;
    postUrl: string;
    status: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
    createdAt: string;
    creator: {
      id: string;
      name: string;
      handle: string;
    } | null;
  }>;
  share: {
    isPasswordProtected: boolean;
    allowExport: boolean;
    expiresAt: string | null;
  };
}

/**
 * Normalize shared campaign response to CampaignViewData format
 */
export function normalizeSharedCampaignResponse(
  response: SharedCampaignResponse
): CampaignViewData {
  return {
    campaign: {
      id: response.campaign.id,
      name: response.campaign.name,
      brand_name: response.campaign.brandName,
      status: response.campaign.status,
      cover_image_url: response.campaign.coverImageUrl,
      created_at: response.campaign.createdAt,
    },
    totals: response.totals,
    timeSeries: response.timeSeries.map((point) => ({
      ...point,
      dateValue: new Date(point.date),
    })),
    posts: response.posts.map((post, index) => ({
      id: post.id,
      campaign_id: response.campaign.id,
      creator_id: post.creator?.id ?? null,
      platform: post.platform,
      post_url: post.postUrl,
      status: post.status as any,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      engagement_rate: post.engagementRate,
      posted_date: null,
      last_scraped_at: null,
      created_at: post.createdAt,
      updated_at: post.createdAt,
      creator: post.creator
        ? {
            id: post.creator.id,
            user_id: "",
            name: post.creator.name,
            handle: post.creator.handle,
            platform: post.platform,
            follower_count: 0,
            avg_engagement: 0,
            email: null,
            phone: null,
            niche: null,
            location: null,
            source_type: null,
            imported_by_user_id: null,
            created_by_workspace_id: null,
            profile_url: null,
            display_name: null,
            country: null,
            state: null,
            city: null,
            contact_email: null,
            whatsapp: null,
            created_at: "",
            updated_at: "",
          }
        : ({} as any),
      rank: index + 1,
    })),
    share: {
      isPasswordProtected: response.share.isPasswordProtected,
      allowExport: response.share.allowExport,
      expiresAt: response.share.expiresAt,
    },
  };
}
