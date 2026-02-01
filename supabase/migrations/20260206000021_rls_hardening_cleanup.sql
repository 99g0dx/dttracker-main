-- RLS hardening cleanup: tighten creators visibility, share links, invites, and campaign creation

-- Helpers
DO $$
BEGIN
  -- Creators: remove global visibility policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creators'
      AND policyname = 'Authenticated users can view all creators'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated users can view all creators" ON public.creators';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creators'
      AND policyname = 'Allow authenticated users to view all creators'
  ) THEN
    EXECUTE 'DROP POLICY "Allow authenticated users to view all creators" ON public.creators';
  END IF;

  -- Creators: ensure workspace members can see creators in their workspace library
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creators'
      AND policyname = 'workspace members can view workspace creators'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "workspace members can view workspace creators"
      ON public.creators FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_creators wc
          JOIN public.workspace_members wm ON wm.workspace_id = wc.workspace_id
          WHERE wc.creator_id = creators.id
            AND wm.user_id = auth.uid()
            AND wm.status = 'active'
        )
      )
    $policy$;
  END IF;

  -- Campaign share links: remove public read policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_share_links'
      AND policyname = 'Anyone can view share links'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can view share links" ON public.campaign_share_links';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_share_links'
      AND policyname = 'Public can view share links by token or owners can view their l'
  ) THEN
    EXECUTE 'DROP POLICY "Public can view share links by token or owners can view their l" ON public.campaign_share_links';
  END IF;

  -- Campaign share links: owners only (admins through ownership)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_share_links'
      AND policyname = 'Campaign owners can view share links'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Campaign owners can view share links"
      ON public.campaign_share_links FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.campaigns
          WHERE campaigns.id = campaign_share_links.campaign_id
            AND campaigns.user_id = auth.uid()
        )
      )
    $policy$;
  END IF;

  -- Workspace invites: restrict delete to admins/owners
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_invites'
      AND policyname = 'workspace_invites_delete_member'
  ) THEN
    EXECUTE 'DROP POLICY "workspace_invites_delete_member" ON public.workspace_invites';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_invites'
      AND policyname = 'workspace_invites_delete_admin'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "workspace_invites_delete_admin"
      ON public.workspace_invites FOR DELETE
      USING (public.is_workspace_admin(workspace_id, auth.uid()))
    $policy$;
  END IF;

  -- Campaigns: remove broad manage/insert policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns'
      AND policyname = 'Workspace members can manage campaigns'
  ) THEN
    EXECUTE 'DROP POLICY "Workspace members can manage campaigns" ON public.campaigns';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns'
      AND policyname = 'campaigns_insert_workspace_editor'
  ) THEN
    EXECUTE 'DROP POLICY "campaigns_insert_workspace_editor" ON public.campaigns';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns'
      AND policyname = 'campaigns_insert_editor_or_admin'
  ) THEN
    EXECUTE 'DROP POLICY "campaigns_insert_editor_or_admin" ON public.campaigns';
  END IF;

  -- Campaign creators: remove editor/admin insert/delete policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_creators'
      AND policyname = 'campaign_creators_insert_workspace_editor'
  ) THEN
    EXECUTE 'DROP POLICY "campaign_creators_insert_workspace_editor" ON public.campaign_creators';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_creators'
      AND policyname = 'campaign_creators_insert_editor_or_admin'
  ) THEN
    EXECUTE 'DROP POLICY "campaign_creators_insert_editor_or_admin" ON public.campaign_creators';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_creators'
      AND policyname = 'campaign_creators_delete_workspace_editor'
  ) THEN
    EXECUTE 'DROP POLICY "campaign_creators_delete_workspace_editor" ON public.campaign_creators';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_creators'
      AND policyname = 'campaign_creators_delete_editor_or_admin'
  ) THEN
    EXECUTE 'DROP POLICY "campaign_creators_delete_editor_or_admin" ON public.campaign_creators';
  END IF;
END $$;
