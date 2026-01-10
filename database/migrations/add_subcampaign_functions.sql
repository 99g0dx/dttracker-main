-- Subcampaign RPC functions

-- Return subcampaign summaries for a parent campaign
CREATE OR REPLACE FUNCTION public.get_subcampaigns(parent_campaign_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  status TEXT,
  posts_count INTEGER,
  total_views BIGINT,
  total_likes BIGINT,
  total_comments BIGINT,
  total_shares BIGINT,
  avg_engagement_rate NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.name,
    c.status,
    COUNT(p.id)::INTEGER AS posts_count,
    COALESCE(SUM(p.views), 0)::BIGINT AS total_views,
    COALESCE(SUM(p.likes), 0)::BIGINT AS total_likes,
    COALESCE(SUM(p.comments), 0)::BIGINT AS total_comments,
    COALESCE(SUM(p.shares), 0)::BIGINT AS total_shares,
    CASE
      WHEN COUNT(p.id) > 0
      THEN ROUND(AVG(p.engagement_rate)::NUMERIC, 2)
      ELSE 0
    END AS avg_engagement_rate,
    c.created_at
  FROM public.campaigns c
  LEFT JOIN public.posts p ON p.campaign_id = c.id
  WHERE c.parent_campaign_id = parent_campaign_id
  GROUP BY c.id;
$$;

-- Return whether a campaign has subcampaigns
CREATE OR REPLACE FUNCTION public.is_parent_campaign(campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE parent_campaign_id = campaign_id
  );
$$;

-- Return aggregated hierarchy metrics for a campaign
CREATE OR REPLACE FUNCTION public.get_campaign_metrics_with_subcampaigns(
  campaign_id UUID
)
RETURNS TABLE (
  campaign JSONB,
  direct_posts_count INTEGER,
  subcampaigns_posts_count INTEGER,
  aggregated_metrics JSONB,
  subcampaigns JSONB
)
LANGUAGE sql
STABLE
AS $$
  WITH parent_campaign AS (
    SELECT * FROM public.campaigns WHERE id = campaign_id
  ),
  subcampaigns AS (
    SELECT c.id
    FROM public.campaigns c
    WHERE c.parent_campaign_id = campaign_id
  ),
  posts_union AS (
    SELECT p.*
    FROM public.posts p
    WHERE p.campaign_id = campaign_id
       OR p.campaign_id IN (SELECT id FROM subcampaigns)
  ),
  kpi_posts AS (
    SELECT *
    FROM posts_union
    WHERE platform IN ('tiktok', 'instagram')
  ),
  metrics AS (
    SELECT
      (SELECT COUNT(*) FROM posts_union)::INTEGER AS total_posts,
      COALESCE(SUM(views), 0)::BIGINT AS total_views,
      COALESCE(SUM(likes), 0)::BIGINT AS total_likes,
      COALESCE(SUM(comments), 0)::BIGINT AS total_comments,
      COALESCE(SUM(shares), 0)::BIGINT AS total_shares,
      CASE
        WHEN (SELECT COUNT(*) FROM kpi_posts) > 0
        THEN ROUND(AVG(engagement_rate)::NUMERIC, 2)
        ELSE 0
      END AS avg_engagement_rate,
      COALESCE(SUM(views), 0)::BIGINT AS total_reach
    FROM kpi_posts
  ),
  subcampaign_stats AS (
    SELECT
      c.id,
      c.name,
      c.status,
      COUNT(p.id)::INTEGER AS posts_count,
      COALESCE(SUM(p.views), 0)::BIGINT AS total_views,
      COALESCE(SUM(p.likes), 0)::BIGINT AS total_likes,
      COALESCE(SUM(p.comments), 0)::BIGINT AS total_comments,
      COALESCE(SUM(p.shares), 0)::BIGINT AS total_shares,
      CASE
        WHEN COUNT(p.id) > 0
        THEN ROUND(AVG(p.engagement_rate)::NUMERIC, 2)
        ELSE 0
      END AS avg_engagement_rate,
      c.created_at
    FROM public.campaigns c
    LEFT JOIN public.posts p ON p.campaign_id = c.id
    WHERE c.parent_campaign_id = campaign_id
    GROUP BY c.id
  )
  SELECT
    row_to_json(parent_campaign.*)::JSONB AS campaign,
    (SELECT COUNT(*) FROM public.posts WHERE campaign_id = campaign_id)::INTEGER AS direct_posts_count,
    (SELECT COUNT(*) FROM public.posts WHERE campaign_id IN (SELECT id FROM subcampaigns))::INTEGER AS subcampaigns_posts_count,
    to_jsonb(metrics.*) AS aggregated_metrics,
    COALESCE((SELECT jsonb_agg(subcampaign_stats) FROM subcampaign_stats), '[]'::JSONB) AS subcampaigns
  FROM parent_campaign, metrics;
$$;
