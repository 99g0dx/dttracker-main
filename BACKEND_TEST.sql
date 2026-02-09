-- Backend Test Script for Quote Workflow Fix
-- Run this in Supabase SQL Editor to verify everything works

-- ============================================================================
-- STEP 1: Apply the RPC function fix
-- ============================================================================

-- Fix respond_creator_quote RPC to update quote-specific fields
CREATE OR REPLACE FUNCTION public.respond_creator_quote(
  target_request_id UUID,
  target_creator_id UUID,
  decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_record RECORD;
  item_record RECORD;
  approved_count INTEGER := 0;
  quoted_count INTEGER := 0;
  rejected_count INTEGER := 0;
  total_count INTEGER := 0;
  mapped_decision TEXT;
  quote_decision TEXT;
BEGIN
  -- Validate decision
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  -- Map item-level decision to request-level quote decision
  mapped_decision := decision;
  quote_decision := CASE
    WHEN decision = 'approved' THEN 'accepted'
    WHEN decision = 'rejected' THEN 'declined'
    ELSE decision
  END;

  -- Get request and verify ownership
  SELECT *
  INTO req_record
  FROM public.creator_requests
  WHERE id = target_request_id
    AND user_id = auth.uid();

  IF req_record IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get the request item
  SELECT *
  INTO item_record
  FROM public.creator_request_items
  WHERE request_id = target_request_id
    AND creator_id = target_creator_id;

  IF item_record IS NULL THEN
    RAISE EXCEPTION 'Request item not found';
  END IF;

  -- If already in this state, return early
  IF item_record.status = mapped_decision THEN
    RETURN jsonb_build_object('status', mapped_decision, 'updated', false);
  END IF;

  -- Update creator_request_items with the decision
  UPDATE public.creator_request_items
  SET
    status = mapped_decision,
    updated_at = NOW()
  WHERE request_id = target_request_id
    AND creator_id = target_creator_id;

  -- Update creator_requests with quote-specific fields
  -- This is the KEY FIX: update quote_status, quote_reviewed_at, quote_reviewed_by
  UPDATE public.creator_requests
  SET
    quote_status = quote_decision,
    quote_reviewed_at = NOW(),
    quote_reviewed_by = auth.uid(),
    updated_at = NOW()
  WHERE id = target_request_id;

  -- If approved and campaign exists, add creator to campaign
  IF decision = 'approved' AND req_record.campaign_id IS NOT NULL THEN
    INSERT INTO public.campaign_creators (campaign_id, creator_id)
    VALUES (req_record.campaign_id, target_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Get counts for overall status update
  SELECT
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'quoted'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*)
  INTO approved_count, quoted_count, rejected_count, total_count
  FROM public.creator_request_items
  WHERE request_id = target_request_id;

  -- Update overall request status based on items
  IF approved_count > 0 THEN
    UPDATE public.creator_requests
    SET status = 'approved', updated_at = now()
    WHERE id = target_request_id;
  ELSIF quoted_count > 0 THEN
    UPDATE public.creator_requests
    SET status = 'quoted', updated_at = now()
    WHERE id = target_request_id;
  ELSIF rejected_count = total_count THEN
    UPDATE public.creator_requests
    SET status = 'submitted', updated_at = now()
    WHERE id = target_request_id;
  END IF;

  RETURN jsonb_build_object('status', mapped_decision, 'updated', true);
END;
$$;

-- Verify function was created
SELECT 'RPC function updated ✅' as status;

-- ============================================================================
-- STEP 2: Check current quote statuses
-- ============================================================================

SELECT
  '=== Current Quotes ===' as section,
  COUNT(*) as total_quotes,
  COUNT(*) FILTER (WHERE cr.quote_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE cr.quote_status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE cr.quote_status = 'declined') as declined,
  COUNT(*) FILTER (WHERE cri.status = 'approved' AND cr.quote_status = 'pending') as inconsistent
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
WHERE cr.quote_received = true;

-- Show inconsistent quotes
SELECT
  '=== Inconsistent Quotes (Need Fixing) ===' as section,
  cr.id as request_id,
  cr.quote_status as request_quote_status,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cri.status IN ('approved', 'rejected')
  AND cr.quote_status = 'pending';

-- ============================================================================
-- STEP 3: Fix all inconsistent quotes
-- ============================================================================

UPDATE creator_requests cr
SET
  quote_status = CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    ELSE cr.quote_status
  END,
  quote_reviewed_at = cri.updated_at,
  updated_at = NOW()
FROM creator_request_items cri
WHERE cr.id = cri.request_id
  AND cri.status IN ('approved', 'rejected')
  AND cr.quote_status = 'pending';

SELECT 'Inconsistent quotes fixed ✅' as status;

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

SELECT
  '=== After Fix - All Quotes Should Be Consistent ===' as section,
  cr.id as request_id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.quote_reviewed_by,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name,
  CASE
    WHEN cr.quote_status = 'accepted' AND cri.status = 'approved' THEN '✅'
    WHEN cr.quote_status = 'declined' AND cri.status = 'rejected' THEN '✅'
    WHEN cr.quote_status = 'pending' AND cri.status = 'quoted' THEN '✅'
    ELSE '❌ INCONSISTENT'
  END as consistency_check
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_received = true
ORDER BY cr.created_at DESC;

-- ============================================================================
-- STEP 5: Test Summary
-- ============================================================================

SELECT
  '=== Test Results Summary ===' as section,
  (SELECT COUNT(*) FROM creator_requests WHERE quote_received = true) as total_quotes,
  (SELECT COUNT(*) FROM creator_requests WHERE quote_status = 'accepted') as accepted_quotes,
  (SELECT COUNT(*) FROM creator_requests WHERE quote_status = 'declined') as declined_quotes,
  (SELECT COUNT(*) FROM creator_requests WHERE quote_status = 'pending') as pending_quotes,
  (SELECT COUNT(*)
   FROM creator_requests cr
   JOIN creator_request_items cri ON cri.request_id = cr.id
   WHERE (cr.quote_status = 'accepted' AND cri.status != 'approved')
      OR (cr.quote_status = 'declined' AND cri.status != 'rejected')
      OR (cr.quote_status = 'pending' AND cri.status IN ('approved', 'rejected'))
  ) as inconsistencies;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
--
-- ✅ RPC function updated successfully
-- ✅ All inconsistent quotes fixed
-- ✅ consistency_check shows all ✅ (no ❌)
-- ✅ inconsistencies count = 0
--
-- Next: Test the webhook by accepting a quote from the UI
-- ============================================================================
