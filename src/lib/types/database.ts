// ============================================================
// DTTracker Database Types
// TypeScript interfaces matching Supabase database schema
// ============================================================

export type Platform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "twitter"
  | "facebook";
export type CampaignStatus = "active" | "paused" | "completed" | "archived";
export type PostStatus =
  | "pending"
  | "scraped"
  | "failed"
  | "manual"
  | "scraping";
export type MemberRole = "owner" | "editor" | "viewer";
export type TeamRole = "owner" | "admin" | "member" | "viewer";
export type MemberStatus = "active" | "pending";
export type ScopeType = "workspace" | "campaign" | "calendar";

// ============================================================
// DATABASE TABLES
// ============================================================

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
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
  source_type: "manual" | "csv_import" | "scraper_extraction" | null;
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
  share_enabled: boolean;
  share_token: string | null;
  share_created_at: string | null;
  share_expires_at: string | null;
  share_allow_export: boolean;
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

export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: TeamRole;
  status: MemberStatus;
  invited_by: string;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  role: TeamRole;
  invite_token: string;
  expires_at: string;
  accepted_at: string | null;
  message: string | null;
  created_at: string;
}

export interface MemberScope {
  id: string;
  team_member_id: string;
  scope_type: ScopeType;
  scope_value: string; // 'editor'/'viewer' or campaign_id UUID
  created_at: string;
}

export interface CampaignShareLink {
  id: string;
  campaign_id: string;
  share_token: string;
  password_hash: string | null;
  is_password_protected: boolean;
  created_by: string;
  expires_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
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
  source_type?: "manual" | "csv_import" | "scraper_extraction" | null;
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

export interface TeamMemberInsert {
  workspace_id: string;
  user_id: string;
  role?: TeamRole;
  status?: MemberStatus;
  invited_by: string;
  joined_at?: string | null;
}

export interface TeamInviteInsert {
  workspace_id: string;
  email: string;
  invited_by: string;
  role: TeamRole;
  invite_token: string;
  expires_at: string;
  message?: string | null;
}

export interface MemberScopeInsert {
  team_member_id: string;
  scope_type: ScopeType;
  scope_value: string;
}

export interface CampaignShareLinkInsert {
  campaign_id: string;
  share_token: string;
  password_hash?: string | null;
  is_password_protected: boolean;
  created_by: string;
  expires_at?: string | null;
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
  source_type?: "manual" | "csv_import" | "scraper_extraction" | null;
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

export interface TeamMemberUpdate {
  role?: TeamRole;
  status?: MemberStatus;
  joined_at?: string | null;
}

export interface TeamInviteUpdate {
  accepted_at?: string | null;
}

export interface CampaignShareLinkUpdate {
  password_hash?: string | null;
  is_password_protected?: boolean;
  expires_at?: string | null;
  last_accessed_at?: string | null;
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

export interface TeamMemberWithScopes extends TeamMember {
  scopes: MemberScope[];
}

export interface TeamInviteWithInviter extends TeamInvite {
  inviter_name: string | null;
  inviter_email: string | null;
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
