-- RPC: get_shared_campaigns_with_stats()
-- Returns shared campaigns with posts stats (views, likes, comments, shares, engagement_rate, posts_count).
-- SECURITY DEFINER to bypass campaigns RLS.

CREATE OR REPLACE FUNCTION public.get_shared_campaigns_with_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(campaign_row ORDER BY (campaign_row->>'created_at') DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'brand_name', c.brand_name,
      'status', c.status,
      'cover_image_url', c.cover_image_url,
      'start_date', c.start_date,
      'end_date', c.end_date,
      'created_at', c.created_at,
      'workspace_id', c.workspace_id,
      'user_id', c.user_id,
      'posts', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'views', p.views,
          'likes', p.likes,
          'comments', p.comments,
          'shares', p.shares,
          'engagement_rate', p.engagement_rate
        ))
        FROM public.posts p
        WHERE p.campaign_id = c.id
      ), '[]'::jsonb),
      'subcampaigns', coalesce((
        SELECT jsonb_agg(jsonb_build_object('count', sub_count))
        FROM (
          SELECT count(*) as sub_count
          FROM public.campaigns sc
          WHERE sc.parent_campaign_id = c.id
        ) sub
      ), '[]'::jsonb)
    ) AS campaign_row
    FROM public.campaigns c
    INNER JOIN public.campaign_members cm ON cm.campaign_id = c.id
    WHERE cm.user_id = auth.uid()
      AND c.parent_campaign_id IS NULL
  ) subq;

  RETURN result;
END;
$$;
