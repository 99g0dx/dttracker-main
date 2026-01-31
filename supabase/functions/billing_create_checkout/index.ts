import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  paystackRequest,
  resolveAmountInMinorUnits,
  toInt,
} from "../_shared/billing.ts";

const ADMIN_ROLES = new Set(["brand_owner", "agency_admin"]);

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

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseAuth = getSupabaseAuthClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      workspace_id: workspaceId,
      tier,
      billing_cycle: billingCycle,
      extra_seats: extraSeatsInput,
      callback_url: callbackUrl,
    } = await req.json();

    if (!workspaceId || !tier || !billingCycle) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["free", "starter", "pro", "agency"].includes(tier)) {
      return new Response(JSON.stringify({ error: "Invalid tier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      return new Response(JSON.stringify({ error: "Invalid billing cycle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extraSeats = Math.max(0, toInt(extraSeatsInput, 0));

    const supabase = getSupabaseAdmin();
    let hasAdminAccess = false;

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membershipError && membership && ADMIN_ROLES.has(membership.role)) {
      hasAdminAccess = true;
    }

    if (!hasAdminAccess) {
      const { data: workspaceOwner, error: workspaceError } = await supabase
        .from("workspaces")
        .select("owner_user_id")
        .eq("id", workspaceId)
        .maybeSingle();

      if (!workspaceError && workspaceOwner?.owner_user_id === user.id) {
        hasAdminAccess = true;
      }
    }

    if (!hasAdminAccess && workspaceId === user.id) {
      hasAdminAccess = true;
    }

    if (!hasAdminAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plan_catalog")
      .select("*")
      .eq("tier", tier)
      .eq("billing_cycle", billingCycle)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Invalid plan selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (plan.tier === "free") {
      return new Response(JSON.stringify({ error: "Free plan has no checkout" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan.paystack_base_plan_code) {
      return new Response(JSON.stringify({ error: "Missing Paystack plan mapping" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (extraSeats > 0 && !plan.extra_seat_price_cents) {
      return new Response(JSON.stringify({ error: "Extra seats not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const includedSeats = plan.included_seats;
    const extraSeatPrice = plan.extra_seat_price_cents || 0;
    const totalSeats = includedSeats + extraSeats;
    const totalPriceCents = plan.base_price_cents + extraSeats * extraSeatPrice;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", workspaceId)
      .single();

    const ownerUserId = workspace?.owner_user_id || user.id;
    const { data: ownerUser } = await supabase.auth.admin.getUserById(
      ownerUserId
    );
    const email = ownerUser?.user?.email || user.email;

    if (!email) {
      return new Response(JSON.stringify({ error: "Workspace owner email missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerCode = existingSub?.paystack_customer_code || null;
    if (!customerCode) {
      const customer = await paystackRequest("/customer", "POST", {
        email,
        metadata: { workspace_id: workspaceId },
      });
      customerCode = customer.data.customer_code;
    }

    if (existingSub) {
      await supabase
        .from("subscriptions")
        .update({
          tier: plan.tier,
          billing_cycle: plan.billing_cycle,
          included_seats: includedSeats,
          extra_seats: extraSeats,
          total_seats: totalSeats,
          base_plan_code: plan.paystack_base_plan_code,
          seat_plan_code: plan.paystack_seat_plan_code,
          paystack_customer_code: customerCode,
        })
        .eq("id", existingSub.id);
    } else {
      await supabase.from("subscriptions").insert({
        workspace_id: workspaceId,
        tier: plan.tier,
        billing_cycle: plan.billing_cycle,
        status: "incomplete",
        included_seats: includedSeats,
        extra_seats: extraSeats,
        total_seats: totalSeats,
        base_plan_code: plan.paystack_base_plan_code,
        seat_plan_code: plan.paystack_seat_plan_code,
        paystack_customer_code: customerCode,
      });
    }

    const reference = `dtt_${workspaceId.slice(0, 8)}_${Date.now()}`;
    const { amount, currency } = resolveAmountInMinorUnits(totalPriceCents);

    const initResponse = await paystackRequest("/transaction/initialize", "POST", {
      email,
      amount,
      currency,
      reference,
      callback_url:
        callbackUrl || `${Deno.env.get("APP_URL") || ""}/billing/success`,
      metadata: {
        workspace_id: workspaceId,
        tier: plan.tier,
        billing_cycle: plan.billing_cycle,
        extra_seats: extraSeats,
        included_seats: includedSeats,
        total_seats: totalSeats,
        base_plan_code: plan.paystack_base_plan_code,
        seat_plan_code: plan.paystack_seat_plan_code,
        base_price_cents: plan.base_price_cents,
        extra_seat_price_cents: extraSeatPrice,
      },
      channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
    });

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
  } catch (error) {
    console.error("billing_create_checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
