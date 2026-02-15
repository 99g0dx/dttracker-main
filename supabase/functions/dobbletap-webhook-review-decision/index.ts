import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  ACCEPTED_ID_KEYS,
  getLookupId,
  resolveSubmissionId,
  log404Payload,
} from '../_shared/dttracker-webhook-lookup.ts';

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

    const lookupId = getLookupId(data);
    if (!eventType || !timestamp || !data || !lookupId || !data.decision) {
      return new Response(JSON.stringify({
        error: 'Missing required fields (need one of ' + ACCEPTED_ID_KEYS.join(', ') + ' and decision)',
        required: [...ACCEPTED_ID_KEYS],
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
    const idempotencyKey = `${lookupId}-${eventType}-${timestamp}`;
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

    const isApproved = data.decision === 'approved' || data.decision === 'approved_with_notes';

    const resolved = await resolveSubmissionId(supabase, data);
    if (!resolved) {
      log404Payload('dobbletap-webhook-review-decision', data, lookupId);
      return new Response(JSON.stringify({
        error: 'Submission not found',
        event_id: webhookEvent?.id,
        status: 'submission_not_found',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { resolvedSubmissionId } = resolved;

    const payloadHandle =
      data.creatorHandle ||
      data.creatorUsername ||
      data.creatorName ||
      data.creator_handle ||
      null;
    const creatorHandle =
      typeof payloadHandle === 'string'
        ? payloadHandle.replace(/^@/, '').trim() || null
        : null;

    const submissionUpdate: Record<string, unknown> = {
      review_decision: data.decision,
      review_feedback: data.feedback || null,
      reviewer_type: data.reviewerType || null,
      reviewed_by: data.reviewedBy || null,
      reviewed_at: timestamp,
      status: isApproved ? 'approved' : 'rejected',
      dobble_tap_review_id: data.reviewId || null,
    };
    if (creatorHandle) submissionUpdate.creator_handle = creatorHandle;

    // Update submission with review decision (by resolved id)
    const { data: submission, error: submissionError } = await supabase
      .from('activation_submissions')
      .update(submissionUpdate)
      .eq('id', resolvedSubmissionId)
      .select()
      .single();

    if (submissionError) {
      console.error('dobbletap-webhook-review-decision: Failed to update submission', submissionError);
      throw submissionError;
    }

    // When approved: set payment_amount and release from locked budget (deduct, pay creator)
    if (isApproved && submission?.activation_id) {
      const { data: activation } = await supabase
        .from('activations')
        .select('base_rate, payment_per_action')
        .eq('id', submission.activation_id)
        .maybeSingle();

      const paymentFromPayload = data.paymentAmount != null
        ? Number(data.paymentAmount) / 100
        : data.amount != null
          ? Number(data.amount)
          : null;
      const paymentAmount = paymentFromPayload ?? (activation?.base_rate != null ? Number(activation.base_rate) : null) ?? (activation?.payment_per_action != null ? Number(activation.payment_per_action) : 0);

      if (paymentAmount > 0) {
        await supabase
          .from('activation_submissions')
          .update({ payment_amount: paymentAmount })
          .eq('id', submission.id);

        const { error: releaseError } = await supabase.rpc('release_sm_panel_payment', {
          p_submission_id: submission.id,
          p_payment_amount: paymentAmount,
        });
        if (releaseError) {
          console.error('dobbletap-webhook-review-decision: release_sm_panel_payment error', releaseError);
        } else {
          // Update activation progress: spent_amount
          const { data: act } = await supabase
            .from('activations')
            .select('spent_amount')
            .eq('id', submission.activation_id)
            .single();
          if (act) {
            const newSpent = (Number(act.spent_amount) || 0) + paymentAmount;
            await supabase
              .from('activations')
              .update({
                spent_amount: newSpent,
                updated_at: new Date().toISOString(),
              })
              .eq('id', submission.activation_id);
          }
        }
      }
    }

    console.log('dobbletap-webhook-review-decision: Successfully processed', {
      lookupId,
      resolvedSubmissionId,
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
