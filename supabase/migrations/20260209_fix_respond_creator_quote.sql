-- Fix respond_creator_quote RPC to update quote-specific fields
-- This fixes the issue where accepting/rejecting quotes only updated creator_request_items
-- but not the quote_status, quote_reviewed_at, and quote_reviewed_by fields in creator_requests

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
  -- item status: 'approved' -> quote_status: 'accepted'
  -- item status: 'rejected' -> quote_status: 'declined'
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

-- Add comment explaining the fix
COMMENT ON FUNCTION public.respond_creator_quote IS
'Updated to fix quote workflow: now updates quote_status, quote_reviewed_at, quote_reviewed_by in creator_requests table. Webhook notification should be triggered from client code after RPC succeeds.';
