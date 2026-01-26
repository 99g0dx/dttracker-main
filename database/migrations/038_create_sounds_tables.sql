-- Create sounds table
CREATE TABLE IF NOT EXISTS public.sounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  canonical_sound_key TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  source TEXT,
  sound_page_url TEXT,
  last_crawled_at TIMESTAMPTZ,
  indexing_state TEXT NOT NULL DEFAULT 'queued' CHECK (indexing_state IN ('queued', 'indexing', 'active', 'failed')),
  geo_estimated JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sounds_unique_per_platform UNIQUE(platform, canonical_sound_key)
);

-- Create sound_videos table
CREATE TABLE IF NOT EXISTS public.sound_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_id UUID NOT NULL REFERENCES public.sounds(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  creator_handle TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  posted_at TIMESTAMPTZ,
  bucket TEXT DEFAULT 'top' CHECK (bucket IN ('top', 'recent', 'trending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sound_videos_unique UNIQUE(sound_id, video_id)
);

-- Create indexes for performance
CREATE INDEX idx_sounds_user_id ON public.sounds(user_id);
CREATE INDEX idx_sounds_platform_key ON public.sounds(platform, canonical_sound_key);
CREATE INDEX idx_sounds_last_crawled ON public.sounds(last_crawled_at);
CREATE INDEX idx_sound_videos_sound_id ON public.sound_videos(sound_id);
CREATE INDEX idx_sound_videos_views ON public.sound_videos(views DESC);
CREATE INDEX idx_sound_videos_engagement ON public.sound_videos(engagement_rate DESC);
CREATE INDEX idx_sound_videos_posted_at ON public.sound_videos(posted_at DESC);

-- Enable RLS
ALTER TABLE public.sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sounds - users can only access their own sounds
CREATE POLICY "Users can view their own sounds"
  ON public.sounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sounds"
  ON public.sounds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sounds"
  ON public.sounds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sounds"
  ON public.sounds FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sound_videos - inherit access from parent sound
CREATE POLICY "Users can view videos from their sounds"
  ON public.sound_videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sounds
      WHERE sounds.id = sound_videos.sound_id
      AND sounds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert videos to their sounds"
  ON public.sound_videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sounds
      WHERE sounds.id = sound_videos.sound_id
      AND sounds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update videos from their sounds"
  ON public.sound_videos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sounds
      WHERE sounds.id = sound_videos.sound_id
      AND sounds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete videos from their sounds"
  ON public.sound_videos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sounds
      WHERE sounds.id = sound_videos.sound_id
      AND sounds.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_sounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sounds_updated_at_trigger BEFORE UPDATE ON public.sounds
  FOR EACH ROW EXECUTE FUNCTION update_sounds_updated_at();

CREATE TRIGGER update_sound_videos_updated_at_trigger BEFORE UPDATE ON public.sound_videos
  FOR EACH ROW EXECUTE FUNCTION update_sounds_updated_at();
