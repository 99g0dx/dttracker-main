/**
 * Manually credit a workspace wallet for a Paystack payment that succeeded
 * but was not credited (e.g. webhook failed). Uses Supabase client directly —
 * no Edge Function deploy needed.
 *
 * Usage:
 *   npx tsx scripts/credit-wallet-manual.ts <workspace_id> <paystack_reference> <amount_ngn>
 *
 * Example:
 *   npx tsx scripts/credit-wallet-manual.ts "550e8400-e29b-41d4-a716-446655440000" "wallet_550e8400_1707123456789" 5000
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or .env).
 */

import { createClient } from "@supabase/supabase-js";

const workspaceId = process.argv[2];
const paystackReference = process.argv[3];
const amountNgN = process.argv[4];

if (!workspaceId || !paystackReference || !amountNgN) {
  console.error(
    "Usage: npx tsx scripts/credit-wallet-manual.ts <workspace_id> <paystack_reference> <amount_ngn>"
  );
  process.exit(1);
}

const amount = Number(amountNgN);
if (!Number.isFinite(amount) || amount <= 0) {
  console.error("amount_ngn must be a positive number (e.g. 5000 for ₦5,000)");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in env or .env)"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const reference = String(paystackReference).trim();
const now = new Date().toISOString();

async function main() {
  // Idempotency: already credited for this reference?
  const { data: existingTxs } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("type", "fund")
    .eq("reference_type", "payment_provider")
    .contains("metadata", { paystack_reference: reference })
    .limit(1);

  if (existingTxs?.[0]) {
    console.log("Already credited for this Paystack reference. Skipping.");
    process.exit(0);
  }

  // Get or create wallet
  let { data: wallet, error: walletError } = await supabase
    .from("workspace_wallets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (walletError) {
    console.error("Failed to fetch wallet:", walletError.message);
    process.exit(1);
  }

  if (!wallet) {
    const { data: newWallet, error: insertErr } = await supabase
      .from("workspace_wallets")
      .insert({
        workspace_id: workspaceId,
        balance: 0,
        locked_balance: 0,
        pending_balance: 0,
        lifetime_spent: 0,
        currency: "NGN",
      })
      .select()
      .single();

    if (insertErr || !newWallet) {
      console.error("Failed to create wallet:", insertErr?.message);
      process.exit(1);
    }
    wallet = newWallet;
  }

  const currentBalance = Number(wallet.balance) || 0;
  const newBalance = currentBalance + amount;

  const { error: updateError } = await supabase
    .from("workspace_wallets")
    .update({ balance: newBalance, updated_at: now })
    .eq("id", wallet.id);

  if (updateError) {
    console.error("Failed to update wallet balance:", updateError.message);
    process.exit(1);
  }

  const lockedAfter = Number(wallet.locked_balance) || 0;
  const { error: txError } = await supabase.from("wallet_transactions").insert({
    workspace_id: workspaceId,
    type: "fund",
    amount,
    balance_after: newBalance,
    locked_balance_after: lockedAfter,
    reference_type: "payment_provider",
    reference_id: null,
    description: "Manual credit (Paystack reference not credited by webhook)",
    status: "completed",
    processed_at: now,
    metadata: { paystack_reference: reference, manual_credit: true },
  });

  if (txError) {
    console.error("Failed to insert transaction:", txError.message);
    process.exit(1);
  }

  console.log(
    `Credited workspace ${workspaceId}: ₦${amount} (reference: ${reference}). New balance: ₦${newBalance}`
  );
}

main();
