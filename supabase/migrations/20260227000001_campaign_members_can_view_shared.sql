-- Drop the RLS policy approach (causes infinite recursion with campaign_members).
-- Instead, shared campaigns are fetched via SECURITY DEFINER RPC (get_shared_campaigns_for_user)
-- which bypasses RLS entirely.

DROP POLICY IF EXISTS "Campaign members can view shared campaigns" ON public.campaigns;

-- Helper kept for potential future use but not used in any RLS policy
CREATE OR REPLACE FUNCTION public.is_campaign_member(p_campaign_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id
      AND user_id = p_user_id
  );
$$;
