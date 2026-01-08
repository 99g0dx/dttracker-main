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
    const { creators, agencyEmail, userEmail } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    console.log(`Attempting to send email to ${agencyEmail} via Resend...`)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      // Replace your current body with this simplified version to test
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: [agencyEmail],
      subject: `New Request from ${userEmail}`,
      html: `<!DOCTYPE html>
  <html>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; padding: 40px 20px; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        
        <div style="background: #000000; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">New Talent Inquiry</h1>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 16px; line-height: 1.6;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.6;">You have received a new talent request from <strong>${userEmail}</strong>. Below are the creators they are interested in:</p>

          <div style="margin-top: 25px;">
            ${creators.map((c: any) => `
              <div style="display: flex; align-items: center; padding: 15px; border: 1px solid #eaeaef; border-radius: 10px; margin-bottom: 12px;">
                <div style="flex: 1;">
                  <h4 style="margin: 0 0 4px 0; color: #1a1a1a; font-size: 16px;">${c.name}</h4>
                  <p style="margin: 0; color: #666; font-size: 13px;">${Number(c.follower_count).toLocaleString()} Followers</p>
                </div>
                <div style="text-align: right;">
                  <span style="background: #f0f0f0; color: #444; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">SELECTED</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 30px; padding: 20px; background: #fafafa; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 14px;">Total Creators Requested: <strong>${creators.length}</strong></p>
          </div>
        </div>

        <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            This inquiry was sent via your Talent Tracker dashboard. <br/>
            You can reply directly to this email to contact the user.
          </p>
        </div>
      </div>
    </body>
  </html>`,
    }),
    })

    const resData = await res.json()
    console.log("Resend Response:", resData)

    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(resData)}`)
    }

    return new Response(JSON.stringify(resData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Function Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // This ensures your frontend goes to the 'catch' block
    })
  }
})