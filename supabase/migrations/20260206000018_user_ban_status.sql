-- Expose current user's ban status

CREATE OR REPLACE FUNCTION public.get_user_ban_status()
RETURNS TABLE (
  is_banned BOOLEAN,
  banned_until TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_banned,
    u.banned_until
  FROM auth.users u
  WHERE u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
