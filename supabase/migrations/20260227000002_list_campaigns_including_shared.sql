-- RPC: get_campaign_ids_shared_with_user()
-- Returns UUID[] of campaign IDs where the caller is in campaign_members.

CREATE OR REPLACE FUNCTION public.get_campaign_ids_shared_with_user()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(array_agg(campaign_id), '{}'::uuid[])
  FROM public.campaign_members
  WHERE user_id = auth.uid();
$$;

-- RPC: get_shared_campaigns_for_user()
-- Returns campaigns shared with the caller via campaign_members, including nested posts
-- and subcampaign count (same shape as CAMPAIGN_LIST_SELECT in the frontend).
-- Uses SECURITY DEFINER to bypass RLS on campaigns (avoids infinite recursion).

CREATE OR REPLACE FUNCTION public.get_shared_campaigns_for_user()
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
      'posts', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'views', p.views,
          'likes', p.likes,
          'comments', p.comments,
          'shares', p.shares,
          'engagement_rate', p.engagement_rate
        ))
        FROM public.posts p WHERE p.campaign_id = c.id
      ), '[]'::jsonb),
      'subcampaigns', jsonb_build_array(
        jsonb_build_object('count', (
          SELECT count(*) FROM public.campaigns sc
          WHERE sc.parent_campaign_id = c.id
        ))
      )
    ) AS campaign_row
    FROM public.campaigns c
    INNER JOIN public.campaign_members cm ON cm.campaign_id = c.id
    WHERE cm.user_id = auth.uid()
      AND c.parent_campaign_id IS NULL
  ) sub;

  RETURN result;
END;
$$;
