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

    if (!eventType || !timestamp || !data || !data.postUrl) {
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

    const submissionId = data.creatorCampaignId || data.entryId;
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

    // Update submission with post URL
    let submission;
    if (data.entryId) {
      // Contest entry
      const { data: entry, error } = await supabase
        .from('activation_submissions')
        .update({
          post_url: data.postUrl,
          platform: data.platform || null,
          submitted_note: data.note || null,
          status: data.status || 'pending',
        })
        .eq('id', data.entryId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!entry) {
        return new Response(JSON.stringify({
          error: 'Submission not found',
          event_id: webhookEvent?.id,
          status: 'submission_not_found',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      submission = entry;
    } else {
      // Regular submission
      const { data: sub, error } = await supabase
        .from('activation_submissions')
        .update({
          post_url: data.postUrl,
          platform: data.platform || null,
          content_url: data.postUrl,
        })
        .eq('dobble_tap_submission_id', submissionId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!sub) {
        return new Response(JSON.stringify({
          error: 'Submission not found',
          event_id: webhookEvent?.id,
          status: 'submission_not_found',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      submission = sub;
    }

    console.log('dobbletap-webhook-post-submitted: Successfully processed', {
      submissionId: submission.id,
      postUrl: data.postUrl,
    });

    return new Response(JSON.stringify({
      id: submission.id,
      status: 'received',
      event_id: webhookEvent?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('dobbletap-webhook-post-submitted error:', err);
    return new Response(JSON.stringify({
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
