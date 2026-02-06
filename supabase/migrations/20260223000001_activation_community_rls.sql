-- Migration: Add RLS policies for community activation visibility
-- Enforces that community activations are only visible to matched creators/fans

-- Function to check if a user's creator matches activation's community fans
CREATE OR REPLACE FUNCTION is_community_fan_for_activation(
  p_activation_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activation RECORD;
  v_creator_id UUID;
  v_fan_ids UUID[];
BEGIN
  -- Get activation details
  SELECT visibility, community_fan_ids, workspace_id
  INTO v_activation
  FROM public.activations
  WHERE id = p_activation_id;

  -- If activation not found, deny access
  IF v_activation IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Public activations are visible to all workspace members
  IF v_activation.visibility = 'public' OR v_activation.visibility IS NULL THEN
    RETURN TRUE;
  END IF;

  -- For community activations, check if user's creator matches fans
  IF v_activation.visibility = 'community' THEN
    -- Get creator_id for this user
    SELECT id INTO v_creator_id
    FROM public.creators
    WHERE user_id = p_user_id
    LIMIT 1;

    -- If user has no creator profile, deny access
    IF v_creator_id IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Parse community_fan_ids JSONB array
    IF v_activation.community_fan_ids IS NOT NULL AND jsonb_array_length(v_activation.community_fan_ids) > 0 THEN
      -- Convert JSONB array to UUID array
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(v_activation.community_fan_ids)::UUID
      ) INTO v_fan_ids;

      -- Check if creator matches any of the specified fan IDs
      RETURN EXISTS (
        SELECT 1
        FROM public.community_fans
        WHERE id = ANY(v_fan_ids)
        AND workspace_id = v_activation.workspace_id
        AND creator_id = v_creator_id
      );
    ELSE
      -- Empty array means all imported fans - check if creator matches any fan in workspace
      RETURN EXISTS (
        SELECT 1
        FROM public.community_fans
        WHERE workspace_id = v_activation.workspace_id
        AND creator_id = v_creator_id
      );
    END IF;
  END IF;

  -- Default deny
  RETURN FALSE;
END;
$$;

-- Update existing RLS policy to use the function
-- Drop and recreate the policy to include community visibility check
DO $$
BEGIN
  -- Drop existing policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activations'
    AND policyname = 'workspace_members_can_view_activations'
  ) THEN
    DROP POLICY workspace_members_can_view_activations ON public.activations;
  END IF;

  -- Create new policy with community visibility check
  CREATE POLICY workspace_members_can_view_activations
    ON public.activations FOR SELECT
    USING (
      -- Workspace members can always view activations in their workspace
      -- But community activations are further filtered by the function
      (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = activations.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      )
      AND (
        -- Public activations or activations without visibility set are visible
        visibility IS NULL OR visibility = 'public'
        OR
        -- Community activations require matching creator
        is_community_fan_for_activation(activations.id, auth.uid())
      )
    );
END $$;

-- Add index for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_activations_visibility_community_fan_ids 
ON public.activations(visibility, workspace_id) 
WHERE visibility = 'community';

-- Add comment
COMMENT ON FUNCTION is_community_fan_for_activation(UUID, UUID) IS 
'Checks if a user''s creator matches an activation''s community fans. Returns true for public activations or if creator matches community_fan_ids (or all fans if empty array).';
