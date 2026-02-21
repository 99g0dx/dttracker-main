import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { syncToDobbleTap } from '../_shared/dobble-tap-sync.ts';
import {
  emailHeader, emailFooter, emailHeading, emailSubtext,
  emailCard, emailInfoBox, emailSectionTitle,
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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    // Require either a valid user JWT or the internal SYNC_API_KEY
    let isAuthorized = false;
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (SYNC_API_KEY && authHeader === `Bearer ${SYNC_API_KEY}`) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (!userError && user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { request_id } = await req.json();

    if (!request_id) {
      throw new Error('Request ID is required');
    }

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
            follower_count,
            avg_engagement,
            niche,
            location,
            dobble_tap_user_id
          )
        )
      `)
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message || 'Request not found'}`);
    }

    const creators =
      request.creator_request_items?.map((item: any) => item.creators).filter(Boolean) || [];
    const dttrackerCreatorIds = creators.map((c: any) => c.id).filter(Boolean);
    const dobbleTapCreatorIds = creators
      .map((c: any) => c.dobble_tap_user_id)
      .filter(Boolean);
    const missingDobbleTapIds = creators
      .filter((c: any) => !c.dobble_tap_user_id)
      .map((c: any) => c.id);

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

    const urgencyLabels: Record<string, string> = {
      normal: 'Normal',
      fast_turnaround: 'Fast Turnaround',
      asap: 'ASAP',
    };

    const deliverableLabels: Record<string, string> = {
      tiktok_post: 'TikTok Post',
      instagram_reel: 'Instagram Reel',
      instagram_story: 'Instagram Story',
      youtube_short: 'YouTube Short',
      other: 'Other',
    };

    const usageRightsLabels: Record<string, string> = {
      creator_page_only: 'Only on creator\'s page',
      repost_brand_pages: 'Repost on brand pages',
      run_ads: 'Run ads',
      all_above: 'All of the above',
    };

    const creatorCards = creators.map((creator: any) => `
      <div style="padding: 12px 14px; background-color: ${emailStyles.INFO_BOX_COLOR}; border: 1px solid ${emailStyles.BORDER_COLOR}; border-radius: 10px; margin-bottom: 8px;">
        <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: ${emailStyles.TEXT_PRIMARY};">${creator.name || 'Unknown'}</p>
        <p style="margin: 0; font-size: 12px; color: ${emailStyles.TEXT_SECONDARY};">
          @${creator.handle || 'N/A'} &middot; ${creator.platform || 'N/A'}
          ${creator.follower_count ? ` &middot; ${Number(creator.follower_count).toLocaleString()} followers` : ''}
          ${creator.niche ? ` &middot; ${creator.niche}` : ''}
        </p>
      </div>
    `).join('');

    const deliverablesBlock = request.deliverables && request.deliverables.length > 0 ? `
      ${emailDivider()}
      ${emailSectionTitle("Deliverables")}
      <div style="margin-bottom: 16px;">
        ${request.deliverables.map((d: string) => `
          <span style="display: inline-block; background-color: rgba(232,21,58,0.1); border: 1px solid rgba(232,21,58,0.2); color: ${emailStyles.BRAND_COLOR}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; margin: 0 6px 6px 0;">
            ${deliverableLabels[d] || d}
          </span>
        `).join('')}
      </div>
    ` : '';

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

    const assetBlock = request.song_asset_links && request.song_asset_links.length > 0 ? `
      ${emailDivider()}
      ${emailSectionTitle("Asset Links")}
      ${emailCard(`
        ${request.song_asset_links.map((link: string) => `
          <p style="margin: 4px 0;"><a href="${link}" style="color: ${emailStyles.BRAND_COLOR}; text-decoration: none; font-size: 14px; word-break: break-all;">${link}</a></p>
        `).join('')}
      `)}
    ` : '';

    const htmlBody = `${emailHeader()}
        ${emailHeading("New Creator Request")}
        ${emailSubtext(`Request <strong style="color: ${emailStyles.TEXT_PRIMARY};">${request.id.slice(0, 8)}</strong> has been submitted.`)}

        ${emailSectionTitle("Request Details")}
        ${emailCard(`
          ${emailTable(`
            ${request.campaign_type ? emailRow("Campaign Type", campaignTypeLabels[request.campaign_type] || request.campaign_type) : ''}
            ${request.status ? emailRow("Status", statusLabels[request.status] || request.status) : ''}
            ${request.urgency ? emailRow("Urgency", urgencyLabels[request.urgency] || request.urgency) : ''}
            ${request.posts_per_creator ? emailRow("Posts per Creator", request.posts_per_creator) : ''}
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

        ${deliverablesBlock}

        ${request.usage_rights ? `
          ${emailDivider()}
          ${emailSectionTitle("Usage Rights")}
          ${emailInfoBox(`
            ${emailValue(usageRightsLabels[request.usage_rights] || request.usage_rights)}
          `)}
        ` : ''}

        ${creators.length > 0 ? `
          ${emailDivider()}
          ${emailSectionTitle(`Selected Creators (${creators.length})`)}
          ${creatorCards}
        ` : ''}

        ${contactBlock}
        ${assetBlock}

        ${emailDivider()}
        ${emailInfoBox(`
          <div style="text-align: center;">
            <p style="margin: 0 0 4px 0; font-size: 14px; color: ${emailStyles.BRAND_COLOR}; font-weight: 600;">Total Creators Requested: ${creators.length}</p>
            <p style="margin: 4px 0 0 0; color: ${emailStyles.TEXT_MUTED}; font-size: 12px;">Request Created: ${new Date(request.created_at).toLocaleString()}</p>
          </div>
        `)}

        <p style="color: ${emailStyles.TEXT_SECONDARY}; font-size: 13px; text-align: center; margin-top: 24px;">Reply directly to this email to contact the user.</p>
${emailFooter()}`;

    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DTTracker <no-reply@dttracker.app>';
    const replyToEmail = request.contact_person_email;

    const emailPayload: any = {
      from: resendFromEmail,
      to: ['agency@dobbletap.com'],
      subject: `New Creator Request - ${campaignTypeLabels[request.campaign_type] || 'Request'} (${creators.length} creators)`,
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
    console.log("Resend status:", res.status);

    const resData = await res.json();
    console.log('Resend Response:', resData);

    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(resData)}`);
    }

    // Sync creator request to Dobbletap (don't fail if sync fails)
    let syncResult = null;
    try {
      if (dobbleTapCreatorIds.length === 0) {
        console.error(
          'No Dobbletap creator IDs available for request sync',
          { request_id: request.id, dttrackerCreatorIds }
        );
        syncResult = {
          success: false,
          synced: false,
          error: 'No Dobbletap creator IDs available for request sync',
        };
      } else {
        syncResult = await syncToDobbleTap(
          supabase,
          'creator_request',
          '/webhooks/dttracker',
          {
            request_id: request.id,
            campaign_type: request.campaign_type,
            campaign_brief: request.campaign_brief,
            deliverables: request.deliverables,
            posts_per_creator: request.posts_per_creator,
            usage_rights: request.usage_rights,
            deadline: request.deadline,
            urgency: request.urgency,
            contact_person_name: request.contact_person_name,
            contact_person_email: request.contact_person_email,
            contact_person_phone: request.contact_person_phone,
            campaign_id: request.campaign_id,
            creator_ids: dobbleTapCreatorIds,
            total_creators: dobbleTapCreatorIds.length,
            dttracker_creator_ids: dttrackerCreatorIds,
            missing_dobble_tap_creator_ids: missingDobbleTapIds,
          },
          request.id
        );
      }

      if (syncResult.synced) {
        console.log('Creator request synced to Dobbletap successfully');
        await supabase
          .from('creator_requests')
          .update({
            synced_to_dobble_tap: true,
            dobble_tap_request_id: syncResult.dobbleTapId || null,
          })
          .eq('id', request.id);
      } else {
        console.error('Failed to sync creator request to Dobbletap:', syncResult.error);
      }
    } catch (syncError) {
      console.error('Exception during Dobbletap sync:', syncError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: request.id,
        email_sent: true,
        synced_to_dobbletap: syncResult?.synced || false,
        sync_error: syncResult?.error || null,
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
        status: 500,
      }
    );
  }
});
