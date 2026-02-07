import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify bearer token
    const syncApiKey = Deno.env.get('SYNC_API_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!syncApiKey || authHeader !== `Bearer ${syncApiKey}`) {
      console.error('dobbletap-webhook-submission: Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse and validate payload
    const body = await req.json();
    const { eventType, timestamp, data } = body;

    if (!eventType || !timestamp || !data) {
      console.error('dobbletap-webhook-submission: Missing required fields', { body });
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['eventType', 'timestamp', 'data']
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required data fields
    if (!data.creatorCampaignId || !data.assetId || !data.submittedBy) {
      console.error('dobbletap-webhook-submission: Missing required data fields', { data });
      return new Response(JSON.stringify({
        error: 'Missing required data fields',
        required: ['creatorCampaignId', 'assetId', 'submittedBy']
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Check idempotency
    const idempotencyKey = `${data.creatorCampaignId}-${eventType}-${timestamp}`;

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, processed_at')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      console.log('dobbletap-webhook-submission: Already processed', { idempotencyKey });
      return new Response(JSON.stringify({
        id: existingEvent.id,
        status: 'already_processed',
        processed_at: existingEvent.processed_at
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Store webhook event
    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: eventType,
        campaign_id: data.creatorCampaignId,
        timestamp: timestamp,
        payload: body,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (webhookError) {
      console.error('dobbletap-webhook-submission: Failed to store webhook event', webhookError);
      throw webhookError;
    }

    // 6. Check if submission already exists
    const { data: existingSubmission } = await supabase
      .from('activation_submissions')
      .select('id')
      .eq('dobble_tap_submission_id', data.assetId)
      .maybeSingle();

    let submission;
    if (existingSubmission) {
      // Update existing submission
      const { data: updated, error: updateError } = await supabase
        .from('activation_submissions')
        .update({
          asset_url: data.assetUrl || null,
          asset_version: data.version || 1,
          submitted_note: data.note || null,
          submitted_at: data.submittedAt || timestamp,
        })
        .eq('id', existingSubmission.id)
        .select()
        .single();

      if (updateError) throw updateError;
      submission = updated;
    } else {
      // Check if activation exists before creating submission (to avoid foreign key constraint error)
      const { data: existingActivation } = await supabase
        .from('activations')
        .select('id')
        .eq('id', data.creatorCampaignId)
        .maybeSingle();

      if (!existingActivation) {
        console.warn('dobbletap-webhook-submission: Activation not found', {
          activationId: data.creatorCampaignId,
        });
        return new Response(JSON.stringify({
          error: 'Activation not found',
          event_id: webhookEvent.id,
          status: 'activation_not_found',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create new submission
      const submissionData = {
        activation_id: data.creatorCampaignId,
        creator_id: data.submittedBy,
        dobble_tap_submission_id: data.assetId,
        asset_url: data.assetUrl || null,
        asset_version: data.version || 1,
        submitted_note: data.note || null,
        submitted_at: data.submittedAt || timestamp,
        status: 'pending',
        synced_to_dobble_tap: true,
      };

      const { data: created, error: createError } = await supabase
        .from('activation_submissions')
        .insert(submissionData)
        .select()
        .single();

      if (createError) throw createError;
      submission = created;
    }

    const submissionError = null; // For backwards compatibility

    if (submissionError) {
      console.error('dobbletap-webhook-submission: Failed to upsert submission', submissionError);
      throw submissionError;
    }

    console.log('dobbletap-webhook-submission: Successfully processed', {
      eventType,
      submissionId: submission.id,
      assetId: data.assetId,
    });

    // 7. Return success
    return new Response(JSON.stringify({
      id: submission.id,
      status: 'received',
      event_id: webhookEvent.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('dobbletap-webhook-submission error:', err);
    return new Response(JSON.stringify({
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
