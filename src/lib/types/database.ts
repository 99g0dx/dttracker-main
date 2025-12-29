// ============================================================
// DTTracker Database Types
// TypeScript interfaces matching Supabase database schema
// ============================================================

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook';
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'archived';
export type PostStatus = 'pending' | 'scraped' | 'failed' | 'manual' | 'scraping';
export type MemberRole = 'owner' | 'editor' | 'viewer';

// ============================================================
// DATABASE TABLES
// ============================================================

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Creator {
  id: string;
  user_id: string;
  name: string;
  handle: string;
  platform: Platform;
  follower_count: number;
  avg_engagement: number;
  email: string | null;
  phone: string | null;
  niche: string | null;
  location: string | null;
  source_type: 'manual' | 'csv_import' | 'scraper_extraction' | null;
  imported_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  brand_name: string | null;
  cover_image_url: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  campaign_id: string;
  creator_id: string;
  platform: Platform;
  post_url: string;
  posted_date: string | null;
  status: PostStatus;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostMetric {
  id: string;
  post_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  scraped_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface CampaignCreator {
  id: string;
  campaign_id: string;
  creator_id: string;
  created_at: string;
}

// ============================================================
// INSERT TYPES (for creating new records)
// ============================================================

export interface ProfileInsert {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface CreatorInsert {
  user_id: string;
  name: string;
  handle: string;
  platform: Platform;
  follower_count?: number;
  avg_engagement?: number;
  email?: string | null;
  phone?: string | null;
  niche?: string | null;
  location?: string | null;
  source_type?: 'manual' | 'csv_import' | 'scraper_extraction' | null;
  imported_by_user_id?: string | null;
}

export interface CampaignInsert {
  user_id: string;
  name: string;
  brand_name?: string | null;
  cover_image_url?: string | null;
  status?: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export interface PostInsert {
  campaign_id: string;
  creator_id: string;
  platform: Platform;
  post_url: string;
  posted_date?: string | null;
  status?: PostStatus;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement_rate?: number;
}

export interface PostMetricInsert {
  post_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface CampaignMemberInsert {
  campaign_id: string;
  user_id: string;
  role?: MemberRole;
}

// ============================================================
// UPDATE TYPES (for updating existing records)
// ============================================================

export interface ProfileUpdate {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface CreatorUpdate {
  name?: string;
  handle?: string;
  platform?: Platform;
  follower_count?: number;
  avg_engagement?: number;
  email?: string | null;
  phone?: string | null;
  niche?: string | null;
  location?: string | null;
  source_type?: 'manual' | 'csv_import' | 'scraper_extraction' | null;
}

export interface CampaignUpdate {
  name?: string;
  brand_name?: string | null;
  cover_image_url?: string | null;
  status?: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export interface PostUpdate {
  post_url?: string;
  posted_date?: string | null;
  status?: PostStatus;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement_rate?: number;
}

export interface CampaignMemberUpdate {
  role?: MemberRole;
}

// ============================================================
// AGGREGATED TYPES (for UI with computed fields)
// ============================================================

export interface CampaignWithStats extends Campaign {
  posts_count: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  avg_engagement_rate: number;
}

export interface PostWithCreator extends Post {
  creator: Creator;
}

export interface PostWithMetrics extends Post {
  creator: Creator;
  metrics_history: PostMetric[];
}

export interface CampaignWithPosts extends Campaign {
  posts: PostWithCreator[];
}

export interface CampaignWithMembers extends Campaign {
  members: CampaignMember[];
}

// ============================================================
// METRICS & ANALYTICS TYPES
// ============================================================

export interface CampaignMetrics {
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  avg_engagement_rate: number;
  total_reach: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface PlatformBreakdown {
  platform: Platform;
  posts_count: number;
  total_views: number;
  total_likes: number;
  avg_engagement_rate: number;
}

export interface CreatorPerformance {
  creator: Creator;
  posts_count: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  avg_engagement_rate: number;
}

export interface CreatorWithStats extends Creator {
  campaigns: number;
  totalPosts: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface ApiListResponse<T> {
  data: T[] | null;
  error: Error | null;
  count?: number;
}

// ============================================================
// CSV IMPORT/EXPORT TYPES
// ============================================================

export interface CSVPostRow {
  creator_name: string;
  creator_handle: string;
  platform: Platform;
  post_url: string;
  posted_date?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface CSVImportResult {
  success_count: number;
  error_count: number;
  errors: Array<{ row: number; message: string }>;
}

// ============================================================
// SCRAPING TYPES
// ============================================================

export interface ScrapeResult {
  success: boolean;
  post_id: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement_rate?: number;
  error?: string;
}

export interface BulkScrapeResult {
  total: number;
  succeeded: number;
  failed: number;
  results: ScrapeResult[];
}
