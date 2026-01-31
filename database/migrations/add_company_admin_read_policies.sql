-- Allow company admins to read global metrics tables

-- Profiles (total accounts)
alter table public.profiles enable row level security;
drop policy if exists profiles_select_company_admin on public.profiles;
create policy profiles_select_company_admin
  on public.profiles for select
  using (public.is_company_admin());

-- Campaigns
alter table public.campaigns enable row level security;
drop policy if exists campaigns_select_company_admin on public.campaigns;
create policy campaigns_select_company_admin
  on public.campaigns for select
  using (public.is_company_admin());

-- Posts (views, engagement)
alter table public.posts enable row level security;
drop policy if exists posts_select_company_admin on public.posts;
create policy posts_select_company_admin
  on public.posts for select
  using (public.is_company_admin());

-- Creators
alter table public.creators enable row level security;
drop policy if exists creators_select_company_admin on public.creators;
create policy creators_select_company_admin
  on public.creators for select
  using (public.is_company_admin());
