-- Fix ALL Inconsistent Quote Status Data
-- This finds all quotes where creator_request_items.status = 'approved'
-- but creator_requests.quote_status is still 'pending'

-- First, let's see what will be fixed (dry run)
SELECT
  cr.id as request_id,
  cr.quote_status as current_quote_status,
  cri.status as item_status,
  cri.updated_at as item_updated_at,
  cri.quoted_amount_cents,
  c.name as creator_name,
  CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    ELSE cr.quote_status
  END as new_quote_status
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cri.status IN ('approved', 'rejected')
  AND cr.quote_status = 'pending';

-- Now fix them all
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

-- Verify the fix
SELECT
  cr.id as request_id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_status IN ('accepted', 'declined')
ORDER BY cr.quote_reviewed_at DESC;
