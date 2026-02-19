import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOBBLE_TAP_SIGNUP_URL = "https://www.dobbletap.com/signup";

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@+/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      invite_token,
      path,
      handle,
      platform,
      name,
      email,
      phone,
      dobble_tap_user_id,
    } = body;

    // --- Validate required fields ---
    if (!invite_token || typeof invite_token !== "string") {
      return new Response(
        JSON.stringify({ error: "invite_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!path || !["existing_dt_user", "new_user"].includes(path)) {
      return new Response(
        JSON.stringify({ error: "path must be 'existing_dt_user' or 'new_user'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!handle || typeof handle !== "string" || handle.trim().length < 2 || handle.trim().length > 50) {
      return new Response(
        JSON.stringify({ error: "handle is required (2-50 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedPlatform = (platform || "").toLowerCase().trim();
    if (!VALID_PLATFORMS.includes(normalizedPlatform)) {
      return new Response(
        JSON.stringify({ error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ error: "A valid email address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (path === "existing_dt_user" && !dobble_tap_user_id) {
      return new Response(
        JSON.stringify({ error: "dobble_tap_user_id is required for existing DT users" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Init Supabase ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- Validate invite token ---
    const { data: inviteData, error: inviteError } = await supabase.rpc(
      "get_community_invite_by_token",
      { p_token: invite_token },
    );

    if (inviteError || !inviteData || inviteData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invite link not found or no longer active" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const invite = inviteData[0];
    const workspaceId = invite.workspace_id;
    const workspaceName = invite.workspace_name;
    const normalizedHandle = normalizeHandle(handle);

    // --- Check if fan already exists ---
    const { data: existingFan } = await supabase
      .from("community_fans")
      .select("id, creator_id")
      .eq("workspace_id", workspaceId)
      .eq("platform", normalizedPlatform)
      .ilike("handle", normalizedHandle)
      .maybeSingle();

    if (existingFan) {
      return new Response(
        JSON.stringify({
          success: true,
          fan_id: existingFan.id,
          already_member: true,
          message: "You're already part of this community!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Insert community fan ---
    // (existence check above already returns early if duplicate — plain insert is safe)
    const fanRecord: Record<string, any> = {
      workspace_id: workspaceId,
      handle: normalizedHandle,
      platform: normalizedPlatform,
      name: name?.trim() || null,
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      metadata: {
        joined_via: "invite_link",
        invite_token: invite_token,
      },
    };

    // Store DT user ID directly for Path A fans (avoids indirect lookup via creators table)
    if (path === "existing_dt_user" && dobble_tap_user_id) {
      fanRecord.dobble_tap_user_id = dobble_tap_user_id;
    }

    const { data: fan, error: fanError } = await supabase
      .from("community_fans")
      .insert(fanRecord)
      .select("id, creator_id")
      .single();

    if (fanError || !fan) {
      console.error("Failed to create community fan:", fanError?.message);
      return new Response(
        JSON.stringify({ error: "Failed to join community" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Increment join count ---
    await supabase
      .from("community_invite_links")
      .update({ join_count: invite.join_count + 1, updated_at: new Date().toISOString() })
      .eq("id", invite.id);

    // --- Path A: Existing DT user ---
    if (path === "existing_dt_user") {
      // Try to link to existing creator via dobble_tap_user_id
      const { data: creator } = await supabase
        .from("creators")
        .select("id")
        .eq("dobble_tap_user_id", dobble_tap_user_id)
        .maybeSingle();

      if (creator) {
        await supabase
          .from("community_fans")
          .update({ creator_id: creator.id, updated_at: new Date().toISOString() })
          .eq("id", fan.id);
      }

      // Sync to Dobble Tap (non-blocking)
      try {
        const dobbleTapApi = Deno.env.get("DOBBLE_TAP_API");
        const syncApiKey = Deno.env.get("SYNC_API_KEY");

        if (dobbleTapApi && syncApiKey) {
          await fetch(`${dobbleTapApi}/webhooks/dttracker`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${syncApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              eventType: "community_fan_joined",
              timestamp: new Date().toISOString(),
              data: {
                workspace_id: workspaceId,
                workspace_name: workspaceName,
                fan_handle: normalizedHandle,
                fan_platform: normalizedPlatform,
                fan_email: email.trim().toLowerCase(),
                dobble_tap_user_id: dobble_tap_user_id,
                community_fan_id: fan.id,
              },
            }),
          });
        }
      } catch (syncError) {
        // Non-blocking — log but don't fail the request
        console.error("DT sync error (non-blocking):", syncError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          fan_id: fan.id,
          message: `You've been added to ${workspaceName}'s community!`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Path B: New user (no DT account) ---
    // Generate connect token
    const connectToken = crypto.randomUUID();

    const { error: tokenError } = await supabase
      .from("community_fan_connect_tokens")
      .insert({
        community_fan_id: fan.id,
        workspace_id: workspaceId,
        token: connectToken,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (tokenError) {
      console.error("Failed to create connect token:", tokenError.message);
      // Don't fail — fan was still created. Just skip the redirect.
    }

    // Build redirect URL
    const redirectParams = new URLSearchParams({
      email: email.trim().toLowerCase(),
      handle: normalizedHandle,
      platform: normalizedPlatform,
      ref: "dttracker",
      workspace_id: workspaceId,
    });

    if (name?.trim()) {
      redirectParams.set("name", name.trim());
    }

    if (!tokenError) {
      redirectParams.set("community_token", connectToken);
    }

    const redirectUrl = `${DOBBLE_TAP_SIGNUP_URL}?${redirectParams.toString()}`;

    return new Response(
      JSON.stringify({
        success: true,
        fan_id: fan.id,
        redirect_url: redirectUrl,
        message: `Welcome to ${workspaceName}'s community! Complete your Dobble Tap signup to participate in activations.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in community-fan-join:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
