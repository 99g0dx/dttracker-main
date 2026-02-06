import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  corsHeaders,
  getPaystackSecret,
  paystackRequest,
} from "../_shared/billing.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        message: "wallet-fund-initialize is deployed",
        hint: "POST with { workspaceId, amount, redirectUrl? } and Authorization header to get Paystack URL.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
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

    const body = await req.json().catch(() => ({}));
    const { workspaceId, amount } = body;

    if (!workspaceId || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid workspaceId or amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountKobo = Math.round(amount * 100);
    if (amountKobo < 10000) {
      return new Response(JSON.stringify({ error: "Minimum amount is ₦100" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    const isOwner = workspaceId === user.id;
    const isAdmin =
      membership?.role &&
      ["brand_owner", "agency_admin"].includes(membership.role);

    if (!isOwner && !isAdmin && !membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden: no access to this workspace" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    getPaystackSecret();
    const appUrl =
      Deno.env.get("APP_URL") || Deno.env.get("VITE_APP_URL") || "";
    const bodyRedirect =
      typeof body.redirectUrl === "string" ? body.redirectUrl.trim() : "";
    const baseUrl = bodyRedirect || appUrl;
    const callbackUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/billing/success?type=wallet`
      : "https://dttracker.app/billing/success?type=wallet";

    const reference = `wallet_${workspaceId.slice(0, 8)}_${Date.now()}`;

    const initResponse = await paystackRequest(
      "/transaction/initialize",
      "POST",
      {
        email: user.email || `user-${user.id}@wallet.dttracker.local`,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: callbackUrl,
        metadata: {
          workspace_id: workspaceId,
          purpose: "wallet_fund",
          amount_ngn: amount,
          user_id: user.id,
        },
        channels: [
          "card",
          "bank",
          "ussd",
          "qr",
          "mobile_money",
          "bank_transfer",
        ],
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: initResponse.data.authorization_url,
        access_code: initResponse.data.access_code,
        reference,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("wallet-fund-initialize error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
