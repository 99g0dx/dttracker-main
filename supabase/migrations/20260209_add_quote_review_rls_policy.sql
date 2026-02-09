-- Add RLS policy to allow brand users to accept/reject quotes
-- This allows updating quote_status, quote_reviewed_at, and quote_reviewed_by fields
-- even if the user doesn't own the creator_request

CREATE POLICY "Users can review received quotes"
ON creator_requests
FOR UPDATE
TO public
USING (
  -- Allow if user owns the request (existing behavior)
  (auth.uid() = user_id)
  OR
  -- Allow if user is company admin (existing behavior)
  is_company_admin()
  OR
  -- Allow if user is workspace owner (existing behavior)
  (EXISTS (
    SELECT 1
    FROM campaigns c
    WHERE c.id = creator_requests.campaign_id
    AND is_workspace_owner(c.workspace_id, auth.uid())
  ))
  OR
  -- NEW: Allow ANY authenticated user to update quote-related fields
  -- if the quote has been received (quote_received = true)
  (
    auth.uid() IS NOT NULL
    AND quote_received = true
    AND NOT is_user_banned(auth.uid())
  )
)
WITH CHECK (
  -- Same conditions for the updated row
  (auth.uid() = user_id)
  OR is_company_admin()
  OR (EXISTS (
    SELECT 1
    FROM campaigns c
    WHERE c.id = creator_requests.campaign_id
    AND is_workspace_owner(c.workspace_id, auth.uid())
  ))
  OR (
    auth.uid() IS NOT NULL
    AND quote_received = true
    AND NOT is_user_banned(auth.uid())
  )
);

-- Drop the old restrictive update policy
DROP POLICY IF EXISTS "Users can update their own creator requests" ON creator_requests;

-- Recreate it with better name to avoid confusion
CREATE POLICY "Users can update their own creator requests - general"
ON creator_requests
FOR UPDATE
TO public
USING (
  (auth.uid() = user_id)
  AND (NOT is_user_banned(auth.uid()))
)
WITH CHECK (
  (auth.uid() = user_id)
  AND (NOT is_user_banned(auth.uid()))
);
