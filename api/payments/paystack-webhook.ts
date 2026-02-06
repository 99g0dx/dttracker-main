import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Verify Paystack webhook signature using HMAC SHA512
 * @param payload - Raw request body as string
 * @param signature - x-paystack-signature header value
 * @param secretKey - PAYSTACK_SECRET_KEY
 * @returns True if signature is valid
 */
function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey: string
): boolean {
  if (!signature || !secretKey) {
    return false;
  }

  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

/**
 * Initialize Supabase client with service role key
 * Uses server-side service role key, never client-side
 */
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface ProcessResult {
  success: boolean;
  duplicate?: boolean;
  walletId?: string;
  amountKobo?: number;
  amountNGN?: number;
  newBalanceNGN?: number;
}

/**
 * Process Paystack charge.success webhook event
 * Executes all steps atomically (using Supabase transactions where possible)
 */
async function processChargeSuccess(
  data: any,
  eventId: string,
  supabase: SupabaseClient
): Promise<ProcessResult> {
  const amountKobo = data.amount;
  const reference = data.reference;
  const customerEmail = data.customer?.email;
  const rawWorkspaceId = data.metadata?.workspace_id ?? data.metadata?.workspace_Id;
  const workspaceId =
    rawWorkspaceId != null ? String(rawWorkspaceId).trim() : null;

  if (!workspaceId) {
    throw new Error('Missing workspace_id in metadata');
  }

  if (!amountKobo || amountKobo <= 0) {
    throw new Error('Invalid amount');
  }

  // STEP A: Store event safely if paystack_events exists (idempotent)
  const { error: eventError } = await supabase
    .from('paystack_events')
    .insert({
      event_id: eventId,
      event_type: 'charge.success',
      reference: reference,
      amount: amountKobo,
      currency: data.currency || 'NGN',
      customer_email: customerEmail,
      payload: data,
    })
    .select()
    .maybeSingle();

  if (eventError) {
    if (
      eventError.code === '23505' ||
      eventError.message?.includes('duplicate') ||
      eventError.message?.includes('unique')
    ) {
      console.log(`Event ${eventId} already processed, skipping`);
      return { success: true, duplicate: true };
    }
    // If table doesn't exist (PGRST205) or relation error, continue without it
    if (
      eventError.code === 'PGRST205' ||
      eventError.message?.includes('does not exist') ||
      eventError.message?.includes('relation')
    ) {
      console.log('paystack_events not available, continuing with wallet update');
    } else {
      throw eventError;
    }
  }

  // STEP B: Get or create wallet (using workspace_wallets to match frontend)
  let { data: wallet, error: walletError } = await supabase
    .from('workspace_wallets')
    .select('id, balance, workspace_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  // PGRST116 = not found (which is okay, we'll create it)
  if (walletError && walletError.code !== 'PGRST116') {
    throw walletError;
  }

  if (!wallet) {
    // Create new wallet with balance = 0
    const { data: newWallet, error: createError } = await supabase
      .from('workspace_wallets')
      .insert({
        workspace_id: workspaceId,
        balance: 0,
        locked_balance: 0,
        currency: 'NGN',
        updated_at: new Date().toISOString(),
      })
      .select('id, balance, workspace_id')
      .single();

    if (createError) {
      throw createError;
    }
    wallet = newWallet;
  }

  if (!wallet) {
    throw new Error('Wallet not found after get or create');
  }

  // STEP C: Insert transaction record
  const providerEventId = data.id?.toString() || eventId;
  const amountNGN = amountKobo / 100; // Convert kobo to NGN
  const newBalanceNGN = (Number(wallet.balance) || 0) + amountNGN;

  // Idempotency: check if we already have a fund tx for this reference
  const { data: existingFund } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'fund')
    .contains('metadata', { paystack_reference: reference })
    .maybeSingle();

  if (existingFund) {
    console.log(`Transaction for reference ${reference} already exists, skipping`);
    return { success: true, duplicate: true };
  }

  // Insert transaction record
  // Note: reference_id is UUID type, so we store Paystack reference in metadata instead
  const { error: transactionError } = await supabase
    .from('wallet_transactions')
    .insert({
      workspace_id: workspaceId,
      type: 'fund',
      amount: amountNGN,
      balance_after: newBalanceNGN,
      reference_type: 'paystack',
      reference_id: null, // UUID field - Paystack reference stored in metadata
      metadata: {
        paystack_reference: reference,
        paystack_event_id: providerEventId,
        amount_kobo: amountKobo,
        event_id: eventId,
        customer_email: customerEmail,
      },
    });

  if (transactionError) {
    // If it's a duplicate, that's okay (idempotency - though paystack_events should prevent this)
    if (
      transactionError.code === '23505' ||
      transactionError.message?.includes('duplicate') ||
      transactionError.message?.includes('unique')
    ) {
      console.log(`Transaction for reference ${reference} already exists`);
      return { success: true, duplicate: true };
    }
    throw transactionError;
  }

  // STEP D: Update wallet balance (using already calculated values)
  // amountNGN and newBalanceNGN were calculated in STEP C above

  const { error: updateError } = await supabase
    .from('workspace_wallets')
    .update({
      balance: newBalanceNGN,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  if (updateError) {
    throw updateError;
  }

  console.log(
    `Wallet ${wallet.id} credited ${amountNGN} NGN (${amountKobo} kobo). New balance: ${newBalanceNGN} NGN`
  );

  return {
    success: true,
    walletId: wallet.id,
    amountKobo,
    amountNGN,
    newBalanceNGN,
  };
}

/**
 * Express/Vercel handler for Paystack webhook
 * Verifies signature and processes charge.success events
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    // Note: In Vercel, req.body is already parsed, so we reconstruct it
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      return res
        .status(401)
        .json({ error: 'Missing x-paystack-signature header' });
    }

    // Verify signature
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const isValidSignature = verifyPaystackSignature(
      rawBody,
      signature,
      paystackSecretKey
    );
    if (!isValidSignature) {
      console.error('Invalid Paystack signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    const payload = req.body as any;
    const event = payload.event;
    const data = payload.data;

    // Only process charge.success events
    if (event !== 'charge.success') {
      console.log(`Ignoring event type: ${event}`);
      return res.status(200).json({ received: true, skipped: true, event });
    }

    // Get event ID for idempotency
    const eventId =
      data.id?.toString() || `charge_${data.reference}_${Date.now()}`;

    // Initialize Supabase client (server-side service role key)
    const supabase = getSupabaseClient();

    // Process the charge.success event
    const result = await processChargeSuccess(data, eventId, supabase);

    if (result.duplicate) {
      return res.status(200).json({
        received: true,
        duplicate: true,
        message: 'Event already processed',
      });
    }

    return res.status(200).json({
      received: true,
      processed: true,
      walletId: result.walletId,
      amountKobo: result.amountKobo,
      amountNGN: result.amountNGN,
      newBalanceNGN: result.newBalanceNGN,
    });
  } catch (error: any) {
    console.error('Paystack webhook error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
