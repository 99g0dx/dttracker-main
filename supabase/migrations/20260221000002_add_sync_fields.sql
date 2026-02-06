-- Migration: Add sync fields to activation_submissions and creator_requests

-- Add sync fields to activation_submissions
ALTER TABLE public.activation_submissions
  ADD COLUMN IF NOT EXISTS synced_to_dobble_tap BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dobble_tap_submission_id UUID,
  ADD COLUMN IF NOT EXISTS dobble_tap_review_id UUID;

-- Add sync fields to creator_requests
ALTER TABLE public.creator_requests
  ADD COLUMN IF NOT EXISTS synced_to_dobble_tap BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dobble_tap_request_id UUID;

-- Add sync fields to creator_request_invitations
ALTER TABLE public.creator_request_invitations
  ADD COLUMN IF NOT EXISTS synced_to_dobble_tap BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dobble_tap_invitation_id UUID;

-- Create indexes for sync lookups
CREATE INDEX IF NOT EXISTS idx_activation_submissions_dobble_tap ON public.activation_submissions(dobble_tap_submission_id) 
  WHERE dobble_tap_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_requests_dobble_tap ON public.creator_requests(dobble_tap_request_id) 
  WHERE dobble_tap_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_request_invitations_dobble_tap ON public.creator_request_invitations(dobble_tap_invitation_id) 
  WHERE dobble_tap_invitation_id IS NOT NULL;

COMMENT ON COLUMN public.activation_submissions.synced_to_dobble_tap IS 'Whether submission has been synced to Dobble Tap';
COMMENT ON COLUMN public.activation_submissions.dobble_tap_submission_id IS 'ID of submission in Dobble Tap';
COMMENT ON COLUMN public.activation_submissions.dobble_tap_review_id IS 'ID of review in Dobble Tap (if reviewed)';
COMMENT ON COLUMN public.creator_requests.synced_to_dobble_tap IS 'Whether creator request has been synced to Dobble Tap';
COMMENT ON COLUMN public.creator_requests.dobble_tap_request_id IS 'ID of creator request in Dobble Tap';
COMMENT ON COLUMN public.creator_request_invitations.synced_to_dobble_tap IS 'Whether invitation has been synced to Dobble Tap';
COMMENT ON COLUMN public.creator_request_invitations.dobble_tap_invitation_id IS 'ID of invitation in Dobble Tap';
