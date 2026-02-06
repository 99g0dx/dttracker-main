/**
 * Manual wallet credit for Paystack payments that succeeded but were not
 * credited (e.g. webhook failed and Paystack doesn't support resend).
 *
 * Secured by SUPABASE_SERVICE_ROLE_KEY (Bearer token).
 * Body: { workspace_id: string, paystack_reference: string, amount_ngn: number }
 *
 * Idempotent: if a fund transaction already exists for this reference,
 * returns 200 with already_credited: true.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Only allow service role (admin/script) to call this
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      workspace_id: workspaceId,
      paystack_reference: paystackReference,
      amount_ngn: amountNgn,
    } = body;

    if (
      !workspaceId ||
      typeof workspaceId !== "string" ||
      !paystackReference ||
      typeof paystackReference !== "string"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Missing or invalid workspace_id or paystack_reference (strings required)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amount = Number(amountNgn);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({
          error: "amount_ngn must be a positive number (e.g. 5000 for ₦5,000)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const reference = String(paystackReference).trim();
    const now = new Date();

    // Idempotency: already credited for this reference?
    const { data: existingTxs } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("type", "fund")
      .eq("reference_type", "payment_provider")
      .contains("metadata", { paystack_reference: reference })
      .limit(1);

    if (existingTxs?.[0]) {
      return new Response(
        JSON.stringify({
          success: true,
          already_credited: true,
          message: "Wallet was already credited for this Paystack reference",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get or create wallet
    let { data: wallet, error: walletError } = await supabaseAdmin
      .from("workspace_wallets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (walletError) {
      console.error("wallet-credit-manual: fetch wallet error", walletError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch wallet", details: walletError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!wallet) {
      const { data: newWallet, error: insertErr } = await supabaseAdmin
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
        console.error("wallet-credit-manual: create wallet error", insertErr);
        return new Response(
          JSON.stringify({
            error: "Failed to create wallet",
            details: insertErr?.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      wallet = newWallet;
    }

    const currentBalance = Number(wallet.balance) || 0;
    const newBalance = currentBalance + amount;

    const { error: updateError } = await supabaseAdmin
      .from("workspace_wallets")
      .update({
        balance: newBalance,
        updated_at: now.toISOString(),
      })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("wallet-credit-manual: update balance error", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to update wallet balance",
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const lockedAfter = Number(wallet.locked_balance) || 0;
    await supabaseAdmin.from("wallet_transactions").insert({
      workspace_id: workspaceId,
      type: "fund",
      amount,
      balance_after: newBalance,
      locked_balance_after: lockedAfter,
      reference_type: "payment_provider",
      reference_id: null,
      description: "Manual credit (Paystack reference not credited by webhook)",
      status: "completed",
      processed_at: new Date().toISOString(),
      metadata: {
        paystack_reference: reference,
        manual_credit: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        already_credited: false,
        workspace_id: workspaceId,
        paystack_reference: reference,
        amount_ngn: amount,
        previous_balance: currentBalance,
        new_balance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("wallet-credit-manual error:", err);
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
