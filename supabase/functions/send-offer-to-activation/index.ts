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
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const dobbleTapApi = Deno.env.get('DOBBLE_TAP_API') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { creatorId, activationId, amount, message } = body;

    if (!creatorId || !activationId || typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'creatorId, activationId, and positive amount required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: activation, error: actError } = await supabase
      .from('activations')
      .select('id, workspace_id, title')
      .eq('id', activationId)
      .single();

    if (actError || !activation) {
      return new Response(
        JSON.stringify({ error: 'Activation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const workspaceId = activation.workspace_id;

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const isOwner = workspaceId === user.id;
    const canManage = isOwner || (membership?.role && ['brand_owner', 'agency_admin'].includes(membership.role));

    if (!canManage && !membership) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let { data: wallet } = await supabase
      .from('workspace_wallets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet, error: insErr } = await supabase
        .from('workspace_wallets')
        .insert({
          workspace_id: workspaceId,
          balance: 0,
          locked_balance: 0,
          currency: 'NGN',
        })
        .select()
        .single();

      if (insErr || !newWallet) {
        return new Response(
          JSON.stringify({ error: 'Failed to get wallet' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      wallet = newWallet;
    }

    const balance = Number(wallet.balance) || 0;
    if (balance < amount) {
      return new Response(
        JSON.stringify({ error: `Insufficient balance. Available: ${balance}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newBalance = balance - amount;

    const { error: updateErr } = await supabase
      .from('workspace_wallets')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('wallet_transactions').insert({
      workspace_id: workspaceId,
      type: 'payout',
      amount,
      balance_after: newBalance,
      reference_type: 'offer',
      reference_id: activationId,
      metadata: {
        creator_id: creatorId,
        activation_title: activation.title,
        message: message || null,
      },
    });

    if (dobbleTapApi) {
      try {
        await syncToDobbleTap(
          supabase,
          'creator_request_invitation',
          '/webhooks/dttracker',
          {
            creator_id: creatorId,
            activation_id: activationId,
            dttrackerCampaignId: activationId,
            amount,
            message: message || null,
            activation_title: activation.title,
            workspace_id: workspaceId,
          },
          activationId
        );
      } catch {
        /* sync optional */
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-offer-to-activation error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
