-- Allow suggested status for creator requests

ALTER TABLE public.creator_requests
  DROP CONSTRAINT IF EXISTS creator_requests_status_check;

ALTER TABLE public.creator_requests
  ADD CONSTRAINT creator_requests_status_check
  CHECK (status IN (
    'suggested',
    'submitted',
    'reviewing',
    'quoted',
    'approved',
    'in_fulfillment',
    'delivered'
  ));
