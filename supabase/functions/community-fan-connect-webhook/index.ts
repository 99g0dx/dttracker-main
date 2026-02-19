import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@+/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: SYNC_API_KEY (same as all DT webhooks)
    const syncApiKey = Deno.env.get("SYNC_API_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!syncApiKey || authHeader !== `Bearer ${syncApiKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const body = await req.json();
    const {
      community_token,
      dobble_tap_user_id,
      handle,
      platform,
      email,
      profile_photo,
      follower_count,
    } = body;

    if (!community_token) {
      return new Response(
        JSON.stringify({ error: "community_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!dobble_tap_user_id) {
      return new Response(
        JSON.stringify({ error: "dobble_tap_user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Look up connect token ---
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("community_fan_connect_tokens")
      .select("id, community_fan_id, workspace_id, status, expires_at")
      .eq("token", community_token)
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: "Connect token not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tokenRecord.status === "completed") {
      return new Response(
        JSON.stringify({ error: "Connect token already used", already_completed: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tokenRecord.status === "expired" || new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Connect token has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Get the community fan record ---
    const { data: fan, error: fanError } = await supabase
      .from("community_fans")
      .select("id, handle, platform, email, workspace_id")
      .eq("id", tokenRecord.community_fan_id)
      .single();

    if (fanError || !fan) {
      console.error("Community fan not found:", tokenRecord.community_fan_id);
      return new Response(
        JSON.stringify({ error: "Community fan record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Find or create creator record ---
    const normalizedHandle = normalizeHandle(handle || fan.handle);
    const normalizedPlatform = (platform || fan.platform).toLowerCase().trim();

    // Check if creator already exists by dobble_tap_user_id
    let creatorId: string | null = null;

    const { data: existingCreator } = await supabase
      .from("creators")
      .select("id")
      .eq("dobble_tap_user_id", dobble_tap_user_id)
      .maybeSingle();

    if (existingCreator) {
      creatorId = existingCreator.id;
      // Update with latest info
      await supabase
        .from("creators")
        .update({
          handle: normalizedHandle,
          platform: normalizedPlatform,
          email: email || fan.email,
          profile_photo: profile_photo || null,
          follower_count: follower_count || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);
    } else {
      // Check by handle + platform
      const { data: handleCreator } = await supabase
        .from("creators")
        .select("id")
        .ilike("handle", normalizedHandle)
        .eq("platform", normalizedPlatform)
        .maybeSingle();

      if (handleCreator) {
        creatorId = handleCreator.id;
        // Link to DT
        await supabase
          .from("creators")
          .update({
            dobble_tap_user_id: dobble_tap_user_id,
            email: email || fan.email,
            profile_photo: profile_photo || null,
            follower_count: follower_count || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", creatorId);
      } else {
        // Create new creator
        const { data: newCreator, error: createError } = await supabase
          .from("creators")
          .insert({
            user_id: null, // Dobble Tap sourced — no DTTracker auth user
            handle: normalizedHandle,
            name: handle || normalizedHandle,
            platform: normalizedPlatform,
            email: email || fan.email,
            dobble_tap_user_id: dobble_tap_user_id,
            profile_photo: profile_photo || null,
            follower_count: follower_count || null,
            status: "active",
          })
          .select("id")
          .single();

        if (createError || !newCreator) {
          console.error("Failed to create creator:", createError?.message);
          return new Response(
            JSON.stringify({ error: "Failed to create creator record" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        creatorId = newCreator.id;
      }
    }

    // --- Link community fan to creator ---
    await supabase
      .from("community_fans")
      .update({
        creator_id: creatorId,
        follower_count: follower_count || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fan.id);

    // --- Mark connect token as completed ---
    await supabase
      .from("community_fan_connect_tokens")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", tokenRecord.id);

    console.log("Community fan connected:", {
      fan_id: fan.id,
      creator_id: creatorId,
      dobble_tap_user_id: dobble_tap_user_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        community_fan_id: fan.id,
        creator_id: creatorId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in community-fan-connect-webhook:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
