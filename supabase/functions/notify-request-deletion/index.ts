import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  emailHeader, emailFooter, emailHeading, emailSubtext,
  emailCard, emailInfoBox, emailSectionTitle,
  emailLabel, emailValue, emailDivider, emailRow, emailTable,
  emailStyles,
} from "../_shared/email-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { request_id } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!request_id) {
      throw new Error('Request ID is required');
    }

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
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
            platform,
            follower_count
          )
        )
      `)
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message || 'Request not found'}`);
    }

    const creators = request.creator_request_items?.map((item: any) => item.creators).filter(Boolean) || [];

    const campaignTypeLabels: Record<string, string> = {
      music_promotion: 'Music Promotion',
      brand_promotion: 'Brand Promotion',
      product_launch: 'Product Launch',
      event_activation: 'Event/Activation',
      other: 'Other',
    };

    const statusLabels: Record<string, string> = {
      submitted: 'Submitted',
      reviewing: 'Reviewing',
      quoted: 'Quoted',
      approved: 'Approved',
      in_fulfillment: 'In Fulfillment',
      delivered: 'Delivered',
    };

    const creatorCards = creators.map((creator: any) => `
      <div style="padding: 12px 14px; background-color: ${emailStyles.INFO_BOX_COLOR}; border: 1px solid ${emailStyles.BORDER_COLOR}; border-radius: 10px; margin-bottom: 8px;">
        <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: ${emailStyles.TEXT_PRIMARY};">${creator.name || 'Unknown'}</p>
        <p style="margin: 0; font-size: 12px; color: ${emailStyles.TEXT_SECONDARY};">
          @${creator.handle || 'N/A'} &middot; ${creator.platform || 'N/A'}
          ${creator.follower_count ? ` &middot; ${Number(creator.follower_count).toLocaleString()} followers` : ''}
        </p>
      </div>
    `).join('');

    const contactBlock = (request.contact_person_name || request.contact_person_email || request.contact_person_phone) ? `
      ${emailDivider()}
      ${emailSectionTitle("Contact Information")}
      ${emailCard(`
        ${emailTable(`
          ${request.contact_person_name ? emailRow("Name", request.contact_person_name) : ''}
          ${request.contact_person_email ? emailRow("Email", request.contact_person_email) : ''}
          ${request.contact_person_phone ? emailRow("Phone", request.contact_person_phone) : ''}
        `)}
      `)}
    ` : '';

    const htmlBody = `${emailHeader()}
        ${emailHeading("Creator Request Recalled")}
        ${emailSubtext(`Request <strong style="color: ${emailStyles.TEXT_PRIMARY};">${request.id.slice(0, 8)}</strong> has been recalled by the client.`)}

        ${emailSectionTitle("Request Details")}
        ${emailCard(`
          ${emailTable(`
            ${request.campaign_type ? emailRow("Campaign Type", campaignTypeLabels[request.campaign_type] || request.campaign_type) : ''}
            ${request.status ? emailRow("Status", statusLabels[request.status] || request.status) : ''}
            ${request.deadline ? emailRow("Deadline", new Date(request.deadline).toLocaleDateString()) : ''}
          `)}
        `)}

        ${request.campaign_brief ? `
          ${emailDivider()}
          ${emailSectionTitle("Campaign Brief")}
          ${emailCard(`
            <p style="margin: 0; color: ${emailStyles.TEXT_SECONDARY}; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${request.campaign_brief}</p>
          `)}
        ` : ''}

        ${creators.length > 0 ? `
          ${emailDivider()}
          ${emailSectionTitle(`Selected Creators (${creators.length})`)}
          ${creatorCards}
        ` : ''}

        ${contactBlock}

        ${emailDivider()}
        ${emailInfoBox(`
          <div style="text-align: center;">
            <p style="margin: 0 0 4px 0; color: ${emailStyles.BRAND_COLOR}; font-size: 14px; font-weight: 600;">This request has been cancelled by the client.</p>
            <p style="margin: 4px 0 0 0; color: ${emailStyles.TEXT_MUTED}; font-size: 12px;">Created: ${new Date(request.created_at).toLocaleString()}</p>
            <p style="margin: 4px 0 0 0; color: ${emailStyles.TEXT_MUTED}; font-size: 12px;">Deleted: ${new Date().toLocaleString()}</p>
          </div>
        `)}
${emailFooter()}`;

    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DTTracker <no-reply@dttracker.app>';
    const replyToEmail = request.contact_person_email;

    const emailPayload: any = {
      from: resendFromEmail,
      to: ['agency@dobbletap.com'],
      subject: `Creator Request Recalled - ${campaignTypeLabels[request.campaign_type] || 'Request'} (${creators.length} creators)`,
      html: htmlBody,
    };

    if (replyToEmail) {
      emailPayload.reply_to = replyToEmail;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resData = await res.json();
    console.log('Resend Response:', resData);

    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(resData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: request.id,
        email_sent: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Function Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
