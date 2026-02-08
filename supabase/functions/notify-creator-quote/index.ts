import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const { request_id, quoted_amount, creator_id, dobble_tap_creator_id } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!request_id || !quoted_amount) {
      throw new Error('Missing required fields: request_id, quoted_amount');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch creator request with creator details
    const { data: request, error: requestError } = await supabase
      .from('creator_requests')
      .select(`
        *,
        creator_request_items (
          creators (
            id,
            name,
            handle,
            platform
          )
        )
      `)
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message}`);
    }

    // Get creator info
    const creator = request.creator_request_items?.[0]?.creators;
    const creatorName = creator?.name || 'Creator';
    const creatorHandle = creator?.handle || 'N/A';

    // Format amount
    const formattedAmount = `₦${Number(quoted_amount).toLocaleString()}`;

    // Build email content
    const htmlContent = `<!DOCTYPE html>
<html>
  <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; padding: 40px 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">

      <div style="background: #000000; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Creator Quote Received 💰</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 16px; line-height: 1.6;">Hello,</p>
        <p style="font-size: 16px; line-height: 1.6;">A creator has responded to your campaign request with a quote!</p>

        <!-- Quote Details -->
        <div style="margin-top: 25px; padding: 20px; background: #e8f4fd; border-radius: 8px; border-left: 4px solid #0066cc;">
          <h3 style="margin: 0 0 15px 0; color: #0066cc; font-size: 18px;">Quote Details</h3>
          <p style="margin: 8px 0; font-size: 16px;"><strong>Creator:</strong> ${creatorName} (@${creatorHandle})</p>
          <p style="margin: 8px 0; font-size: 20px; color: #0066cc;"><strong>Quoted Amount:</strong> ${formattedAmount}</p>
          ${request.creator_response_message ? `
            <div style="margin-top: 15px; padding: 15px; background: #ffffff; border-radius: 6px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #666; font-weight: 600;">Message from Creator:</p>
              <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${request.creator_response_message}</p>
            </div>
          ` : ''}
        </div>

        <!-- Request Details -->
        <div style="margin-top: 20px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 16px;">Original Request</h3>
          <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Campaign Type:</strong> ${request.campaign_type || 'N/A'}</p>
          <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Posts per Creator:</strong> ${request.posts_per_creator || 'N/A'}</p>
          <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Deadline:</strong> ${request.deadline ? new Date(request.deadline).toLocaleDateString() : 'N/A'}</p>
        </div>

        <!-- Action Required -->
        <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 15px 0; color: #856404; font-size: 16px; font-weight: 600;">⚠️ Action Required</p>
          <p style="margin: 0 0 20px 0; color: #856404; font-size: 14px;">Please review this quote in your DTTracker dashboard and decide whether to accept, decline, or send a counter-offer.</p>
          <a href="https://dttracker.app/requests/${request_id}" style="display: inline-block; background: #000000; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Review Quote</a>
        </div>

        <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
          <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.5;">
            <strong>Next Steps:</strong><br/>
            • Accept: The creator will receive a formal offer<br/>
            • Decline: The creator will be notified<br/>
            • Counter-offer: Send a different amount
          </p>
        </div>
      </div>

      <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #999;">
          Request ID: ${request.id.slice(0, 8)}<br/>
          Received: ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  </body>
</html>`;

    // Get brand contact email
    const brandEmail = request.contact_person_email || 'bukolafaduagba@gmail.com'; // Fallback

    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DTTracker <no-reply@dttracker.app>';

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [brandEmail],
        subject: `Creator Quote: ${formattedAmount} from ${creatorName}`,
        html: htmlContent,
      }),
    });

    const resData = await res.json();
    console.log('Resend Response:', resData);

    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(resData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Notification Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
