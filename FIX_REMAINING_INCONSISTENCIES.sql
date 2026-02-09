-- Fix the 4 remaining inconsistencies
-- First, let's see what they are

SELECT
  '=== Remaining Inconsistencies ===' as section,
  cr.id as request_id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.status as request_status,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name,
  c.handle as creator_handle
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE (
  (cr.quote_status = 'accepted' AND cri.status != 'approved')
  OR (cr.quote_status = 'declined' AND cri.status != 'rejected')
  OR (cr.quote_status = 'pending' AND cri.status IN ('approved', 'rejected'))
)
ORDER BY cr.created_at DESC;

-- Fix them based on the actual item status (item status is source of truth)
UPDATE creator_requests cr
SET
  quote_status = CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
    ELSE cr.quote_status
  END,
  quote_reviewed_at = CASE
    WHEN cri.status IN ('approved', 'rejected') THEN COALESCE(cr.quote_reviewed_at, cri.updated_at)
    ELSE cr.quote_reviewed_at
  END,
  updated_at = NOW()
FROM creator_request_items cri
WHERE cr.id = cri.request_id
  AND (
    (cr.quote_status = 'accepted' AND cri.status != 'approved')
    OR (cr.quote_status = 'declined' AND cri.status != 'rejected')
    OR (cr.quote_status = 'pending' AND cri.status IN ('approved', 'rejected'))
  );

-- Verify all fixed
SELECT
  '=== After Fix ===' as section,
  COUNT(*) FILTER (WHERE
    (cr.quote_status = 'accepted' AND cri.status != 'approved')
    OR (cr.quote_status = 'declined' AND cri.status != 'rejected')
    OR (cr.quote_status = 'pending' AND cri.status IN ('approved', 'rejected'))
  ) as remaining_inconsistencies
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id;

-- Should return 0
