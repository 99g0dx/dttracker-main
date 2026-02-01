-- Add per-creator quote support + user approval flow

ALTER TABLE public.creator_request_items
  ADD COLUMN IF NOT EXISTS quoted_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS quoted_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS quote_notes TEXT,
  ADD COLUMN IF NOT EXISTS quoted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_request_items_quote_amount_check'
      AND conrelid = 'public.creator_request_items'::regclass
  ) THEN
    ALTER TABLE public.creator_request_items
      ADD CONSTRAINT creator_request_items_quote_amount_check
      CHECK (quoted_amount_cents IS NULL OR quoted_amount_cents >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_creator_request_items_quoted_by
  ON public.creator_request_items(quoted_by)
  WHERE quoted_by IS NOT NULL;

-- Company admin: set quotes for request items
CREATE OR REPLACE FUNCTION public.company_admin_quote_creator_request(
  target_request_id UUID,
  items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  updated_count INTEGER := 0;
  row_count INTEGER := 0;
  item_creator_id UUID;
  item_amount INTEGER;
  item_currency TEXT;
  item_notes TEXT;
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF items IS NULL OR jsonb_typeof(items) <> 'array' THEN
    RAISE EXCEPTION 'Items payload is required';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    item_creator_id := (item->>'creator_id')::uuid;
    item_amount := NULLIF(item->>'quoted_amount_cents', '')::integer;
    item_currency := COALESCE(NULLIF(item->>'quoted_currency', ''), 'USD');
    item_notes := NULLIF(item->>'quote_notes', '');

    UPDATE public.creator_request_items
    SET quoted_amount_cents = item_amount,
        quoted_currency = item_currency,
        quote_notes = item_notes,
        status = 'quoted',
        quoted_by = auth.uid(),
        quoted_at = now()
    WHERE request_id = target_request_id
      AND creator_id = item_creator_id;

    GET DIAGNOSTICS row_count = ROW_COUNT;
    updated_count := updated_count + row_count;
  END LOOP;

  UPDATE public.creator_requests
  SET status = 'quoted', updated_at = now()
  WHERE id = target_request_id;

  RETURN jsonb_build_object('updated', updated_count);
END;
$$;

-- User: accept or reject a quoted creator
CREATE OR REPLACE FUNCTION public.respond_creator_quote(
  target_request_id UUID,
  target_creator_id UUID,
  decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_record RECORD;
  item_record RECORD;
  approved_count INTEGER := 0;
  quoted_count INTEGER := 0;
  rejected_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT *
  INTO req_record
  FROM public.creator_requests
  WHERE id = target_request_id
    AND user_id = auth.uid();

  IF req_record IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT *
  INTO item_record
  FROM public.creator_request_items
  WHERE request_id = target_request_id
    AND creator_id = target_creator_id;

  IF item_record IS NULL THEN
    RAISE EXCEPTION 'Request item not found';
  END IF;

  IF item_record.status = decision THEN
    RETURN jsonb_build_object('status', decision, 'updated', false);
  END IF;

  UPDATE public.creator_request_items
  SET status = decision
  WHERE request_id = target_request_id
    AND creator_id = target_creator_id;

  IF decision = 'approved' AND req_record.campaign_id IS NOT NULL THEN
    INSERT INTO public.campaign_creators (campaign_id, creator_id)
    VALUES (req_record.campaign_id, target_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'quoted'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*)
  INTO approved_count, quoted_count, rejected_count, total_count
  FROM public.creator_request_items
  WHERE request_id = target_request_id;

  IF approved_count > 0 THEN
    UPDATE public.creator_requests
    SET status = 'approved', updated_at = now()
    WHERE id = target_request_id;
  ELSIF quoted_count > 0 THEN
    UPDATE public.creator_requests
    SET status = 'quoted', updated_at = now()
    WHERE id = target_request_id;
  ELSIF rejected_count = total_count THEN
    UPDATE public.creator_requests
    SET status = 'submitted', updated_at = now()
    WHERE id = target_request_id;
  END IF;

  RETURN jsonb_build_object('status', decision, 'updated', true);
END;
$$;

-- Allow company admins to update requests directly (status changes)
DROP POLICY IF EXISTS creator_requests_update_company_admin ON public.creator_requests;
CREATE POLICY creator_requests_update_company_admin
  ON public.creator_requests FOR UPDATE
  USING (public.is_company_admin())
  WITH CHECK (public.is_company_admin());
