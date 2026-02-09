-- Check Quote Statuses and Webhook Updates
-- Run this in Supabase Dashboard > SQL Editor

-- Query 1: Check recent quotes with all details
SELECT
  cr.id as request_id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.quote_reviewed_by,
  cr.dobble_tap_request_id,
  cri.id as item_id,
  cri.status as item_status,
  cri.quoted_amount_cents,
  cri.quoted_currency,
  cri.quoted_at,
  c.name as creator_name,
  c.handle as creator_handle,
  c.dobble_tap_user_id
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_received = true
ORDER BY cr.quote_received_at DESC
LIMIT 10;

-- Query 2: Check only accepted/declined quotes (to verify webhook worked)
SELECT
  cr.id as request_id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.dobble_tap_request_id,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_status IN ('accepted', 'declined')
ORDER BY cr.quote_reviewed_at DESC
LIMIT 10;

-- Query 2b: Find inconsistent data (items approved but request still pending)
SELECT
  cr.id as request_id,
  cr.quote_status as request_status,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name,
  cri.updated_at as item_updated_at
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cri.status IN ('approved', 'accepted')
  AND cr.quote_status = 'pending'
ORDER BY cri.updated_at DESC;

-- Query 3: Count quotes by status
SELECT
  cr.quote_status,
  COUNT(*) as count
FROM creator_requests cr
WHERE cr.quote_received = true
GROUP BY cr.quote_status
ORDER BY count DESC;
