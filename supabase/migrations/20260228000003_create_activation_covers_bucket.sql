-- Create storage bucket for contest/activation cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('activation-covers', 'activation-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to activation-covers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload activation covers'
  ) THEN
    CREATE POLICY "Authenticated users can upload activation covers"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'activation-covers');
  END IF;
END
$$;

-- Users can update their own activation covers (path: user_id/filename)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update their own activation covers'
  ) THEN
    CREATE POLICY "Users can update their own activation covers"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'activation-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END
$$;

-- Users can delete their own activation covers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete their own activation covers'
  ) THEN
    CREATE POLICY "Users can delete their own activation covers"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'activation-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END
$$;

-- Public can view activation covers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Activation covers are publicly accessible'
  ) THEN
    CREATE POLICY "Activation covers are publicly accessible"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'activation-covers');
  END IF;
END
$$;
