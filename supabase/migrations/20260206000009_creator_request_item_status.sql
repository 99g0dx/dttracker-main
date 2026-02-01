-- Add per-creator status for request items

ALTER TABLE public.creator_request_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted', 'rejected', 'quoted', 'approved'));

CREATE INDEX IF NOT EXISTS idx_creator_request_items_status
  ON public.creator_request_items(status);
