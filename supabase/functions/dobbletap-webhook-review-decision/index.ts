import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const syncApiKey = Deno.env.get('SYNC_API_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!syncApiKey || authHeader !== `Bearer ${syncApiKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { eventType, timestamp, data } = body;

    if (!eventType || !timestamp || !data || !data.assetId || !data.decision) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check idempotency
    const idempotencyKey = `${data.assetId}-${eventType}-${timestamp}`;
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, processed_at')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({
        id: existingEvent.id,
        status: 'already_processed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store webhook event
    const { data: webhookEvent } = await supabase
      .from('webhook_events')
      .insert({
        event_type: eventType,
        campaign_id: data.creatorCampaignId || null,
        timestamp: timestamp,
        payload: body,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    // Update submission with review decision
    const { data: submission, error: submissionError } = await supabase
      .from('activation_submissions')
      .update({
        review_decision: data.decision,
        review_feedback: data.feedback || null,
        reviewer_type: data.reviewerType || null,
        reviewed_by: data.reviewedBy || null,
        reviewed_at: timestamp,
        status: data.decision === 'approved' || data.decision === 'approved_with_notes' ? 'approved' : 'rejected',
        dobble_tap_review_id: data.reviewId || null,
      })
      .eq('dobble_tap_submission_id', data.assetId)
      .select()
      .maybeSingle();

    if (submissionError) {
      console.error('dobbletap-webhook-review-decision: Failed to update submission', submissionError);
      throw submissionError;
    }

    if (!submission) {
      console.warn('dobbletap-webhook-review-decision: Submission not found', {
        assetId: data.assetId,
      });
      return new Response(JSON.stringify({
        error: 'Submission not found',
        event_id: webhookEvent?.id,
        status: 'submission_not_found',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('dobbletap-webhook-review-decision: Successfully processed', {
      assetId: data.assetId,
      decision: data.decision,
    });

    return new Response(JSON.stringify({
      id: submission.id,
      status: 'recorded',
      event_id: webhookEvent?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('dobbletap-webhook-review-decision error:', err);
    return new Response(JSON.stringify({
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
