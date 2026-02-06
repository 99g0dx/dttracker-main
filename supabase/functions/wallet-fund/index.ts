/**
 * DEPRECATED: This function has been disabled.
 *
 * Use wallet-fund-initialize to start a Paystack payment flow.
 * The wallet will be credited automatically via the paystack-webhook when payment succeeds.
 *
 * For manual admin credits (when webhooks fail), use wallet-credit-manual with service role key.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // This function is deprecated - direct wallet funding without payment is not allowed
  return new Response(
    JSON.stringify({
      error: 'This endpoint is deprecated. Use wallet-fund-initialize to start a Paystack payment, or wallet-credit-manual (admin only) for manual credits.',
      hint: 'Call POST /functions/v1/wallet-fund-initialize with { workspaceId, amount } to get a Paystack payment URL.',
    }),
    {
      status: 410, // Gone - indicates this resource is no longer available
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
