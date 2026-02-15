ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS image_url TEXT;
