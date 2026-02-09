-- Comprehensive verification of all quote statuses

-- Query 1: Show all quotes with their statuses
SELECT
  '=== All Quotes Detail ===' as section,
  cr.id as request_id,
  cr.quote_status,
  cr.quote_received,
  cr.quote_reviewed_at,
  cr.quote_reviewed_by,
  cr.status as overall_status,
  cri.id as item_id,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name,
  c.handle,
  -- Consistency check
  CASE
    WHEN cr.quote_status = 'accepted' AND cri.status = 'approved' THEN '✅ Consistent'
    WHEN cr.quote_status = 'declined' AND cri.status = 'rejected' THEN '✅ Consistent'
    WHEN cr.quote_status = 'pending' AND cri.status IN ('quoted', 'pending') THEN '✅ Consistent'
    ELSE '❌ INCONSISTENT - FIX NEEDED'
  END as consistency,
  -- Show what the fix should be
  CASE
    WHEN cr.quote_status != CASE
      WHEN cri.status = 'approved' THEN 'accepted'
      WHEN cri.status = 'rejected' THEN 'declined'
      WHEN cri.status = 'quoted' THEN 'pending'
      ELSE cr.quote_status
    END THEN 'Should be: ' || CASE
      WHEN cri.status = 'approved' THEN 'accepted'
      WHEN cri.status = 'rejected' THEN 'declined'
      WHEN cri.status = 'quoted' THEN 'pending'
      ELSE cri.status
    END
    ELSE 'OK'
  END as recommended_fix
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_received = true
ORDER BY
  CASE
    WHEN NOT (
      (cr.quote_status = 'accepted' AND cri.status = 'approved')
      OR (cr.quote_status = 'declined' AND cri.status = 'rejected')
      OR (cr.quote_status = 'pending' AND cri.status IN ('quoted', 'pending'))
    ) THEN 0
    ELSE 1
  END,
  cr.created_at DESC;

-- Query 2: Summary by status
SELECT
  '=== Summary by Status ===' as section,
  cr.quote_status,
  COUNT(*) as count,
  COUNT(DISTINCT cr.id) as unique_requests,
  STRING_AGG(DISTINCT cri.status, ', ') as item_statuses_seen
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
WHERE cr.quote_received = true
GROUP BY cr.quote_status
ORDER BY count DESC;

-- Query 3: Inconsistencies count
SELECT
  '=== Inconsistency Report ===' as section,
  COUNT(*) as total_quote_items,
  COUNT(*) FILTER (WHERE
    (cr.quote_status = 'accepted' AND cri.status = 'approved')
    OR (cr.quote_status = 'declined' AND cri.status = 'rejected')
    OR (cr.quote_status = 'pending' AND cri.status IN ('quoted', 'pending'))
  ) as consistent_items,
  COUNT(*) FILTER (WHERE
    (cr.quote_status = 'accepted' AND cri.status != 'approved')
    OR (cr.quote_status = 'declined' AND cri.status != 'rejected')
    OR (cr.quote_status = 'pending' AND cri.status IN ('approved', 'rejected'))
  ) as inconsistent_items,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE
      (cr.quote_status = 'accepted' AND cri.status = 'approved')
      OR (cr.quote_status = 'declined' AND cri.status = 'rejected')
      OR (cr.quote_status = 'pending' AND cri.status IN ('quoted', 'pending'))
    ) / NULLIF(COUNT(*), 0),
    2
  ) as consistency_percentage
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
WHERE cr.quote_received = true;

-- Query 4: Specific inconsistencies
SELECT
  '=== Specific Inconsistencies to Fix ===' as section,
  cr.id,
  cr.quote_status as current_request_status,
  cri.status as current_item_status,
  CASE
    WHEN cri.status = 'approved' THEN 'accepted'
    WHEN cri.status = 'rejected' THEN 'declined'
    WHEN cri.status = 'quoted' THEN 'pending'
    ELSE cri.status
  END as should_be_request_status,
  c.name as creator_name
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_received = true
  AND (
    (cr.quote_status = 'accepted' AND cri.status != 'approved')
    OR (cr.quote_status = 'declined' AND cri.status != 'rejected')
    OR (cr.quote_status = 'pending' AND cri.status IN ('approved', 'rejected'))
  );
