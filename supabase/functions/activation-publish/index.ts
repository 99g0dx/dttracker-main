import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { syncToDobbleTap } from '../_shared/dobble-tap-sync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
  const authHeader =
    req.headers.get('Authorization') ?? req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { activationId } = body;

    if (!activationId) {
      return new Response(JSON.stringify({ error: 'activationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: activation, error: activationError } = await supabase
      .from('activations')
      .select('*')
      .eq('id', activationId)
      .single();

    if (activationError || !activation) {
      return new Response(
        JSON.stringify({ error: 'Activation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (activation.status !== 'draft') {
      return new Response(
        JSON.stringify({ error: 'Activation is not in draft status' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const totalBudget = Number(activation.total_budget) || 0;
    const workspaceId = activation.workspace_id;

    if (totalBudget <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid total budget' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate service fee (10% of total budget)
    const serviceFeeRate = 0.10;
    const serviceFee = Math.round(totalBudget * serviceFeeRate * 100) / 100; // Round to 2 decimal places
    const totalCost = totalBudget + serviceFee;

    let { data: wallet } = await supabase
      .from('workspace_wallets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet, error: insertErr } = await supabase
        .from('workspace_wallets')
        .insert({
          workspace_id: workspaceId,
          balance: 0,
          locked_balance: 0,
          currency: 'NGN',
        })
        .select()
        .single();

      if (insertErr || !newWallet) {
        return new Response(
          JSON.stringify({ error: 'Failed to create wallet' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      wallet = newWallet;
    }

    const availableBalance = Number(wallet.balance) || 0;
    const lockedBalance = Number(wallet.locked_balance) || 0;
    const dailySpendLimit = wallet.daily_spend_limit != null ? Number(wallet.daily_spend_limit) : null;
    const lastReset = wallet.last_spend_reset_date ? String(wallet.last_spend_reset_date).slice(0, 10) : null;
    const today = new Date().toISOString().slice(0, 10);
    const spentToday = lastReset === today ? Number(wallet.daily_spent_today) || 0 : 0;

    // Check balance for total cost (budget + service fee)
    if (availableBalance < totalCost) {
      return new Response(
        JSON.stringify({
          error: `Insufficient balance. Available: ${availableBalance}, Required: ${totalCost} (Budget: ${totalBudget} + Service Fee: ${serviceFee})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (dailySpendLimit != null && spentToday + totalCost > dailySpendLimit) {
      return new Response(
        JSON.stringify({
          error: `Daily spending limit exceeded. Limit: ${dailySpendLimit}, already spent today: ${spentToday}, requested: ${totalCost} (Budget: ${totalBudget} + Service Fee: ${serviceFee})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const newAvailable = availableBalance - totalCost;
    const newLocked = lockedBalance + totalBudget;
    const newSpentToday = spentToday + totalCost;

    const { error: updateWalletError } = await supabase
      .from('workspace_wallets')
      .update({
        balance: newAvailable,
        locked_balance: newLocked,
        daily_spent_today: newSpentToday,
        last_spend_reset_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateWalletError) {
      return new Response(
        JSON.stringify({ error: 'Failed to lock budget' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create transaction for activation budget lock
    await supabase.from('wallet_transactions').insert({
      workspace_id: workspaceId,
      type: 'lock',
      amount: totalBudget,
      balance_after: newAvailable,
      locked_balance_after: newLocked,
      reference_type: 'activation',
      reference_id: activationId,
      description: `Budget locked for activation: ${activation.title}`,
      status: 'completed',
      processed_at: new Date().toISOString(),
      metadata: { activation_title: activation.title },
    });

    // Create transaction for service fee
    await supabase.from('wallet_transactions').insert({
      workspace_id: workspaceId,
      type: 'service_fee',
      amount: serviceFee,
      service_fee_amount: serviceFee,
      balance_after: newAvailable,
      locked_balance_after: newLocked,
      reference_type: 'activation',
      reference_id: activationId,
      description: `Service fee (10%) for activation: ${activation.title}`,
      status: 'completed',
      processed_at: new Date().toISOString(),
      metadata: { 
        activation_title: activation.title,
        service_fee_rate: serviceFeeRate,
        base_amount: totalBudget,
      },
    });

    // Sync to Dobble Tap using shared utility
    const syncPayload = {
      activation_id: activation.id,
      dttracker_workspace_id: workspaceId,
      type: activation.type,
      title: activation.title,
      brief: activation.brief,
      deadline: activation.deadline,
      total_budget: activation.total_budget,
      prize_structure: activation.prize_structure,
      winner_count:
        activation.type === 'contest'
          ? activation.winner_count ?? 20
          : activation.winner_count,
      max_posts_per_creator:
        activation.type === 'contest'
          ? activation.max_posts_per_creator ?? 5
          : null,
      scoring_method:
        activation.type === 'contest' ? 'cumulative' : null,
      performance_weights:
        activation.type === 'contest'
          ? { views: 1, likes: 2, comments: 3 }
          : null,
      task_type: activation.task_type,
      target_url: activation.target_url,
      payment_per_action: activation.payment_per_action,
      base_rate: activation.base_rate,
      required_comment_text: activation.required_comment_text,
      comment_guidelines: activation.comment_guidelines,
      max_participants: activation.max_participants,
      platforms: activation.platforms,
      requirements: activation.requirements,
      instructions: activation.instructions,
    };

    const syncResult = await syncToDobbleTap(
      supabase,
      'activation',
      '/api/sync/activation',
      syncPayload,
      activation.id
    );

    const updateData: any = {
      status: 'live',
      synced_to_dobble_tap: syncResult.synced,
      updated_at: new Date().toISOString(),
    };

    if (syncResult.dobbleTapId) {
      updateData.dobble_tap_activation_id = syncResult.dobbleTapId;
    }

    const { data: updatedActivation, error: updateActivationError } =
      await supabase
        .from('activations')
        .update(updateData)
        .eq('id', activationId)
        .select()
        .single();

    if (updateActivationError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update activation status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ activation: updatedActivation }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('activation-publish error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
