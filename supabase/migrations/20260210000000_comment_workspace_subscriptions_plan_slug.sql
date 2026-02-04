-- Document that plan_slug must be from billing_plans only (starter, pro, agency).
-- Do not use plan_catalog slugs (e.g. agency_monthly) here; map tier in company_admin_set_user_subscription.
COMMENT ON COLUMN public.workspace_subscriptions.plan_slug IS
  'FK to billing_plans(slug). Use only starter, pro, agency. Do not use plan_catalog slugs (e.g. agency_monthly).';
