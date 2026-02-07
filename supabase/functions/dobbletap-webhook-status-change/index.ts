import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source',
};

// Map Dobbletap status to DTTracker status
const statusMap: Record<string, string> = {
  'accepted': 'live',
  'declined': 'cancelled',
  'in_progress': 'live',
  'submitted': 'live',
  'completed': 'completed',
  'cancelled': 'cancelled',
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

    if (!eventType || !timestamp || !data || !data.newStatus) {
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

    // Get current activation to append to status_history
    const { data: currentActivation } = await supabase
      .from('activations')
      .select('status_history')
      .eq('dobble_tap_campaign_id', data.creatorCampaignId)
      .maybeSingle();

    const currentHistory = currentActivation?.status_history || [];
    const newHistoryEntry = {
      old_status: data.oldStatus,
      new_status: data.newStatus,
      changed_by: data.changedBy,
      changed_at: timestamp,
    };

    // Update activation status
    const { data: activation, error: activationError } = await supabase
      .from('activations')
      .update({
        status: statusMap[data.newStatus] || data.newStatus,
        status_history: [...currentHistory, newHistoryEntry],
      })
      .eq('dobble_tap_campaign_id', data.creatorCampaignId)
      .select()
      .maybeSingle();

    if (activationError) {
      console.error('dobbletap-webhook-status-change: Failed to update activation', activationError);
      throw activationError;
    }

    if (!activation) {
      console.warn('dobbletap-webhook-status-change: Activation not found', {
        campaignId: data.creatorCampaignId,
      });
      return new Response(JSON.stringify({
        error: 'Activation not found',
        event_id: webhookEvent?.id,
        status: 'activation_not_found',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('dobbletap-webhook-status-change: Successfully processed', {
      campaignId: data.creatorCampaignId,
      newStatus: data.newStatus,
    });

    return new Response(JSON.stringify({
      id: activation.id,
      status: 'updated',
      event_id: webhookEvent?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('dobbletap-webhook-status-change error:', err);
    return new Response(JSON.stringify({
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
