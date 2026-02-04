-- Migration: Create activations and activation_submissions for contests and SM panels
-- Activations are created in DTTracker and synced to Dobble Tap for creator participation

CREATE TABLE IF NOT EXISTS public.activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('contest', 'sm_panel')),
  title TEXT NOT NULL,
  brief TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'completed', 'cancelled')),
  deadline TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  total_budget NUMERIC NOT NULL,
  spent_amount NUMERIC DEFAULT 0,
  -- Contest specific
  prize_structure JSONB,
  winner_count INTEGER,
  judging_criteria TEXT CHECK (judging_criteria IN ('performance', 'manual')),
  -- SM Panel specific
  task_type TEXT CHECK (task_type IN ('like', 'share', 'comment', 'story')),
  target_url TEXT,
  payment_per_action NUMERIC,
  max_participants INTEGER,
  auto_approve BOOLEAN DEFAULT false,
  -- Common
  platforms TEXT[],
  requirements TEXT[],
  instructions TEXT,
  synced_to_dobble_tap BOOLEAN DEFAULT false,
  dobble_tap_activation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activation_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL REFERENCES public.activations(id) ON DELETE CASCADE,
  creator_id UUID,
  creator_handle TEXT,
  creator_platform TEXT,
  content_url TEXT,
  proof_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performance_metrics JSONB,
  performance_score NUMERIC,
  rank INTEGER,
  prize_amount NUMERIC,
  payment_amount NUMERIC,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activations_workspace ON public.activations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activations_status ON public.activations(status);
CREATE INDEX IF NOT EXISTS idx_activations_type ON public.activations(type);
CREATE INDEX IF NOT EXISTS idx_activation_submissions_activation ON public.activation_submissions(activation_id);

-- FK to workspaces
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activations_workspace_id_fkey') THEN
    ALTER TABLE public.activations
      ADD CONSTRAINT activations_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can view activations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activations' AND policyname = 'workspace_members_can_view_activations') THEN
    CREATE POLICY workspace_members_can_view_activations
      ON public.activations FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = activations.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- RLS: workspace editors can insert/update activations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activations' AND policyname = 'workspace_editors_can_manage_activations') THEN
    CREATE POLICY workspace_editors_can_manage_activations
      ON public.activations FOR ALL
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = activations.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
          AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
        )
      )
      WITH CHECK (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = activations.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
          AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
        )
      );
  END IF;
END $$;

-- RLS: activation_submissions - view via activation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activation_submissions' AND policyname = 'workspace_members_can_view_submissions') THEN
    CREATE POLICY workspace_members_can_view_submissions
      ON public.activation_submissions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.activations a
          WHERE a.id = activation_submissions.activation_id
          AND (
            a.workspace_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = a.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
            )
          )
        )
      );
  END IF;
END $$;

-- RLS: workspace editors can manage submissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activation_submissions' AND policyname = 'workspace_editors_can_manage_submissions') THEN
    CREATE POLICY workspace_editors_can_manage_submissions
      ON public.activation_submissions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.activations a
          WHERE a.id = activation_submissions.activation_id
          AND (
            a.workspace_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = a.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
              AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
            )
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.activations a
          WHERE a.id = activation_submissions.activation_id
          AND (
            a.workspace_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = a.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
              AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
            )
          )
        )
      );
  END IF;
END $$;
