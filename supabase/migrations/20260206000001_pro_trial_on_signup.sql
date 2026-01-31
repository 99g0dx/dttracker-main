-- Give new accounts a 14-day Pro trial on signup (subscriptions + workspace_subscriptions)

-- Update create_default_workspace (subscriptions table)
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

-- Update create_default_subscription (workspace_subscriptions table)
create or replace function create_default_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into workspace_subscriptions (
    workspace_id,
    plan_slug,
    status,
    trial_start_at,
    trial_end_at,
    trial_used,
    total_seats
  )
  values (new.id, 'pro_monthly', 'trialing', now(), now() + interval '14 days', true, 2)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;
