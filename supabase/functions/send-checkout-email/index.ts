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
      html: `<p>New inquiry received for ${creators?.length || 0} creators.</p>`,
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