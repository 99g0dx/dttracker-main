import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  emailHeader, emailFooter, emailHeading, emailSubtext,
  emailCard, emailInfoBox, emailSectionTitle, emailLabel, emailValue,
  emailDivider, emailStyles,
} from "../_shared/email-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { creators, campaignDetails, budget, userEmail } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DTTracker <no-reply@dttracker.app>';

    console.log('=== Email Function Debug ===')
    console.log('Has API Key:', !!RESEND_API_KEY)
    console.log('User Email:', userEmail)
    console.log('Creators Count:', creators?.length)

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    if (!userEmail) {
      throw new Error('User email is missing')
    }

    const creatorCards = creators.map((c: any, index: number) => `
      <div style="padding: 14px; background-color: ${emailStyles.INFO_BOX_COLOR}; border: 1px solid ${emailStyles.BORDER_COLOR}; border-radius: 10px; margin-bottom: 10px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="44" style="padding-right: 12px; vertical-align: middle;">
              ${c.profile_picture_url
                ? `<img src="${c.profile_picture_url}" alt="${c.name}" style="width: 44px; height: 44px; border-radius: 10px; display: block;" />`
                : `<div style="width: 44px; height: 44px; border-radius: 10px; background-color: ${emailStyles.BRAND_COLOR}; text-align: center; line-height: 44px;">
                    <span style="font-size: 18px; font-weight: 700; color: #fff;">${c.name.charAt(0).toUpperCase()}</span>
                  </div>`
              }
            </td>
            <td style="vertical-align: middle;">
              <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: ${emailStyles.TEXT_PRIMARY};">${c.name}</p>
              <p style="margin: 0; font-size: 12px; color: ${emailStyles.TEXT_SECONDARY};">
                ${Number(c.follower_count).toLocaleString()} followers
                ${c.platform ? ` &middot; ${c.platform}` : ''}
              </p>
            </td>
            <td width="40" style="text-align: right; vertical-align: middle;">
              <span style="padding: 4px 10px; background-color: rgba(232,21,58,0.1); border: 1px solid rgba(232,21,58,0.3); border-radius: 6px; font-size: 11px; font-weight: 700; color: ${emailStyles.BRAND_COLOR};">#${index + 1}</span>
            </td>
          </tr>
        </table>
      </div>
    `).join('');

    const htmlBody = `${emailHeader()}
        ${emailHeading("New Campaign Inquiry")}
        ${emailSubtext("A new talent request has been received.")}

        ${emailInfoBox(`
          ${emailLabel("Inquiry from")}
          ${emailValue(userEmail)}
        `)}

        ${emailDivider()}
        ${emailSectionTitle("Campaign Details")}
        ${emailCard(`
          <p style="margin: 0; font-size: 14px; line-height: 1.7; color: ${emailStyles.TEXT_SECONDARY}; white-space: pre-wrap;">${campaignDetails}</p>
        `)}

        ${budget && budget !== 'Not specified' ? `
          ${emailSectionTitle("Proposed Budget")}
          ${emailInfoBox(`
            <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${emailStyles.BRAND_COLOR};">$${budget}</p>
          `)}
        ` : ''}

        ${emailDivider()}
        ${emailSectionTitle("Selected Creators")}
        <p style="margin: 0 0 16px 0;">
          <span style="padding: 5px 14px; background-color: rgba(232,21,58,0.1); border: 1px solid rgba(232,21,58,0.3); border-radius: 20px; font-size: 12px; font-weight: 600; color: ${emailStyles.BRAND_COLOR};">${creators.length} Total</span>
        </p>
        ${creatorCards}

        ${emailDivider()}
        <!-- Summary -->
        ${emailInfoBox(`
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align: center; padding: 10px;">
                <p style="margin: 0 0 4px 0; font-size: 11px; color: ${emailStyles.TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px;">Total Creators</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${emailStyles.BRAND_COLOR};">${creators.length}</p>
              </td>
              <td style="text-align: center; padding: 10px;">
                <p style="margin: 0 0 4px 0; font-size: 11px; color: ${emailStyles.TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px;">Total Reach</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${emailStyles.BRAND_COLOR};">${(creators.reduce((sum: number, c: any) => sum + (c.follower_count || 0), 0) / 1000000).toFixed(1)}M</p>
              </td>
            </tr>
          </table>
        `)}

        <p style="color: ${emailStyles.TEXT_SECONDARY}; font-size: 13px; text-align: center; margin-top: 24px;">Reply directly to this email to connect with the client.</p>
${emailFooter()}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: ['agency@dobbletap.com'],
        reply_to: userEmail,
        subject: `New Campaign Inquiry from ${userEmail}`,
        html: htmlBody,
      }),
    })

    const resData = await res.json()
    console.log("Resend Response:", resData)

    if (!res.ok) {
      const errorMessage = resData?.message || resData?.error?.message || 'Unknown error';
      console.error("Resend API Error:", { status: res.status, error: resData });
      throw new Error(`Resend API Error (${res.status}): ${errorMessage}`)
    }

    return new Response(JSON.stringify({
      success: true,
      emailId: resData.id,
      message: 'Email sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Function Error:", error.message)
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Check Supabase Edge Function logs for more information'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
