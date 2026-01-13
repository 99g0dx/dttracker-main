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
    const { request_id } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!request_id) {
      throw new Error('Request ID is required');
    }

    // Get the request details from the database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch the request with creators
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
            location
          )
        )
      `)
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message || 'Request not found'}`);
    }

    // Extract creators from the nested structure
    const creators = request.creator_request_items?.map((item: any) => item.creators).filter(Boolean) || [];

    // Build email content
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

    const htmlContent = `<!DOCTYPE html>
<html>
  <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; padding: 40px 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      
      <div style="background: #000000; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">New Creator Request</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 16px; line-height: 1.6;">Hello,</p>
        <p style="font-size: 16px; line-height: 1.6;">You have received a new creator request (Request ID: <strong>${request.id.slice(0, 8)}</strong>) with the following details:</p>

        <!-- Request Details -->
        <div style="margin-top: 25px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px; border-bottom: 2px solid #eaeaef; padding-bottom: 10px;">Request Details</h3>
          
          ${request.campaign_type ? `<p style="margin: 8px 0;"><strong>Campaign Type:</strong> ${campaignTypeLabels[request.campaign_type] || request.campaign_type}</p>` : ''}
          ${request.status ? `<p style="margin: 8px 0;"><strong>Status:</strong> ${statusLabels[request.status] || request.status}</p>` : ''}
          ${request.urgency ? `<p style="margin: 8px 0;"><strong>Urgency:</strong> ${urgencyLabels[request.urgency] || request.urgency}</p>` : ''}
          ${request.posts_per_creator ? `<p style="margin: 8px 0;"><strong>Posts per Creator:</strong> ${request.posts_per_creator}</p>` : ''}
          ${request.deadline ? `<p style="margin: 8px 0;"><strong>Deadline:</strong> ${new Date(request.deadline).toLocaleDateString()}</p>` : ''}
        </div>

        <!-- Campaign Brief -->
        ${request.campaign_brief ? `
        <div style="margin-top: 20px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 16px;">Campaign Brief</h3>
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${request.campaign_brief}</p>
        </div>
        ` : ''}

        <!-- Deliverables -->
        ${request.deliverables && request.deliverables.length > 0 ? `
        <div style="margin-top: 20px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 16px;">Deliverables</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${request.deliverables.map((d: string) => `
              <span style="background: #eaeaef; color: #444; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                ${deliverableLabels[d] || d}
              </span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Usage Rights -->
        ${request.usage_rights ? `
        <div style="margin-top: 20px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 16px;">Usage Rights</h3>
          <p style="margin: 0; color: #666; font-size: 14px;">${usageRightsLabels[request.usage_rights] || request.usage_rights}</p>
        </div>
        ` : ''}

        <!-- Selected Creators -->
        ${creators.length > 0 ? `
        <div style="margin-top: 25px;">
          <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px; border-bottom: 2px solid #eaeaef; padding-bottom: 10px;">Selected Creators (${creators.length})</h3>
          ${creators.map((creator: any) => `
            <div style="display: flex; align-items: center; padding: 15px; border: 1px solid #eaeaef; border-radius: 10px; margin-bottom: 12px;">
              <div style="flex: 1;">
                <h4 style="margin: 0 0 4px 0; color: #1a1a1a; font-size: 16px;">${creator.name || 'Unknown'}</h4>
                <p style="margin: 4px 0; color: #666; font-size: 13px;">@${creator.handle || 'N/A'} • ${creator.platform || 'N/A'}</p>
                ${creator.follower_count ? `<p style="margin: 4px 0; color: #999; font-size: 12px;">${Number(creator.follower_count).toLocaleString()} Followers</p>` : ''}
                ${creator.niche ? `<p style="margin: 4px 0; color: #999; font-size: 12px;">${creator.niche}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Contact Information -->
        ${(request.contact_person_name || request.contact_person_email || request.contact_person_phone) ? `
        <div style="margin-top: 25px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 16px;">Contact Information</h3>
          ${request.contact_person_name ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Name:</strong> ${request.contact_person_name}</p>` : ''}
          ${request.contact_person_email ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Email:</strong> ${request.contact_person_email}</p>` : ''}
          ${request.contact_person_phone ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Phone:</strong> ${request.contact_person_phone}</p>` : ''}
        </div>
        ` : ''}

        <!-- Asset Links -->
        ${request.song_asset_links && request.song_asset_links.length > 0 ? `
        <div style="margin-top: 20px; padding: 20px; background: #fafafa; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 16px;">Asset Links</h3>
          <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px;">
            ${request.song_asset_links.map((link: string) => `<li style="margin: 4px 0;"><a href="${link}" style="color: #0066cc; text-decoration: none;">${link}</a></li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div style="margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #0066cc; font-size: 14px; font-weight: 500;">Total Creators Requested: <strong>${creators.length}</strong></p>
          <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">Request Created: ${new Date(request.created_at).toLocaleString()}</p>
        </div>
      </div>

      <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #999;">
          This request was sent via your DTTracker dashboard. <br/>
          You can reply directly to this email to contact the user.
        </p>
      </div>
    </div>
  </body>
</html>`;

    // Get From email address from environment, fallback to default
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Dobble Tap <no-reply@dttracker.app>';

    // Determine reply_to email: use contact_person_email if available
    const replyToEmail = request.contact_person_email;

    // Build email payload
    const emailPayload: any = {
      from: resendFromEmail,
      to: ['agency@dobbletap.com'],
      subject: `New Creator Request - ${campaignTypeLabels[request.campaign_type] || 'Request'} (${creators.length} creators)`,
      html: htmlContent,
    };

    // Add reply_to only if contact email is available
    if (replyToEmail) {
      emailPayload.reply_to = replyToEmail;
    }

    // Send email via Resend
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
        status: 500,
      }
    );
  }
});