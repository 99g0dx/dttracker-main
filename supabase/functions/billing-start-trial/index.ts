import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRIAL_DAYS = 14

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

    // Check current subscription status
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    // If no subscription, create one first
    let currentSubscription = subscription
    if (subError && subError.code === 'PGRST116') {
      const { data: newSub, error: insertError } = await supabaseAdmin
        .from('workspace_subscriptions')
        .insert({
          workspace_id: workspaceId,
          plan_slug: 'starter',
          status: 'free'
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create subscription: ${insertError.message}`)
      }
      currentSubscription = newSub
    } else if (subError) {
      throw new Error(`Failed to fetch subscription: ${subError.message}`)
    }

    // Check if trial already used
    if (currentSubscription.trial_used) {
      return new Response(JSON.stringify({
        error: 'Trial already used',
        message: 'You have already used your free trial. Please subscribe to continue with Pro features.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if already on a paid plan
    if (['active', 'trialing'].includes(currentSubscription.status)) {
      return new Response(JSON.stringify({
        error: 'Already subscribed',
        message: 'You already have an active subscription or trial.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Start trial
    const now = new Date()
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    const { data: updatedSubscription, error: updateError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .update({
        status: 'trialing',
        plan_slug: 'pro', // Trial gives Pro access
        trial_start_at: now.toISOString(),
        trial_end_at: trialEnd.toISOString(),
        trial_used: true,
      })
      .eq('id', currentSubscription.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to start trial: ${updateError.message}`)
    }

    // Log billing event
    await supabaseAdmin
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        event_source: 'system',
        event_type: 'trial.started',
        payload: {
          trial_start_at: now.toISOString(),
          trial_end_at: trialEnd.toISOString(),
          trial_days: TRIAL_DAYS,
          user_id: user.id,
          user_email: user.email,
        },
        processed_at: now.toISOString(),
      })

    return new Response(JSON.stringify({
      success: true,
      message: `Your ${TRIAL_DAYS}-day trial has started!`,
      subscription: {
        status: updatedSubscription.status,
        plan_slug: updatedSubscription.plan_slug,
        trial_start_at: updatedSubscription.trial_start_at,
        trial_end_at: updatedSubscription.trial_end_at,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('billing-start-trial error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
