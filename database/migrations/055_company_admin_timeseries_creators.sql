-- Add creators count to company admin time series

CREATE OR REPLACE FUNCTION public.get_company_admin_timeseries()
RETURNS TABLE (
  day DATE,
  requests_count INTEGER,
  users_count INTEGER,
  workspaces_count INTEGER,
  campaigns_count INTEGER,
  creators_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (current_date - interval '29 days')::date,
      current_date::date,
      interval '1 day'
    )::date AS day
  )
  SELECT
    d.day,
    COALESCE(req.count, 0)::integer AS requests_count,
    COALESCE(u.count, 0)::integer AS users_count,
    COALESCE(w.count, 0)::integer AS workspaces_count,
    COALESCE(c.count, 0)::integer AS campaigns_count,
    COALESCE(cr.count, 0)::integer AS creators_count
  FROM days d
  LEFT JOIN (
    SELECT created_at::date AS day, COUNT(*) AS count
    FROM public.creator_requests
    GROUP BY created_at::date
  ) req ON req.day = d.day
  LEFT JOIN (
    SELECT created_at::date AS day, COUNT(*) AS count
    FROM auth.users
    GROUP BY created_at::date
  ) u ON u.day = d.day
  LEFT JOIN (
    SELECT created_at::date AS day, COUNT(*) AS count
    FROM public.workspaces
    GROUP BY created_at::date
  ) w ON w.day = d.day
  LEFT JOIN (
    SELECT created_at::date AS day, COUNT(*) AS count
    FROM public.campaigns
    GROUP BY created_at::date
  ) c ON c.day = d.day
  LEFT JOIN (
    SELECT created_at::date AS day, COUNT(*) AS count
    FROM public.creators
    GROUP BY created_at::date
  ) cr ON cr.day = d.day
  ORDER BY d.day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
