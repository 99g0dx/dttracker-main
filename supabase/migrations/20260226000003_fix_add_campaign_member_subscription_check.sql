-- Fix: "operator does not exist: jsonb = boolean"
-- The -> operator returns jsonb; use ->> to extract as text and compare with 'true'.

CREATE OR REPLACE FUNCTION public.add_campaign_member_by_email(
  p_campaign_id uuid,
  p_email text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
  v_sub_status jsonb;
  caller_uid uuid := auth.uid();
  p_role_normalized text := lower(trim(nullif(p_role, '')));
BEGIN
  IF p_campaign_id IS NULL OR trim(coalesce(p_email, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing campaign or email.');
  END IF;

  IF p_role_normalized NOT IN ('editor', 'viewer') THEN
    p_role_normalized := 'editor';
  END IF;

  -- Resolve email to user_id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user found with this email.');
  END IF;

  -- Caller must be campaign owner
  SELECT user_id INTO v_owner_id
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found.');
  END IF;

  IF v_owner_id != caller_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the campaign owner can add members by email.');
  END IF;

  -- Already a member?
  IF EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already has access to this campaign.');
  END IF;

  -- Subscription check: only subscribed users can be added
  v_sub_status := public.check_users_subscription_status(ARRAY[v_user_id]);
  IF (v_sub_status->>(v_user_id::text)) IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only subscribed users can be added. Ask them to subscribe first.');
  END IF;

  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (p_campaign_id, v_user_id, p_role_normalized::text);

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;
