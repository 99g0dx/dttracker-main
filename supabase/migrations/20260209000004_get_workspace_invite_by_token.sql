-- Allow loading a workspace invite by token without requiring auth (so invite links work before login).
-- RPC runs as SECURITY DEFINER and only returns valid, unaccepted, non-expired invites.

CREATE OR REPLACE FUNCTION public.get_workspace_invite_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  email text,
  invited_by uuid,
  role text,
  token text,
  status text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  scopes jsonb,
  inviter_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    wi.id,
    wi.workspace_id,
    wi.email,
    wi.invited_by,
    wi.role,
    wi.token,
    wi.status,
    wi.expires_at,
    wi.accepted_at,
    wi.created_at,
    wi.scopes,
    p.full_name AS inviter_name
  FROM public.workspace_invites wi
  LEFT JOIN public.profiles p ON p.id = wi.invited_by
  WHERE wi.token = p_token
    AND wi.accepted_at IS NULL
    AND wi.expires_at > now();
$$;

COMMENT ON FUNCTION public.get_workspace_invite_by_token(text) IS
  'Returns a single workspace invite by token if valid and not expired. No auth required so invite pages work before login.';
