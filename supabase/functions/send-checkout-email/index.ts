import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

    // Get From email address from environment, fallback to default
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Dobble Tap <no-reply@dttracker.app>';

    // Add validation logging
    console.log('=== Email Function Debug ===')
    console.log('Has API Key:', !!RESEND_API_KEY)
    console.log('From Email:', resendFromEmail)
    console.log('User Email:', userEmail)
    console.log('Creators Count:', creators?.length)
    console.log('Campaign Details:', campaignDetails?.substring(0, 50))
    console.log('Budget:', budget)

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    if (!userEmail) {
      throw new Error('User email is missing')
    }

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
        html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0D0D0D; color: #ffffff;">
    <div style="max-width: 650px; margin: 0 auto; background: #0D0D0D;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #00D9FF 0%, #00A3CC 100%); padding: 40px 30px; text-align: center;">
        <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: rgba(255,255,255,0.15); border-radius: 16px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">New Campaign Inquiry</h1>
        <p style="margin: 10px 0 0; font-size: 14px; color: rgba(0,0,0,0.7);">Talent request received</p>
      </div>

      <!-- Main Content -->
      <div style="padding: 40px 30px; background: #111111; border-left: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08);">
        
        <!-- User Info -->
        <div style="margin-bottom: 32px; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <div style="margin-bottom: 12px;">
            <div style="width: 8px; height: 8px; background: #00D9FF; border-radius: 50%; margin-right: 10px; display: inline-block;"></div>
            <h3 style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888888; font-weight: 600; display: inline-block;">Inquiry From</h3>
          </div>
          <p style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 500;">${userEmail}</p>
        </div>

        <!-- Campaign Details -->
        <div style="margin-bottom: 32px;">
          <div style="margin-bottom: 16px;">
            <div style="width: 8px; height: 8px; background: #00D9FF; border-radius: 50%; margin-right: 10px; display: inline-block;"></div>
            <h3 style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888888; font-weight: 600; display: inline-block;">Campaign Details</h3>
          </div>
          <div style="padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
            <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #cccccc; white-space: pre-wrap;">${campaignDetails}</p>
          </div>
        </div>

        <!-- Budget -->
        ${budget && budget !== 'Not specified' ? `
        <div style="margin-bottom: 32px;">
          <div style="margin-bottom: 16px;">
            <div style="width: 8px; height: 8px; background: #00D9FF; border-radius: 50%; margin-right: 10px; display: inline-block;"></div>
            <h3 style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888888; font-weight: 600; display: inline-block;">Proposed Budget</h3>
          </div>
          <div style="padding: 20px; background: rgba(0,217,255,0.05); border: 1px solid rgba(0,217,255,0.2); border-radius: 12px;">
            <p style="margin: 0; font-size: 28px; font-weight: 700; color: #00D9FF;">$${budget}</p>
          </div>
        </div>
        ` : ''}

        <!-- Selected Creators -->
        <div>
          <div style="margin-bottom: 16px;">
            <div style="width: 8px; height: 8px; background: #00D9FF; border-radius: 50%; margin-right: 10px; display: inline-block;"></div>
            <h3 style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888888; font-weight: 600; display: inline-block;">Selected Creators</h3>
            <span style="padding: 6px 14px; background: rgba(0,217,255,0.1); border: 1px solid rgba(0,217,255,0.3); border-radius: 20px; font-size: 12px; font-weight: 600; color: #00D9FF; margin-left: 10px;">${creators.length} Total</span>
          </div>
          
          <div>
            ${creators.map((c: any, index: number) => `
              <div style="padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin-bottom: 12px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="48" style="padding-right: 14px;">
                      ${c.profile_picture_url ? `
                        <img src="${c.profile_picture_url}" alt="${c.name}" style="width: 48px; height: 48px; border-radius: 10px; display: block;" />
                      ` : `
                        <div style="width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, rgba(0,217,255,0.2) 0%, rgba(0,163,204,0.2) 100%); text-align: center; line-height: 48px;">
                          <span style="font-size: 20px; font-weight: 700; color: #00D9FF;">${c.name.charAt(0).toUpperCase()}</span>
                        </div>
                      `}
                    </td>
                    <td>
                      <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #ffffff;">${c.name}</h4>
                      <p style="margin: 0; font-size: 13px; color: #888888;">
                        ${Number(c.follower_count).toLocaleString()} followers
                        ${c.platform ? `<span style="padding: 2px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 11px; color: #aaaaaa; text-transform: uppercase; margin-left: 8px;">${c.platform}</span>` : ''}
                      </p>
                    </td>
                    <td width="60" style="text-align: right;">
                      <span style="padding: 6px 12px; background: rgba(0,217,255,0.1); border: 1px solid rgba(0,217,255,0.3); border-radius: 8px; font-size: 11px; font-weight: 700; color: #00D9FF;">#${index + 1}</span>
                    </td>
                  </tr>
                </table>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Summary Box -->
        <div style="margin-top: 32px; padding: 24px; background: rgba(0,217,255,0.05); border: 1px solid rgba(0,217,255,0.2); border-radius: 12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align: center; padding: 10px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #888888; text-transform: uppercase;">Total Creators</p>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #00D9FF;">${creators.length}</p>
              </td>
              <td style="text-align: center; padding: 10px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #888888; text-transform: uppercase;">Total Reach</p>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #00D9FF;">${(creators.reduce((sum: number, c: any) => sum + (c.follower_count || 0), 0) / 1000000).toFixed(1)}M</p>
              </td>
            </tr>
          </table>
        </div>

      </div>

      <!-- Footer -->
      <div style="padding: 30px; text-align: center; background: #0A0A0A; border-left: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff; font-weight: 500;">Reply directly to this email to connect with the client</p>
        <p style="margin: 0; font-size: 12px; color: #666666;">This inquiry was sent via your Talent Tracker dashboard</p>
      </div>

    </div>
  </body>
</html>`,
      }),
    })

    const resData = await res.json()
    console.log("=== Resend API Response ===")
    console.log("Status:", res.status)
    console.log("Response Data:", JSON.stringify(resData, null, 2))

    if (!res.ok) {
      const errorMessage = resData?.message || resData?.error?.message || 'Unknown error';
      console.error("Resend API Error Details:", {
        status: res.status,
        statusText: res.statusText,
        error: resData,
        message: errorMessage
      });
      throw new Error(`Resend API Error (${res.status}): ${errorMessage}. Check Supabase Edge Function logs for details.`)
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
    console.error("=== Function Error ===")
    console.error("Error:", error.message)
    console.error("Stack:", error.stack)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check Supabase Edge Function logs for more information'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})