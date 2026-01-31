-- Phase 1: Company admin metrics (internal dashboard)

-- Daily metrics snapshots (optional usage)
create table if not exists public.company_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.company_metrics_daily enable row level security;

drop policy if exists company_metrics_daily_select_company_admin on public.company_metrics_daily;
create policy company_metrics_daily_select_company_admin
  on public.company_metrics_daily for select
  using (public.is_company_admin());

-- Live metrics RPC (security definer; admin only)
create or replace function public.get_company_admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_users bigint;
  new_users_7d bigint;
  new_users_30d bigint;
  total_workspaces bigint;
  total_campaigns bigint;
  active_campaigns bigint;
  total_posts bigint;
  total_views bigint;
  total_creators bigint;
  total_requests bigint;
  requests_7d bigint;
  requests_30d bigint;
  engagement_rate numeric;
  status_breakdown jsonb;
begin
  if not public.is_company_admin() then
    raise exception 'not authorized';
  end if;

  select count(*) into total_users from public.profiles;
  select count(*) into new_users_7d from public.profiles where created_at >= now() - interval '7 days';
  select count(*) into new_users_30d from public.profiles where created_at >= now() - interval '30 days';

  select count(*) into total_workspaces from public.workspaces;
  select count(*) into total_campaigns from public.campaigns;
  select count(*) into active_campaigns from public.campaigns where status = 'active';

  select count(*) into total_posts from public.posts;
  select coalesce(sum(views), 0) into total_views from public.posts;
  select count(*) into total_creators from public.creators;

  select count(*) into total_requests from public.creator_requests;
  select count(*) into requests_7d from public.creator_requests where created_at >= now() - interval '7 days';
  select count(*) into requests_30d from public.creator_requests where created_at >= now() - interval '30 days';

  select case when coalesce(sum(views),0) = 0 then 0
    else (sum(coalesce(likes,0) + coalesce(comments,0) + coalesce(shares,0))::numeric / sum(views)::numeric) * 100 end
  into engagement_rate
  from public.posts;

  select jsonb_object_agg(status, count) into status_breakdown
  from (
    select status, count(*)::int as count
    from public.creator_requests
    group by status
  ) s;

  return jsonb_build_object(
    'total_users', total_users,
    'new_users_7d', new_users_7d,
    'new_users_30d', new_users_30d,
    'total_workspaces', total_workspaces,
    'total_campaigns', total_campaigns,
    'active_campaigns', active_campaigns,
    'total_posts', total_posts,
    'total_views', total_views,
    'total_creators', total_creators,
    'total_requests', total_requests,
    'requests_7d', requests_7d,
    'requests_30d', requests_30d,
    'engagement_rate', coalesce(engagement_rate, 0),
    'requests_by_status', coalesce(status_breakdown, '{}'::jsonb)
  );
end;
$$;

-- Daily snapshot writer (optional: run via cron)
create or replace function public.record_company_metrics_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
begin
  if not public.is_company_admin() then
    raise exception 'not authorized';
  end if;

  snapshot := public.get_company_admin_metrics();

  insert into public.company_metrics_daily (snapshot_date, metrics)
  values (current_date, snapshot)
  on conflict (snapshot_date) do update
    set metrics = excluded.metrics,
        created_at = now();
end;
$$;
