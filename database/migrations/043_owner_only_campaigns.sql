-- Enforce owner-only campaign creation

create or replace function public.is_workspace_owner(target_workspace_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_user_id = target_user_id
  );
end;
$$;

drop policy if exists "Users can insert their own campaigns" on public.campaigns;
create policy "Owners can create campaigns"
  on public.campaigns for insert
  with check (
    user_id = auth.uid()
    and public.is_workspace_owner(campaigns.workspace_id, auth.uid())
    and exists (
      select 1 from public.can_create_campaign(campaigns.workspace_id) as c
      where c.allowed = true
    )
  );
