-- Migration: Create sync queue table for Dobble Tap integration
-- Handles failed syncs with retry logic and manual retry capability

CREATE TABLE IF NOT EXISTS public.dobble_tap_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN (
    'activation',
    'activation_update',
    'activation_submission',
    'activation_submission_review',
    'creator_request',
    'creator_request_update',
    'creator_request_invitation'
  )),
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_after TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dobble_tap_sync_queue_status ON public.dobble_tap_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_dobble_tap_sync_queue_retry_after ON public.dobble_tap_sync_queue(retry_after);
CREATE INDEX IF NOT EXISTS idx_dobble_tap_sync_queue_entity ON public.dobble_tap_sync_queue(sync_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dobble_tap_sync_queue_pending ON public.dobble_tap_sync_queue(status, retry_after) 
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.dobble_tap_sync_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access sync queue
DROP POLICY IF EXISTS "Service role can manage sync queue" ON public.dobble_tap_sync_queue;
CREATE POLICY "Service role can manage sync queue"
  ON public.dobble_tap_sync_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.dobble_tap_sync_queue IS 'Queue for failed Dobble Tap sync operations with automatic retry';
COMMENT ON COLUMN public.dobble_tap_sync_queue.sync_type IS 'Type of sync operation';
COMMENT ON COLUMN public.dobble_tap_sync_queue.entity_id IS 'ID of the entity being synced';
COMMENT ON COLUMN public.dobble_tap_sync_queue.payload IS 'Full payload to send to Dobble Tap';
COMMENT ON COLUMN public.dobble_tap_sync_queue.retry_after IS 'When to retry this sync operation';
