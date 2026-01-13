-- ============================================================
-- Add DELETE Policy for Creator Requests
-- ============================================================
-- This allows users to delete their own creator requests
-- ============================================================

-- DELETE (users can delete their own requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_requests'
      AND policyname='Users can delete their own creator requests'
  ) THEN
    CREATE POLICY "Users can delete their own creator requests"
      ON public.creator_requests FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;
