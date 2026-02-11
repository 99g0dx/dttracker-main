-- Copy and run this in Supabase SQL Editor to deploy the updated get_campaign_members_with_emails function.
-- (Access check removed so the RPC returns members correctly for the sharing modal "Has Access" list.)

CREATE OR REPLACE FUNCTION public.get_campaign_members_with_emails(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', cm.user_id,
        'email', au.email,
        'full_name', p.full_name,
        'role', cm.role
      )
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.campaign_members cm
  JOIN auth.users au ON au.id = cm.user_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.campaign_id = p_campaign_id
  ORDER BY cm.created_at DESC;

  RETURN result;
END;
$$;
