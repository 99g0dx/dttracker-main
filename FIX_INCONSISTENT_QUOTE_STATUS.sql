-- Fix Inconsistent Quote Status Data
-- This quote has creator_request_items.status = 'approved'
-- but creator_requests.quote_status = 'pending'

-- Update the creator_requests table to match the approved item
UPDATE creator_requests cr
SET
  quote_status = 'accepted',
  quote_reviewed_at = cri.updated_at,
  updated_at = NOW()
FROM creator_request_items cri
WHERE cr.id = cri.request_id
  AND cr.id = '98821366-cb11-46e9-a1b5-c07fabde8664'
  AND cri.status = 'approved'
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
WHERE cr.id = '98821366-cb11-46e9-a1b5-c07fabde8664';
