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

    // Use service role for querying (bypasses RLS)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get workspace subscription (workspace_id = user_id for personal workspaces)
    const workspaceId = user.id

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    // If no subscription exists, create a default one
    let currentSubscription = subscription
    if (subError && subError.code === 'PGRST116') {
      // No subscription found, create default
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

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('slug', currentSubscription.plan_slug)
      .single()

    if (planError) {
      throw new Error(`Failed to fetch plan: ${planError.message}`)
    }

    // Calculate effective status
    let effectiveStatus = currentSubscription.status
    const now = new Date()

    // Check if trial has ended
    if (currentSubscription.status === 'trialing' && currentSubscription.trial_end_at) {
      const trialEnd = new Date(currentSubscription.trial_end_at)
      if (now > trialEnd) {
        // Trial ended, downgrade to free
        effectiveStatus = 'expired'
        await supabaseAdmin
          .from('workspace_subscriptions')
          .update({ status: 'expired' })
          .eq('id', currentSubscription.id)
      }
    }

    // Check if grace period has ended
    if (currentSubscription.status === 'past_due' && currentSubscription.grace_ends_at) {
      const graceEnd = new Date(currentSubscription.grace_ends_at)
      if (now > graceEnd) {
        effectiveStatus = 'expired'
        await supabaseAdmin
          .from('workspace_subscriptions')
          .update({ status: 'expired' })
          .eq('id', currentSubscription.id)
      }
    }

    // Check if canceled subscription period has ended
    if (currentSubscription.status === 'canceled' && currentSubscription.current_period_end_at) {
      const periodEnd = new Date(currentSubscription.current_period_end_at)
      if (now > periodEnd) {
        effectiveStatus = 'expired'
        await supabaseAdmin
          .from('workspace_subscriptions')
          .update({ status: 'expired', plan_slug: 'starter' })
          .eq('id', currentSubscription.id)
      }
    }

    // Build response
    const response = {
      subscription: {
        id: currentSubscription.id,
        workspace_id: currentSubscription.workspace_id,
        status: effectiveStatus,
        plan_slug: currentSubscription.plan_slug,
        trial_start_at: currentSubscription.trial_start_at,
        trial_end_at: currentSubscription.trial_end_at,
        trial_used: currentSubscription.trial_used,
        current_period_start_at: currentSubscription.current_period_start_at,
        current_period_end_at: currentSubscription.current_period_end_at,
        cancel_at_period_end: currentSubscription.cancel_at_period_end,
        canceled_at: currentSubscription.canceled_at,
        billing_email: currentSubscription.billing_email || user.email,
        last_payment_at: currentSubscription.last_payment_at,
      },
      plan: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        price_amount: plan.price_amount,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features_json,
        limits: plan.limits_json,
      },
      // Computed fields for UI
      is_paid: ['active', 'trialing'].includes(effectiveStatus),
      is_trialing: effectiveStatus === 'trialing',
      can_start_trial: !currentSubscription.trial_used && effectiveStatus === 'free',
      days_until_trial_end: currentSubscription.trial_end_at
        ? Math.max(0, Math.ceil((new Date(currentSubscription.trial_end_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null,
      days_until_period_end: currentSubscription.current_period_end_at
        ? Math.max(0, Math.ceil((new Date(currentSubscription.current_period_end_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('billing-summary error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
