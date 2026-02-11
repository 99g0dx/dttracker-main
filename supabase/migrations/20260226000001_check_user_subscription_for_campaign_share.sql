-- RPC: check_users_subscription_status(p_user_ids uuid[])
-- Returns jsonb { "user-uuid": true/false } for each user (has active subscription = can be added to campaigns).
-- SECURITY DEFINER so caller can check any user's subscription for campaign-sharing UI.
-- Logic matches hasActiveSubscription: agency bypass, or status active, or trialing with current_period_end > now().

CREATE OR REPLACE FUNCTION public.check_users_subscription_status(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  uid uuid;
  v_workspace_id uuid;
  v_status text;
  v_period_end timestamptz;
  v_active boolean;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN result;
  END IF;

  FOREACH uid IN ARRAY p_user_ids
  LOOP
    v_active := false;

    -- Agency bypass: same as hasActiveSubscription
    IF public.has_agency_role(uid) THEN
      v_active := true;
    ELSE
      -- Resolve workspace: workspace_members first, then workspaces.owner_user_id, else user_id as legacy workspace
      SELECT wm.workspace_id INTO v_workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = uid
      LIMIT 1;

      IF v_workspace_id IS NULL THEN
        SELECT w.id INTO v_workspace_id
        FROM public.workspaces w
        WHERE w.owner_user_id = uid
        LIMIT 1;
      END IF;

      IF v_workspace_id IS NULL THEN
        v_workspace_id := uid;
      END IF;

      -- Get subscription for that workspace (latest row)
      SELECT s.status, s.current_period_end
      INTO v_status, v_period_end
      FROM public.subscriptions s
      WHERE s.workspace_id = v_workspace_id
      ORDER BY s.updated_at DESC
      LIMIT 1;

      -- Active = paid (status = 'active') OR (trialing AND period not ended)
      IF v_status = 'active' THEN
        v_active := true;
      ELSIF v_status = 'trialing' AND v_period_end IS NOT NULL AND v_period_end > now() THEN
        v_active := true;
      END IF;
    END IF;

    result := result || jsonb_build_object(uid::text, v_active);
  END LOOP;

  RETURN result;
END;
$$;
