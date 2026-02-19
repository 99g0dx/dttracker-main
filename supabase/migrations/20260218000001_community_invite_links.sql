-- Migration: Community invite links + connect tokens
-- Enables public invite links for fans to join workspace communities
-- and connect tokens to link fans who sign up on Dobble Tap after joining.

-- ============================================================
-- 1. community_invite_links table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  join_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active link per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_invite_links_active
  ON public.community_invite_links(workspace_id) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_community_invite_links_token
  ON public.community_invite_links(token);

-- FK to workspaces
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'community_invite_links_workspace_id_fkey') THEN
    ALTER TABLE public.community_invite_links
      ADD CONSTRAINT community_invite_links_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK to auth.users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'community_invite_links_created_by_fkey') THEN
    ALTER TABLE public.community_invite_links
      ADD CONSTRAINT community_invite_links_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- ============================================================
-- 2. community_fan_connect_tokens table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_fan_connect_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_fan_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fan_connect_tokens_token
  ON public.community_fan_connect_tokens(token);

CREATE INDEX IF NOT EXISTS idx_fan_connect_tokens_fan
  ON public.community_fan_connect_tokens(community_fan_id);

CREATE INDEX IF NOT EXISTS idx_fan_connect_tokens_pending
  ON public.community_fan_connect_tokens(status, expires_at) WHERE status = 'pending';

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fan_connect_tokens_fan_id_fkey') THEN
    ALTER TABLE public.community_fan_connect_tokens
      ADD CONSTRAINT fan_connect_tokens_fan_id_fkey
      FOREIGN KEY (community_fan_id) REFERENCES public.community_fans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fan_connect_tokens_workspace_id_fkey') THEN
    ALTER TABLE public.community_fan_connect_tokens
      ADD CONSTRAINT fan_connect_tokens_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. community_fan_notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_fan_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_fan_id UUID NOT NULL,
  activation_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  email_sent_to TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_fan_notifications_activation
  ON public.community_fan_notifications(activation_id);

CREATE INDEX IF NOT EXISTS idx_fan_notifications_fan_activation
  ON public.community_fan_notifications(community_fan_id, activation_id);

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fan_notifications_fan_id_fkey') THEN
    ALTER TABLE public.community_fan_notifications
      ADD CONSTRAINT fan_notifications_fan_id_fkey
      FOREIGN KEY (community_fan_id) REFERENCES public.community_fans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fan_notifications_workspace_id_fkey') THEN
    ALTER TABLE public.community_fan_notifications
      ADD CONSTRAINT fan_notifications_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. Add last_notified_at to community_fans
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_fans' AND column_name = 'last_notified_at'
  ) THEN
    ALTER TABLE public.community_fans ADD COLUMN last_notified_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE public.community_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_fan_connect_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_fan_notifications ENABLE ROW LEVEL SECURITY;

-- community_invite_links: workspace members can SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_invite_links' AND policyname = 'invite_links_workspace_select') THEN
    CREATE POLICY invite_links_workspace_select
      ON public.community_invite_links FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = community_invite_links.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- community_invite_links: workspace admins can INSERT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_invite_links' AND policyname = 'invite_links_admin_insert') THEN
    CREATE POLICY invite_links_admin_insert
      ON public.community_invite_links FOR INSERT
      WITH CHECK (
        workspace_id = auth.uid()
        OR is_workspace_admin(workspace_id)
      );
  END IF;
END $$;

-- community_invite_links: workspace admins can UPDATE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_invite_links' AND policyname = 'invite_links_admin_update') THEN
    CREATE POLICY invite_links_admin_update
      ON public.community_invite_links FOR UPDATE
      USING (
        workspace_id = auth.uid()
        OR is_workspace_admin(workspace_id)
      );
  END IF;
END $$;

-- community_fan_connect_tokens: workspace members can SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_fan_connect_tokens' AND policyname = 'connect_tokens_workspace_select') THEN
    CREATE POLICY connect_tokens_workspace_select
      ON public.community_fan_connect_tokens FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = community_fan_connect_tokens.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- community_fan_notifications: workspace members can SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_fan_notifications' AND policyname = 'fan_notifications_workspace_select') THEN
    CREATE POLICY fan_notifications_workspace_select
      ON public.community_fan_notifications FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = community_fan_notifications.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- ============================================================
-- 6. SECURITY DEFINER RPCs
-- ============================================================

-- Load invite by token (public, no auth required)
CREATE OR REPLACE FUNCTION public.get_community_invite_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  enabled boolean,
  join_count integer,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    cil.id,
    cil.workspace_id,
    w.name AS workspace_name,
    cil.enabled,
    cil.join_count,
    cil.created_at
  FROM public.community_invite_links cil
  JOIN public.workspaces w ON w.id = cil.workspace_id
  WHERE cil.token = p_token
    AND cil.enabled = true;
$$;

COMMENT ON FUNCTION public.get_community_invite_by_token(text) IS
  'Returns community invite link by token if enabled. No auth required so public join pages work.';

-- Generate new invite link (admin only)
CREATE OR REPLACE FUNCTION public.generate_community_invite_link(p_workspace_id uuid)
RETURNS TABLE (token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token TEXT;
BEGIN
  -- Verify caller is workspace admin or owner
  IF NOT (
    p_workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('brand_owner', 'agency_admin')
        AND wm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Only workspace admins can generate invite links';
  END IF;

  -- Disable any existing active link
  UPDATE public.community_invite_links
  SET enabled = false, updated_at = NOW()
  WHERE workspace_id = p_workspace_id AND enabled = true;

  -- Generate 12-char hex token (using gen_random_uuid to avoid pgcrypto dependency)
  v_new_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  -- Insert new link
  INSERT INTO public.community_invite_links (workspace_id, token, enabled, created_by)
  VALUES (p_workspace_id, v_new_token, true, auth.uid());

  RETURN QUERY SELECT v_new_token;
END;
$$;

COMMENT ON FUNCTION public.generate_community_invite_link(uuid) IS
  'Generates a new community invite link for a workspace. Disables any previous link.';

-- Revoke invite link (admin only)
CREATE OR REPLACE FUNCTION public.revoke_community_invite_link(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    p_workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('brand_owner', 'agency_admin')
        AND wm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Only workspace admins can revoke invite links';
  END IF;

  UPDATE public.community_invite_links
  SET enabled = false, updated_at = NOW()
  WHERE workspace_id = p_workspace_id AND enabled = true;
END;
$$;

COMMENT ON FUNCTION public.revoke_community_invite_link(uuid) IS
  'Disables the active community invite link for a workspace.';
