import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { workspaceId, amount } = body;

    if (!workspaceId || typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid workspaceId or amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user has access to workspace (owner or workspace_members with admin role)
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const isOwner = workspaceId === user.id;
    const isAdmin = membership?.role && ['brand_owner', 'agency_admin'].includes(membership.role);

    if (!isOwner && !isAdmin && !membership) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: no access to this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create wallet
    let { data: wallet, error: walletError } = await supabase
      .from('workspace_wallets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (walletError) {
      return new Response(
        JSON.stringify({ error: walletError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!wallet) {
      const { data: newWallet, error: insertError } = await supabase
        .from('workspace_wallets')
        .insert({
          workspace_id: workspaceId,
          balance: 0,
          locked_balance: 0,
          currency: 'NGN',
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      wallet = newWallet;
    }

    const newBalance = Number(wallet.balance) + amount;

    const { error: updateError } = await supabase
      .from('workspace_wallets')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('wallet_transactions').insert({
      workspace_id: workspaceId,
      type: 'fund',
      amount,
      balance_after: newBalance,
      reference_type: 'manual',
      metadata: { user_id: user.id },
    });

    const { data: updatedWallet } = await supabase
      .from('workspace_wallets')
      .select('*')
      .eq('id', wallet.id)
      .single();

    return new Response(
      JSON.stringify({ wallet: updatedWallet }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('wallet-fund error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
