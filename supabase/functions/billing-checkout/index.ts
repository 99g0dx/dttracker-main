import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYSTACK_API_URL = 'https://api.paystack.co'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { plan_slug, callback_url } = await req.json()

    if (!plan_slug) {
      return new Response(JSON.stringify({ error: 'plan_slug is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client with user's auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use service role for queries
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('slug', plan_slug)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan selected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (plan.price_amount === 0) {
      return new Response(JSON.stringify({ error: 'Cannot checkout free plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const workspaceId = user.id
    const email = user.email

    // Generate unique transaction reference
    const reference = `dtt_${workspaceId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      throw new Error('Paystack is not configured')
    }

    // plan.price_amount is stored in USD cents (e.g. 4900 = $49.00).
    // Paystack USD transactions accept the amount in cents directly — do not multiply.
    const amountInCents = plan.price_amount // USD cents (e.g. 4900 = $49.00)

    // Initialize transaction with Paystack
    const paystackResponse = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        amount: amountInCents, // Already in cents — Paystack USD accepts cents directly
        currency: 'USD', // Let Paystack handle conversion
        reference: reference,
        callback_url: callback_url || `${req.headers.get('origin')}/billing/success`,
        metadata: {
          workspace_id: workspaceId,
          user_id: user.id,
          plan_slug: plan_slug,
          plan_name: plan.name,
          custom_fields: [
            {
              display_name: "Plan",
              variable_name: "plan_name",
              value: plan.name
            },
            {
              display_name: "Workspace",
              variable_name: "workspace_id",
              value: workspaceId
            }
          ]
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      })
    })

    const paystackData = await paystackResponse.json()

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('Paystack error:', paystackData)
      throw new Error(paystackData.message || 'Failed to initialize payment')
    }

    // Log billing event
    await supabaseAdmin
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        event_source: 'system',
        event_type: 'checkout.initialized',
        reference: reference,
        payload: {
          plan_slug: plan_slug,
          plan_name: plan.name,
          amount: amountInCents,
          currency: 'USD',
          user_email: email,
          paystack_access_code: paystackData.data.access_code,
        },
        processed_at: new Date().toISOString(),
      })

    return new Response(JSON.stringify({
      success: true,
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: reference,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('billing-checkout error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
