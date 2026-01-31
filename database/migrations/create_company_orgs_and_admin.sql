-- Create organization model for company admin access

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_company_org boolean not null default false,
  created_at timestamptz default now()
);

-- Organization members
create table if not exists public.org_members (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- RLS
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;

-- Helpers
create or replace function public.is_company_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.org_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and o.is_company_org = true
  );
end;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.org_members om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
  );
end;
$$;

-- Policies: organizations
drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations for select
  using (public.is_org_member(id) or public.is_company_admin());

drop policy if exists organizations_admin_manage on public.organizations;
create policy organizations_admin_manage
  on public.organizations for all
  using (public.is_company_admin())
  with check (public.is_company_admin());

-- Policies: org_members
drop policy if exists org_members_select_self on public.org_members;
create policy org_members_select_self
  on public.org_members for select
  using (user_id = auth.uid() or public.is_company_admin());

drop policy if exists org_members_admin_manage on public.org_members;
create policy org_members_admin_manage
  on public.org_members for all
  using (public.is_company_admin())
  with check (public.is_company_admin());

-- Admin read access for creator requests data
alter table public.creator_requests enable row level security;
alter table public.creator_request_items enable row level security;

drop policy if exists creator_requests_select_company_admin on public.creator_requests;
create policy creator_requests_select_company_admin
  on public.creator_requests for select
  using (public.is_company_admin());

drop policy if exists creator_request_items_select_company_admin on public.creator_request_items;
create policy creator_request_items_select_company_admin
  on public.creator_request_items for select
  using (public.is_company_admin());
