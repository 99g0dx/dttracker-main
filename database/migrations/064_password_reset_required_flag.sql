-- Admin enforced password reset flag on profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS require_password_change boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.company_admin_set_password_reset_required(
  target_user_id uuid,
  required boolean
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.profiles
  SET require_password_change = required
  WHERE id = target_user_id;

  PERFORM public.log_company_admin_action(
    target_user_id,
    'password_reset_required',
    jsonb_build_object('required', required)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
