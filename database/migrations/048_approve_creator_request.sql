-- Approve creator request and attach creators to campaign (company admin only)

CREATE OR REPLACE FUNCTION public.approve_creator_request(request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO req_record
  FROM public.creator_requests
  WHERE id = request_id;

  IF req_record IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  UPDATE public.creator_requests
  SET status = 'approved', updated_at = now()
  WHERE id = request_id;

  IF req_record.campaign_id IS NULL THEN
    RETURN jsonb_build_object('status', 'approved', 'inserted', 0);
  END IF;

  INSERT INTO public.campaign_creators (campaign_id, creator_id)
  SELECT req_record.campaign_id, cri.creator_id
  FROM public.creator_request_items cri
  WHERE cri.request_id = request_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN jsonb_build_object('status', 'approved', 'inserted', inserted_count);
END;
$$;
