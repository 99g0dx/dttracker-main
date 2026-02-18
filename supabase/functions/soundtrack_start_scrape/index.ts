import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[soundtrack_start_scrape] Request received");

  try {
    const { soundTrackId, workspaceId, soundUrl: rawSoundUrl, maxItems = 200 } = await req.json();

    if (!soundTrackId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "soundTrackId and workspaceId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase config
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "";
    const apifyToken = Deno.env.get("APIFY_API_TOKEN") ?? "";

    if (!supabaseUrl || !supabaseServiceKey || !apifyToken) {
      console.error("[soundtrack_start_scrape] Missing configuration");
      return new Response(
        JSON.stringify({ error: "Missing Supabase or Apify configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve sound URL - if not provided, look it up from sound_tracks or sounds table
    let soundUrl = rawSoundUrl || "";
    if (!soundUrl) {
      console.log("[soundtrack_start_scrape] No soundUrl provided, looking up from DB");
      // Try sound_tracks first
      const { data: track } = await supabase
        .from("sound_tracks")
        .select("source_url, platform, sound_platform_id")
        .eq("id", soundTrackId)
        .maybeSingle();
      if (track?.source_url) {
        soundUrl = track.source_url;
      } else {
        // Try sounds table
        const { data: sound } = await supabase
          .from("sounds")
          .select("sound_page_url, platform, canonical_sound_key")
          .eq("id", soundTrackId)
          .maybeSingle();
        if (sound?.sound_page_url) {
          soundUrl = sound.sound_page_url;
        } else if (sound?.canonical_sound_key && sound?.platform) {
          // Reconstruct URL from canonical key
          if (sound.platform === "tiktok") {
            soundUrl = `https://www.tiktok.com/music/${sound.canonical_sound_key}`;
          } else if (sound.platform === "instagram") {
            soundUrl = `https://www.instagram.com/reels/audio/${sound.canonical_sound_key}/`;
          }
          console.log("[soundtrack_start_scrape] Reconstructed URL from canonical key:", soundUrl);
        }
      }
    }

    if (!soundUrl) {
      return new Response(
        JSON.stringify({ error: "Could not determine sound URL. Please provide soundUrl or ensure the sound record has a URL." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[soundtrack_start_scrape] Resolved soundUrl:", soundUrl);

    // Detect platform from URL
    let platform: "tiktok" | "instagram" = "tiktok";
    if (soundUrl.includes("instagram.com")) {
      platform = "instagram";
    }

    console.log("[soundtrack_start_scrape] Platform:", platform, "URL:", soundUrl);

    // Clean up stale jobs stuck in "running" or "queued" for over 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabase
      .from("sound_scrape_jobs")
      .update({ status: "failed", error: "Timed out (stale job)", finished_at: new Date().toISOString() })
      .eq("sound_track_id", soundTrackId)
      .in("status", ["queued", "running"])
      .lt("created_at", thirtyMinutesAgo);

    // Check for recent successful scrape (within 6 hours) - skip re-scrape if found
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentJob } = await supabase
      .from("sound_scrape_jobs")
      .select("id, status, finished_at")
      .eq("sound_track_id", soundTrackId)
      .eq("provider", "apify")
      .eq("status", "success")
      .gte("created_at", sixHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentJob) {
      console.log("[soundtrack_start_scrape] Recent successful scrape found, returning cached job");
      return new Response(
        JSON.stringify({
          jobId: recentJob.id,
          status: "cached",
          message: "Using recent scrape results",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Build actor-specific input
    let actorId: string;
    let actorInput: Record<string, unknown>;

    if (platform === "tiktok") {
      actorId = "clockworks~tiktok-sound-scraper";

      // Extract music ID from TikTok URL
      // Patterns: /music/Title-7595744832015730704 or /music/7595744832015730704
      let musicId = "";
      const idMatch = soundUrl.match(/music\/(?:[^/]*?-)?(\d{10,})/);
      if (idMatch) {
        musicId = idMatch[1];
      }

      // clockworks actor expects { musics: ["<tiktok sound URL>"] }
      // Always pass the full sound URL — the actor handles ID extraction internally
      actorInput = {
        musics: [soundUrl],
        maxItems: Math.min(maxItems, 1000),
      };
      console.log("[soundtrack_start_scrape] TikTok sound URL:", soundUrl, musicId ? `(musicId: ${musicId})` : "(no musicId extracted)");
    } else {
      // Instagram: codenest/instagram-reels-audio-scraper-downloader
      actorId = "codenest~instagram-reels-audio-scraper-downloader";

      actorInput = {
        urls: [soundUrl],
        maxItems: Math.min(maxItems, 500),
      };
      console.log("[soundtrack_start_scrape] Instagram actor input:", { url: soundUrl });
    }

    // Create scrape job record
    const { data: job, error: jobError } = await supabase
      .from("sound_scrape_jobs")
      .insert({
        sound_track_id: soundTrackId,
        workspace_id: workspaceId,
        provider: "apify",
        status: "queued",
        input: { ...actorInput, platform, actorId },
      })
      .select()
      .single();

    if (jobError) {
      console.error("[soundtrack_start_scrape] Error creating job:", jobError);
      return new Response(
        JSON.stringify({ error: `Failed to create scrape job: ${jobError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[soundtrack_start_scrape] Job created:", job.id);

    // Webhook config
    const webhookUrl = `${supabaseUrl}/functions/v1/soundtrack_scrape_webhook`;
    const webhookSecret = Deno.env.get("APIFY_WEBHOOK_SECRET") || Deno.env.get("SB_SERVICE_ROLE_KEY")?.slice(0, 20) || "default-secret";

    console.log("[soundtrack_start_scrape] Starting Apify actor:", actorId);

    // Apify requires webhooks as base64-encoded JSON query parameter, NOT in the body.
    // IMPORTANT: Apify only supports these template variables: {{resource}}, {{eventType}},
    // {{eventData}}, {{userId}}, {{createdAt}}. The {{resource}} variable is replaced with
    // the full run object (containing id, status, defaultDatasetId, etc.) — it must NOT
    // be quoted since it's a JSON object, not a string.
    const payloadTemplate = `{"resource":{{resource}},"eventType":"{{eventType}}","secret":"${webhookSecret}","platform":"${platform}"}`;
    const webhooksConfig = [
      {
        eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED"],
        requestUrl: webhookUrl,
        payloadTemplate,
      },
    ];
    const webhooksBase64 = btoa(JSON.stringify(webhooksConfig));

    const apifyRunUrl = `https://api.apify.com/v2/acts/${actorId}/runs?webhooks=${encodeURIComponent(webhooksBase64)}`;
    console.log("[soundtrack_start_scrape] Apify run URL:", apifyRunUrl.replace(apifyToken, "***"));

    const apifyResponse = await fetch(apifyRunUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actorInput),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error("[soundtrack_start_scrape] Apify API error:", errorText);

      await supabase
        .from("sound_scrape_jobs")
        .update({
          status: "failed",
          error: `Apify API error: ${apifyResponse.status}`,
          error_details: { response: errorText },
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({ error: `Failed to start Apify scrape: ${apifyResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apifyRun = await apifyResponse.json();
    const runId = apifyRun.data.id;
    const datasetId = apifyRun.data.defaultDatasetId;

    console.log("[soundtrack_start_scrape] Apify run started:", runId, "platform:", platform);

    await supabase
      .from("sound_scrape_jobs")
      .update({
        status: "running",
        run_id: runId,
        dataset_id: datasetId,
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({
        jobId: job.id,
        runId,
        datasetId,
        platform,
        status: "running",
        message: "Scrape job started successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[soundtrack_start_scrape] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
