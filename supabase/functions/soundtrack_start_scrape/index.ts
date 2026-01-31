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
    const { soundTrackId, workspaceId, soundUrl, maxItems = 200 } = await req.json();

    if (!soundTrackId || !workspaceId || !soundUrl) {
      return new Response(
        JSON.stringify({ error: "soundTrackId, workspaceId, and soundUrl are required" }),
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

    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for recent duplicate scrape (within 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentJob } = await supabase
      .from("sound_scrape_jobs")
      .select("id, status, finished_at")
      .eq("sound_track_id", soundTrackId)
      .eq("provider", "apify")
      .gte("created_at", sixHoursAgo)
      .in("status", ["queued", "running", "success"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentJob && recentJob.status === "success") {
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

    // Create scrape job
    const jobInput = {
      startUrls: [{ url: soundUrl }],
      maxItems: Math.min(maxItems, 1000), // Cap at 1000 for MVP
    };

    const { data: job, error: jobError } = await supabase
      .from("sound_scrape_jobs")
      .insert({
        sound_track_id: soundTrackId,
        workspace_id: workspaceId,
        provider: "apify",
        status: "queued",
        input: jobInput,
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

    // Start Apify actor run
    const actorId = "apidojo/tiktok-music-scraper";
    const apiActorId = actorId.replace(/\//g, "~");
    
    // Get webhook URL for this project
    const webhookUrl = `${supabaseUrl}/functions/v1/soundtrack_scrape_webhook`;
    const webhookSecret = Deno.env.get("APIFY_WEBHOOK_SECRET") || Deno.env.get("SB_SERVICE_ROLE_KEY")?.slice(0, 20) || "default-secret";
    
    console.log("[soundtrack_start_scrape] Starting Apify run with webhook:", webhookUrl);

    const apifyResponse = await fetch(`https://api.apify.com/v2/acts/${apiActorId}/runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startUrls: jobInput.startUrls.map((u: any) => ({ url: u.url })),
        maxItems: jobInput.maxItems,
        webhooks: [
          {
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED"],
            requestUrl: webhookUrl,
            payloadTemplate: JSON.stringify({
              runId: "{{runId}}",
              status: "{{status}}",
              defaultDatasetId: "{{defaultDatasetId}}",
              secret: webhookSecret,
            }),
          },
        ],
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error("[soundtrack_start_scrape] Apify API error:", errorText);
      
      // Update job status to failed
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

    console.log("[soundtrack_start_scrape] Apify run started:", runId);

    // Update job with Apify run info
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
