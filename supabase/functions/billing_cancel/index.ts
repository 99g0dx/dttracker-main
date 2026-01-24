import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  paystackRequest,
} from "../_shared/billing.ts";

const ADMIN_ROLES = new Set(["brand_owner", "agency_admin"]);

async function disableSubscription(code: string | null, token: string | null) {
  if (!code || !token) return;
  await paystackRequest("/subscription/disable", "POST", {
    code,
    token,
  });
}

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

    const { workspace_id: workspaceId } = await req.json();

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (!hasAdminAccess) {
      const { data: legacyMember, error: legacyError } = await supabase
        .from("team_members")
        .select("role,status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (
        !legacyError &&
        legacyMember &&
        ["owner", "admin"].includes(legacyMember.role) &&
        legacyMember.status !== "inactive"
      ) {
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

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription || subscription.tier === "free") {
      return new Response(
        JSON.stringify({ error: "No paid subscription found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await disableSubscription(
      subscription.paystack_base_subscription_code,
      subscription.paystack_base_email_token
    );
    await disableSubscription(
      subscription.paystack_seat_subscription_code,
      subscription.paystack_seat_email_token
    );

    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: true,
      })
      .eq("workspace_id", workspaceId);

    return new Response(
      JSON.stringify({ success: true, cancel_at_period_end: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("billing_cancel error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
