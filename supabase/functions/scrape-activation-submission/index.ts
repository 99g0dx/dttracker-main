import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { scrapeUrl, detectPlatformFromUrl } from "../_shared/scrape-url.ts";

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
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
    // Allow service role for internal calls (e.g. from scrape-all-scheduled)
    const isServiceRole = token === supabaseServiceKey;
    if (!isServiceRole) {
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
    }

    const body = await req.json();
    const { submissionId } = body;

    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: submission, error: subError } = await supabase
      .from("activation_submissions")
      .select("id, activation_id, content_url, post_url, scrape_count")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use content_url with fallback to post_url
    const scrapableUrl = submission.content_url || submission.post_url;

    if (!scrapableUrl) {
      return new Response(
        JSON.stringify({
          error:
            "Submission has no content URL. The creator must submit a post link before metrics can be scraped.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // If content_url was missing but post_url exists, backfill content_url for future use
    if (!submission.content_url && submission.post_url) {
      await supabase
        .from("activation_submissions")
        .update({ content_url: submission.post_url })
        .eq("id", submissionId);
    }

    const platform = detectPlatformFromUrl(scrapableUrl);

    if (platform === "unknown") {
      return new Response(
        JSON.stringify({
          error: `Could not detect platform from URL: ${scrapableUrl}. Supported platforms: TikTok, Instagram, YouTube, Twitter.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (platform === "facebook") {
      return new Response(
        JSON.stringify({ error: "Facebook scraping is not yet supported" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[scrape-activation-submission] Scraping ${platform} post: ${scrapableUrl}`,
    );

    const metrics = await scrapeUrl(scrapableUrl, platform);

    const performance_score =
      metrics.views + metrics.likes * 2 + metrics.comments * 3;

    const scrapeCount = (submission?.scrape_count ?? 0) + 1;
    const { error: updateError } = await supabase
      .from("activation_submissions")
      .update({
        performance_metrics: {
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
        },
        performance_score,
        last_scraped_at: new Date().toISOString(),
        initial_scrape_completed: true,
        scrape_count: scrapeCount,
      })
      .eq("id", submissionId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics: { ...metrics, performance_score },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("scrape-activation-submission error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
