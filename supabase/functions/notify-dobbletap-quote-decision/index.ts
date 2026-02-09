import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('notify-dobbletap-quote-decision: Starting');

    // Get the authorization header (Supabase automatically verifies JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Request authenticated with JWT');

    // Initialize Supabase client with service role for database access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const body = await req.json();
    console.log('Received payload:', body);

    const {
      request_id,
      creator_id,
      decision,
      quoted_amount,
      reviewed_by,
      reviewed_at
    } = body;

    // Validate required fields
    if (!request_id || !creator_id || !decision) {
      console.error('Missing required fields:', { request_id, creator_id, decision });
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['request_id', 'creator_id', 'decision']
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch request details to get dobble_tap_request_id
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('creator_requests')
      .select('dobble_tap_request_id')
      .eq('id', request_id)
      .maybeSingle();

    if (requestError || !requestData) {
      console.error('Failed to fetch request:', requestError);
      return new Response(
        JSON.stringify({
          error: 'Request not found',
          request_id
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch creator details to get dobble_tap_user_id
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('dobble_tap_user_id')
      .eq('id', creator_id)
      .maybeSingle();

    if (creatorError || !creatorData) {
      console.error('Failed to fetch creator:', creatorError);
      return new Response(
        JSON.stringify({
          error: 'Creator not found',
          creator_id
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Prepare webhook payload for Dobbletap
    const webhookPayload = {
      eventType: 'quote_reviewed',
      timestamp: reviewed_at || new Date().toISOString(),
      data: {
        dobble_tap_request_id: requestData.dobble_tap_request_id,
        dobble_tap_creator_id: creatorData.dobble_tap_user_id,
        decision: decision,
        quoted_amount: quoted_amount,
        reviewed_at: reviewed_at || new Date().toISOString()
      }
    };

    console.log('Sending webhook to Dobbletap:', webhookPayload);

    // Send webhook to Dobbletap
    const DOBBLETAP_WEBHOOK_URL = 'https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker/quote-decision';
    const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY') ?? '';

    const webhookResponse = await fetch(DOBBLETAP_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SYNC_API_KEY}`,
      },
      body: JSON.stringify(webhookPayload)
    });

    const webhookResponseText = await webhookResponse.text();
    console.log('Dobbletap webhook response:', {
      status: webhookResponse.status,
      body: webhookResponseText
    });

    if (!webhookResponse.ok) {
      console.error('Dobbletap webhook failed:', {
        status: webhookResponse.status,
        body: webhookResponseText
      });

      // Don't fail the whole operation - just log the error
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Quote decision processed but Dobbletap notification failed',
          webhook_status: webhookResponse.status,
          webhook_response: webhookResponseText
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Success
    console.log('Dobbletap notified successfully');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dobbletap notified of quote decision',
        webhook_response: webhookResponseText
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('notify-dobbletap-quote-decision error:', err);
    return new Response(
      JSON.stringify({
        error: (err as Error).message,
        detail: 'Failed to notify Dobbletap'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
