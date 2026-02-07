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

    if (!eventType || !timestamp || !data || !data.verificationStatus) {
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

    const submissionId = data.submissionId || data.entryId;
    const idempotencyKey = `${submissionId}-${eventType}-${timestamp}`;

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
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
        campaign_id: data.campaignId || null,
        timestamp: timestamp,
        payload: body,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    // Check if submission exists first (to avoid foreign key constraint error)
    const { data: existingSubmission } = await supabase
      .from('activation_submissions')
      .select('id')
      .eq('id', submissionId)
      .maybeSingle();

    if (!existingSubmission) {
      console.warn('dobbletap-webhook-verification-completed: Submission not found', {
        submissionId,
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

    // Store verification results
    const { data: verification, error: verificationError } = await supabase
      .from('verification_results')
      .insert({
        submission_id: submissionId,
        verification_type: data.verificationType,
        status: data.verificationStatus,
        results: data.verificationResults || {},
        verified_at: data.verifiedAt || timestamp,
        dobble_tap_verification_id: data.verificationId || null,
      })
      .select()
      .single();

    if (verificationError) {
      console.error('dobbletap-webhook-verification-completed: Failed to store verification', verificationError);
      throw verificationError;
    }

    // Update submission status based on verification
    if (data.verificationStatus === 'verified') {
      await supabase
        .from('activation_submissions')
        .update({
          verification_method: data.verificationType,
          verified_at: data.verifiedAt || timestamp,
          status: 'approved',
          performance_metrics: data.verificationResults?.metrics || null,
        })
        .eq('id', submissionId);
    }

    console.log('dobbletap-webhook-verification-completed: Successfully processed', {
      submissionId,
      verificationType: data.verificationType,
      status: data.verificationStatus,
    });

    return new Response(JSON.stringify({
      id: verification.id,
      status: 'recorded',
      event_id: webhookEvent?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('dobbletap-webhook-verification-completed error:', err);
    return new Response(JSON.stringify({
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
