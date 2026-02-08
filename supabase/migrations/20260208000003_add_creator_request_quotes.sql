-- Add quote tracking fields to creator_requests table
-- Migration: 20260208000003_add_creator_request_quotes.sql
-- Purpose: Track creator quotes when they respond to requests

-- Add quote tracking columns
ALTER TABLE public.creator_requests
ADD COLUMN IF NOT EXISTS quote_received BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quoted_amount INTEGER,
ADD COLUMN IF NOT EXISTS creator_response_message TEXT,
ADD COLUMN IF NOT EXISTS quote_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS quote_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quote_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quote_reviewed_by UUID;

-- Add constraint for quote_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_requests_quote_status_check'
  ) THEN
    ALTER TABLE public.creator_requests
    ADD CONSTRAINT creator_requests_quote_status_check
    CHECK (quote_status IN ('pending', 'accepted', 'declined', 'countered'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.creator_requests.quote_received IS
  'True when creator has responded with a quote';

COMMENT ON COLUMN public.creator_requests.quoted_amount IS
  'Amount quoted by creator in Naira (kobo for precision)';

COMMENT ON COLUMN public.creator_requests.creator_response_message IS
  'Message from creator when responding to request';

COMMENT ON COLUMN public.creator_requests.quote_status IS
  'Status of quote: pending (awaiting review), accepted (brand accepted), declined (brand declined), countered (brand sent counter-offer)';

COMMENT ON COLUMN public.creator_requests.quote_received_at IS
  'Timestamp when creator submitted quote';

COMMENT ON COLUMN public.creator_requests.quote_reviewed_at IS
  'Timestamp when brand reviewed the quote';

COMMENT ON COLUMN public.creator_requests.quote_reviewed_by IS
  'User ID of brand member who reviewed quote';

-- Create index for filtering by quote status
CREATE INDEX IF NOT EXISTS idx_creator_requests_quote_status
  ON public.creator_requests(quote_status)
  WHERE quote_received = true;

-- Create index for pending quotes
CREATE INDEX IF NOT EXISTS idx_creator_requests_pending_quotes
  ON public.creator_requests(user_id, quote_received, quote_status)
  WHERE quote_received = true AND quote_status = 'pending';
