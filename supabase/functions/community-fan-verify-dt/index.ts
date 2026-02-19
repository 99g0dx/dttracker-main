import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invite_token, email } = await req.json();

    // Token is required to prevent user enumeration
    if (!invite_token || typeof invite_token !== "string") {
      return new Response(
        JSON.stringify({ error: "invite_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const dobbleTapApi = Deno.env.get("DOBBLE_TAP_API") ?? "";
    const syncApiKey = Deno.env.get("SYNC_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate invite token first
    const { data: inviteData, error: inviteError } = await supabase.rpc(
      "get_community_invite_by_token",
      { p_token: invite_token },
    );

    if (inviteError || !inviteData || inviteData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid invite token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // --- Primary: Call Dobble Tap API to look up user by email ---
    // DT is the source of truth — it knows all handles linked to an email,
    // including users who aren't creators in DTTracker yet.
    if (dobbleTapApi && syncApiKey) {
      try {
        const dtResponse = await fetch(`${dobbleTapApi}/users/lookup-by-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${syncApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        if (dtResponse.ok) {
          const dtData = await dtResponse.json();
          // Expected response: { user_id: string, handles: Array<{ handle: string, platform: string }> }
          if (dtData?.user_id && Array.isArray(dtData?.handles) && dtData.handles.length > 0) {
            return new Response(
              JSON.stringify({
                found: true,
                dobble_tap_user_id: dtData.user_id,
                handles: dtData.handles,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          // DT responded OK but no handles — fall through to local DB
          console.warn("DT API returned OK but no handles, falling back to local DB");
        } else {
          // Any non-2xx (including 404 for missing endpoint) — fall through to local DB
          console.warn("DT API returned status", dtResponse.status, "— falling back to local DB");
        }
      } catch (dtErr) {
        // Network error or DT down — fall through to local DB
        console.warn("DT API lookup failed, falling back to local DB:", dtErr);
      }
    }

    // --- Fallback: look up in DTTracker local DB (synced from DT) ---
    const { data: creatorRows } = await supabase
      .from("creators")
      .select("id, handle, platform, dobble_tap_user_id")
      .ilike("email", normalizedEmail)
      .not("dobble_tap_user_id", "is", null)
      .limit(1);

    if (!creatorRows || creatorRows.length === 0) {
      return new Response(
        JSON.stringify({ found: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const creator = creatorRows[0];

    // Gather all handles: primary + social accounts
    const handles: Array<{ handle: string; platform: string }> = [
      { handle: creator.handle, platform: creator.platform },
    ];

    const { data: socialAccounts } = await supabase
      .from("creator_social_accounts")
      .select("handle, platform")
      .eq("creator_id", creator.id);

    if (socialAccounts) {
      for (const sa of socialAccounts) {
        const duplicate = handles.some(
          (h) =>
            h.handle.toLowerCase() === sa.handle.toLowerCase() &&
            h.platform === sa.platform,
        );
        if (!duplicate) {
          handles.push({ handle: sa.handle, platform: sa.platform });
        }
      }
    }

    return new Response(
      JSON.stringify({
        found: true,
        dobble_tap_user_id: creator.dobble_tap_user_id,
        handles,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(
      "Error in community-fan-verify-dt:",
      error instanceof Error ? error.message : String(error),
    );
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
