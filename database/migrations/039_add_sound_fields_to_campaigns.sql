-- Add sound tracking fields to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS sound_url TEXT,
ADD COLUMN IF NOT EXISTS sound_id UUID REFERENCES public.sounds(id) ON DELETE SET NULL;

-- Add index for sound lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_sound_id ON public.campaigns(sound_id);

-- Add comments explaining the fields
COMMENT ON COLUMN public.campaigns.sound_url IS 'Original URL used to add the sound (for reference)';
COMMENT ON COLUMN public.campaigns.sound_id IS 'Foreign key to sounds table - the sound being tracked for this campaign';
