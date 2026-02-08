import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Verify authentication
    const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!SYNC_API_KEY || authHeader !== `Bearer ${SYNC_API_KEY}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const payload = await req.json();
    const {
      request_id,
      creator_id,
      dobble_tap_creator_id,
      status,
      quoted_amount,
      response_message,
      responded_at
    } = payload;

    console.log('Received creator quote callback:', {
      request_id,
      creator_id,
      status,
      quoted_amount
    });

    // Validate required fields
    if (!request_id || !status) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: request_id, status'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate status
    if (!['accepted', 'declined'].includes(status)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid status. Must be "accepted" or "declined"'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If accepted, require quoted_amount
    if (status === 'accepted' && !quoted_amount) {
      return new Response(
        JSON.stringify({
          error: 'quoted_amount is required when status is "accepted"'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the creator request - try DTTracker ID first, then Dobbletap ID
    let request = null;
    let dttrackerRequestId = request_id;

    // First, try to find by DTTracker request_id
    const { data: requestById, error: requestByIdError } = await supabase
      .from('creator_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();

    if (requestById) {
      request = requestById;
      console.log('Found request by DTTracker ID:', request_id);
    } else {
      // Not found by ID, try to find by Dobbletap request_id
      const { data: requestByDobbletapId, error: requestByDobbletapIdError } = await supabase
        .from('creator_requests')
        .select('*')
        .eq('dobble_tap_request_id', request_id)
        .maybeSingle();

      if (requestByDobbletapId) {
        request = requestByDobbletapId;
        dttrackerRequestId = requestByDobbletapId.id;
        console.log('Mapped Dobbletap request ID to DTTracker request:', {
          dobble_tap_request_id: request_id,
          dttracker_request_id: dttrackerRequestId
        });
      }
    }

    if (!request) {
      console.error('Creator request not found:', { request_id });
      return new Response(
        JSON.stringify({
          error: 'Creator request not found',
          request_id
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update creator request with quote
    const updateData: any = {
      quote_received: true,
      quote_received_at: responded_at || new Date().toISOString(),
      creator_response_message: response_message,
      updated_at: new Date().toISOString(),
    };

    if (status === 'accepted') {
      updateData.quoted_amount = quoted_amount;
      updateData.quote_status = 'pending'; // Pending brand review
    } else {
      updateData.quote_status = 'declined';
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('creator_requests')
      .update(updateData)
      .eq('id', dttrackerRequestId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update creator request:', updateError);
      return new Response(
        JSON.stringify({
          error: 'Failed to update creator request',
          detail: updateError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Creator request updated successfully:', updatedRequest.id);

    // Update creator_request_items table for this specific creator
    if (creator_id || dobble_tap_creator_id) {
      // First, find the DTTracker creator ID from Dobbletap creator ID
      let dttrackerCreatorId = creator_id;

      // If creator_id looks like a Dobbletap ID (or we have dobble_tap_creator_id), look up DTTracker ID
      if (dobble_tap_creator_id || creator_id) {
        const { data: creatorData, error: creatorError } = await supabase
          .from('creators')
          .select('id')
          .eq('dobble_tap_user_id', dobble_tap_creator_id || creator_id)
          .maybeSingle();

        if (creatorData) {
          dttrackerCreatorId = creatorData.id;
          console.log('Mapped Dobbletap creator to DTTracker creator:', {
            dobble_tap_id: dobble_tap_creator_id || creator_id,
            dttracker_id: dttrackerCreatorId
          });
        } else {
          console.error('Could not find DTTracker creator for Dobbletap ID:', dobble_tap_creator_id || creator_id);
        }
      }

      if (dttrackerCreatorId) {
        const itemUpdateData: any = {
          request_id: dttrackerRequestId,
          creator_id: dttrackerCreatorId,
          quoted_at: responded_at || new Date().toISOString(),
          quote_notes: response_message,
          updated_at: new Date().toISOString(),
        };

        if (status === 'accepted') {
          itemUpdateData.quoted_amount_cents = quoted_amount;
          itemUpdateData.quoted_currency = 'NGN';
          itemUpdateData.status = 'quoted'; // Map to 'quoted' so UI shows accept/reject buttons
        } else {
          itemUpdateData.status = 'declined';
        }

        // Use upsert to insert if row doesn't exist, update if it does
        const { data: updatedItem, error: itemError } = await supabase
          .from('creator_request_items')
          .upsert(itemUpdateData, {
            onConflict: 'request_id,creator_id',
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (itemError) {
          console.error('Failed to upsert creator_request_items:', itemError);
          // Don't fail the whole callback - log and continue
        } else {
          console.log('Creator request item upserted:', updatedItem.id);
        }
      }
    }

    // Send notification to brand (don't fail if notification fails)
    try {
      if (status === 'accepted') {
        // Invoke notification function
        await supabase.functions.invoke('notify-creator-quote', {
          body: {
            request_id: request.id,
            quoted_amount,
            creator_id,
            dobble_tap_creator_id,
          }
        });
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
      // Don't fail the callback - notification is secondary
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote received successfully',
        request_id: updatedRequest.id,
        quote_status: updatedRequest.quote_status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Creator quote callback error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
