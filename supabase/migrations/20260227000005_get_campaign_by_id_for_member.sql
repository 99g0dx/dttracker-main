-- RPC: get_campaign_by_id_for_member(p_campaign_id uuid)
-- Returns a single campaign row as jsonb if the caller is the owner OR a campaign_member.
-- Uses SECURITY DEFINER to bypass RLS (avoids infinite recursion).

CREATE OR REPLACE FUNCTION public.get_campaign_by_id_for_member(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
  caller_uid uuid := auth.uid();
BEGIN
  IF p_campaign_id IS NULL OR caller_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check access: owner or campaign_member
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND (
        c.user_id = caller_uid
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = caller_uid
        )
      )
  ) THEN
    RETURN NULL;
  END IF;

  SELECT row_to_json(c.*)::jsonb INTO result
  FROM public.campaigns c
  WHERE c.id = p_campaign_id;

  RETURN result;
END;
$$;
