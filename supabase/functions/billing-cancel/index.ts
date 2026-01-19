import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Use service role for mutations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const workspaceId = user.id

    // Get current subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'No subscription found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if subscription can be canceled
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) {
      return new Response(JSON.stringify({
        error: 'Cannot cancel',
        message: 'You do not have an active subscription to cancel.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Already scheduled for cancellation
    if (subscription.cancel_at_period_end) {
      return new Response(JSON.stringify({
        error: 'Already canceling',
        message: 'Your subscription is already scheduled for cancellation at the end of the current period.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const now = new Date()

    // For trialing users, end trial immediately and downgrade
    if (subscription.status === 'trialing') {
      const { error: updateError } = await supabaseAdmin
        .from('workspace_subscriptions')
        .update({
          status: 'canceled',
          plan_slug: 'starter',
          canceled_at: now.toISOString(),
          cancel_at_period_end: false, // Immediate for trials
        })
        .eq('id', subscription.id)

      if (updateError) {
        throw new Error(`Failed to cancel subscription: ${updateError.message}`)
      }

      // Log billing event
      await supabaseAdmin
        .from('billing_events')
        .insert({
          workspace_id: workspaceId,
          event_source: 'user',
          event_type: 'subscription.canceled',
          payload: {
            previous_status: subscription.status,
            previous_plan: subscription.plan_slug,
            cancellation_type: 'immediate',
            reason: 'User canceled trial',
            user_id: user.id,
          },
          processed_at: now.toISOString(),
        })

      return new Response(JSON.stringify({
        success: true,
        message: 'Your trial has been canceled. You have been downgraded to the free plan.',
        effective_immediately: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // For active subscriptions, schedule cancellation at period end
    const { data: updatedSubscription, error: updateError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        canceled_at: now.toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to cancel subscription: ${updateError.message}`)
    }

    // If Paystack subscription exists, disable it
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (paystackSecretKey && subscription.paystack_subscription_code) {
      try {
        await fetch(`https://api.paystack.co/subscription/disable`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: subscription.paystack_subscription_code,
            token: subscription.paystack_authorization_code,
          })
        })
      } catch (paystackError) {
        console.error('Failed to disable Paystack subscription:', paystackError)
        // Don't fail the request, just log it
      }
    }

    // Log billing event
    await supabaseAdmin
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        event_source: 'user',
        event_type: 'subscription.canceled',
        payload: {
          previous_status: subscription.status,
          plan_slug: subscription.plan_slug,
          cancellation_type: 'end_of_period',
          access_until: subscription.current_period_end_at,
          user_id: user.id,
        },
        processed_at: now.toISOString(),
      })

    return new Response(JSON.stringify({
      success: true,
      message: 'Your subscription has been canceled. You will retain access until the end of your current billing period.',
      effective_immediately: false,
      access_until: subscription.current_period_end_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('billing-cancel error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
