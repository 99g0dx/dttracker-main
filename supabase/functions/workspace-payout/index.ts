/**
 * Workspace payout: create withdrawal_request and deduct from workspace wallet.
 * Minimal flow: no Paystack transfer; records payout for manual processing.
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      workspace_id: workspaceId,
      activation_submission_id: activationSubmissionId,
      creator_id: creatorId,
      amount,
      bank_name,
      account_number,
      account_name,
    } = body;

    if (!workspaceId || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "workspace_id and positive amount required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", workspaceId)
      .single();

    const isAdmin =
      workspace?.owner_user_id === user.id ||
      (membership?.role && ["brand_owner", "agency_admin"].includes(membership.role));

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { data: wallet, error: walletError } = await supabase
      .from("workspace_wallets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const available = Number(wallet.balance) || 0;
    if (available < amount) {
      return new Response(
        JSON.stringify({ error: `Insufficient balance. Available: ${available}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: withdrawal, error: insertErr } = await supabase
      .from("withdrawal_requests")
      .insert({
        workspace_id: workspaceId,
        activation_submission_id: activationSubmissionId ?? null,
        creator_id: creatorId ?? null,
        amount,
        status: "pending",
        bank_name: bank_name ?? null,
        account_number: account_number ?? null,
        account_name: account_name ?? null,
        requested_at: new Date().toISOString(),
        processed_by: user.id,
      })
      .select()
      .single();

    if (insertErr || !withdrawal) {
      return new Response(
        JSON.stringify({ error: insertErr?.message ?? "Failed to create withdrawal request" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newBalance = available - amount;
    const lockedAfter = Number(wallet.locked_balance) || 0;

    const { error: updateErr } = await supabase
      .from("workspace_wallets")
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);

    if (updateErr) {
      await supabase
        .from("withdrawal_requests")
        .update({ status: "failed", failure_reason: updateErr.message })
        .eq("id", withdrawal.id);
      return new Response(
        JSON.stringify({ error: "Failed to deduct wallet balance" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase.from("wallet_transactions").insert({
      workspace_id: workspaceId,
      type: "payout",
      amount,
      balance_after: newBalance,
      locked_balance_after: lockedAfter,
      reference_type: "withdrawal_request",
      reference_id: withdrawal.id,
      description: "Payout to creator",
      status: "completed",
      processed_at: new Date().toISOString(),
      metadata: {
        withdrawal_request_id: withdrawal.id,
        activation_submission_id: activationSubmissionId,
        creator_id: creatorId,
      },
    });

    await supabase
      .from("withdrawal_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        payment_provider: "manual",
      })
      .eq("id", withdrawal.id);

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_request_id: withdrawal.id,
        amount,
        new_balance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("workspace-payout error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
