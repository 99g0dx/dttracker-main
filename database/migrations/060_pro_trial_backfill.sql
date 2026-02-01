-- Enforce 14-day Pro trial on signup and backfill existing free subscriptions

-- Ensure default workspace creation gives Pro trial in subscriptions table
create or replace function public.create_default_workspace()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.workspaces (id, name, owner_user_id)
  values (new.id, 'Workspace', new.id)
  on conflict (id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.id, 'brand_owner')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.usage_counters (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;

  insert into public.subscriptions (
    workspace_id,
    tier,
    billing_cycle,
    status,
    included_seats,
    extra_seats,
    total_seats,
    current_period_start,
    current_period_end
  )
  values (
    new.id,
    'pro',
    'monthly',
    'trialing',
    2,
    0,
    2,
    now(),
    now() + interval '14 days'
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Ensure default workspace_subscriptions trial (legacy)
create or replace function public.create_default_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.workspace_subscriptions (
    workspace_id,
    plan_slug,
    status,
    trial_start_at,
    trial_end_at,
    trial_used,
    total_seats
  )
  values (new.id, 'pro', 'trialing', now(), now() + interval '14 days', true, 2)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

-- Backfill: upgrade existing free subscriptions to Pro trial (one-time)
update public.subscriptions
set
  tier = 'pro',
  billing_cycle = 'monthly',
  status = 'trialing',
  included_seats = 2,
  extra_seats = 0,
  total_seats = 2,
  current_period_start = coalesce(current_period_start, now()),
  current_period_end = coalesce(current_period_end, now() + interval '14 days')
where
  status = 'active'
  and tier = 'free'
  and (current_period_end is null or current_period_end < now());

-- Backfill: ensure missing subscriptions rows exist for workspaces
insert into public.subscriptions (
  workspace_id,
  tier,
  billing_cycle,
  status,
  included_seats,
  extra_seats,
  total_seats,
  current_period_start,
  current_period_end
)
select
  w.id,
  'pro',
  'monthly',
  'trialing',
  2,
  0,
  2,
  now(),
  now() + interval '14 days'
from public.workspaces w
left join public.subscriptions s on s.workspace_id = w.id
where s.id is null;

-- Backfill: workspace_subscriptions legacy table
update public.workspace_subscriptions
set
  plan_slug = 'pro',
  status = 'trialing',
  trial_start_at = coalesce(trial_start_at, now()),
  trial_end_at = coalesce(trial_end_at, now() + interval '14 days'),
  trial_used = true,
  total_seats = 2
where
  status = 'free'
  and (trial_end_at is null or trial_end_at < now());
