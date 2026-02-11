import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  emailHeader, emailFooter, emailHeading, emailSubtext,
  emailButton, emailCard, emailInfoBox, emailSectionTitle,
  emailLabel, emailValue, emailDivider, emailRow, emailTable,
  emailStyles,
} from "../_shared/email-template.ts";

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

    const creator = request.creator_request_items?.[0]?.creators;
    const creatorName = creator?.name || 'Creator';
    const creatorHandle = creator?.handle || 'N/A';
    const formattedAmount = `₦${Number(quoted_amount).toLocaleString()}`;

    const messageBlock = request.creator_response_message ? `
      ${emailDivider()}
      ${emailSectionTitle("Message from Creator")}
      ${emailCard(`
        <p style="margin: 0; color: ${emailStyles.TEXT_SECONDARY}; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${request.creator_response_message}</p>
      `)}
    ` : '';

    const htmlBody = `${emailHeader()}
        ${emailHeading("Creator Quote Received")}
        ${emailSubtext("A creator has responded to your campaign request with a quote.")}

        ${emailSectionTitle("Quote Details")}
        ${emailInfoBox(`
          ${emailLabel("Creator")}
          ${emailValue(`${creatorName} (@${creatorHandle})`)}
          <div style="margin-top: 16px;">
            ${emailLabel("Quoted Amount")}
            <p style="margin: 6px 0 0 0; font-size: 28px; font-weight: 700; color: ${emailStyles.BRAND_COLOR};">${formattedAmount}</p>
          </div>
        `)}

        ${messageBlock}

        ${emailDivider()}
        ${emailSectionTitle("Original Request")}
        ${emailCard(`
          ${emailTable(`
            ${emailRow("Campaign Type", request.campaign_type || 'N/A')}
            ${emailRow("Posts per Creator", request.posts_per_creator || 'N/A')}
            ${emailRow("Deadline", request.deadline ? new Date(request.deadline).toLocaleDateString() : 'N/A')}
          `)}
        `)}

        ${emailButton("Review Quote", `https://dttracker.app/requests/${request_id}`)}

        ${emailInfoBox(`
          <p style="margin: 0; font-size: 12px; color: ${emailStyles.TEXT_SECONDARY}; line-height: 1.6;">
            <strong style="color: ${emailStyles.TEXT_PRIMARY};">Next Steps:</strong><br/>
            &bull; Accept &mdash; The creator will receive a formal offer<br/>
            &bull; Decline &mdash; The creator will be notified<br/>
            &bull; Counter-offer &mdash; Send a different amount
          </p>
        `)}

        <p style="color: ${emailStyles.TEXT_MUTED}; font-size: 11px; text-align: center; margin-top: 24px;">
          Request ID: ${request.id.slice(0, 8)} &middot; Received: ${new Date().toLocaleString()}
        </p>
${emailFooter()}`;

    const brandEmail = request.contact_person_email || 'bukolafaduagba@gmail.com';
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DTTracker <no-reply@dttracker.app>';

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
        html: htmlBody,
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
