-- Add creator_request_targets for bulk/criteria-based requests

create table if not exists public.creator_request_targets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.creator_requests(id) on delete cascade,
  platform text,
  quantity integer not null default 0,
  follower_min integer,
  follower_max integer,
  geo text,
  budget_min integer,
  budget_max integer,
  content_types text[],
  notes text,
  created_at timestamptz default now()
);

alter table public.creator_request_targets enable row level security;

drop policy if exists creator_request_targets_select_company_admin on public.creator_request_targets;
create policy creator_request_targets_select_company_admin
  on public.creator_request_targets for select
  using (public.is_company_admin());

drop policy if exists creator_request_targets_insert_owner on public.creator_request_targets;
create policy creator_request_targets_insert_owner
  on public.creator_request_targets for insert
  with check (
    exists (
      select 1
      from public.creator_requests cr
      where cr.id = creator_request_targets.request_id
        and cr.user_id = auth.uid()
    )
  );
