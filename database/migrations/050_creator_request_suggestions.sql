-- Add suggestion metadata to creator requests and allow workspace owners to review

ALTER TABLE public.creator_requests
  ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS suggestion_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_requests_submission_type_check'
      AND conrelid = 'public.creator_requests'::regclass
  ) THEN
    ALTER TABLE public.creator_requests
      ADD CONSTRAINT creator_requests_submission_type_check
      CHECK (submission_type IN ('request', 'suggestion'));
  END IF;
END
$$;

-- Allow workspace owners to view all requests in their workspace
DROP POLICY IF EXISTS "Workspace owners can view workspace requests" ON public.creator_requests;
CREATE POLICY "Workspace owners can view workspace requests"
  ON public.creator_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = creator_requests.campaign_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );

-- Allow workspace owners to update requests in their workspace
DROP POLICY IF EXISTS "Workspace owners can update workspace requests" ON public.creator_requests;
CREATE POLICY "Workspace owners can update workspace requests"
  ON public.creator_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = creator_requests.campaign_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = creator_requests.campaign_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );

-- Allow workspace owners to view request items for workspace requests
DROP POLICY IF EXISTS "Workspace owners can view request items" ON public.creator_request_items;
CREATE POLICY "Workspace owners can view request items"
  ON public.creator_request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.creator_requests cr
      JOIN public.campaigns c ON c.id = cr.campaign_id
      WHERE cr.id = creator_request_items.request_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );
