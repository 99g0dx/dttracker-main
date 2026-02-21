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

    if (!eventType || !timestamp || !data || !data.status) {
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

    const idempotencyKey = `${data.creatorCampaignId}-${eventType}-${timestamp}`;

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
        campaign_id: data.creatorCampaignId,
        timestamp: timestamp,
        payload: body,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    // Update all submissions for this activation (campaign) with completion data.
    // data.creatorCampaignId is the activation-level ID — query by activation_id.
    const { data: submissions, error: submissionError } = await supabase
      .from('activation_submissions')
      .update({
        completion_status: data.status,
        payment_amount: data.paymentAmount ? data.paymentAmount / 100 : null, // Convert kobo to naira
        payment_currency: data.paymentCurrency || 'NGN',
        payment_reference: data.paymentReference || null,
        paid_at: data.status === 'completed' ? (data.completedAt || timestamp) : null,
        failure_reason: data.failureReason || null,
        status: data.status === 'completed' ? 'approved' : 'rejected',
      })
      .eq('activation_id', data.creatorCampaignId)
      .select();

    if (submissionError) {
      console.error('dobbletap-webhook-campaign-completed: Failed to update submissions', submissionError);
      throw submissionError;
    }

    const submission = submissions?.[0] ?? null;

    if (!submission) {
      console.warn('dobbletap-webhook-campaign-completed: No submissions found for activation', {
        activationId: data.creatorCampaignId,
      });
      return new Response(JSON.stringify({
        error: 'No submissions found for activation',
        event_id: webhookEvent?.id,
        status: 'submission_not_found',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update activation spent amount if completed
    if (data.status === 'completed' && data.paymentAmount && submission.activation_id) {
      const { data: activation } = await supabase
        .from('activations')
        .select('spent_amount')
        .eq('id', submission.activation_id)
        .maybeSingle();

      if (activation) {
        await supabase
          .from('activations')
          .update({
            spent_amount: (activation.spent_amount || 0) + (data.paymentAmount / 100),
          })
          .eq('id', submission.activation_id);
      }
    }

    console.log('dobbletap-webhook-campaign-completed: Successfully processed', {
      campaignId: data.creatorCampaignId,
      status: data.status,
      amount: data.paymentAmount,
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
    console.error('dobbletap-webhook-campaign-completed error:', err);
    return new Response(JSON.stringify({
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
