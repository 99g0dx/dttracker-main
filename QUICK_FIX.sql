-- Quick Fix: Update the 4 inconsistent quotes
-- This is a simplified version that just fixes them

-- Show what will be fixed
SELECT
  cr.id as request_id,
  cr.quote_status as current,
  cri.status as item_status,
  CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
  END as should_be,
  c.name as creator
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_received = true
  AND cr.quote_status != CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
    ELSE cr.quote_status
  END;

-- Fix them
UPDATE creator_requests cr
SET
  quote_status = CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
    ELSE cr.quote_status
  END,
  quote_reviewed_at = CASE
    WHEN cri.status IN ('approved', 'rejected') AND cr.quote_reviewed_at IS NULL
      THEN cri.updated_at
    ELSE cr.quote_reviewed_at
  END,
  updated_at = NOW()
FROM creator_request_items cri
WHERE cr.id = cri.request_id
  AND cr.quote_received = true
  AND cr.quote_status != CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
    ELSE cr.quote_status
  END;

-- Verify: should return 0
SELECT COUNT(*) as remaining_inconsistencies
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
WHERE cr.quote_received = true
  AND cr.quote_status != CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
    ELSE cr.quote_status
  END;
