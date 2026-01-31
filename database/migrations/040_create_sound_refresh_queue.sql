-- Create sound refresh queue table for background processing
CREATE TABLE IF NOT EXISTS public.sound_refresh_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_id UUID NOT NULL REFERENCES public.sounds(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'ingest' CHECK (action IN ('ingest', 'refresh')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INT DEFAULT 0,
  error_message TEXT,
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_status ON public.sound_refresh_queue(status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_priority ON public.sound_refresh_queue(priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_next_retry ON public.sound_refresh_queue(next_retry_at)
  WHERE status = 'failed' AND attempt_count < max_attempts;

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_sound_id ON public.sound_refresh_queue(sound_id);

-- Create trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_sound_refresh_queue_updated_at'
  ) THEN
    CREATE FUNCTION update_sound_refresh_queue_updated_at()
    RETURNS TRIGGER AS $inner$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $inner$ LANGUAGE plpgsql;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sound_refresh_queue_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_sound_refresh_queue_updated_at_trigger BEFORE UPDATE ON public.sound_refresh_queue
      FOR EACH ROW EXECUTE FUNCTION update_sound_refresh_queue_updated_at();
  END IF;
END
$$;

-- Enable RLS
ALTER TABLE public.sound_refresh_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Service role only (background workers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sound_refresh_queue' AND policyname='Service role can manage queue'
  ) THEN
    CREATE POLICY "Service role can manage queue"
      ON public.sound_refresh_queue
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
