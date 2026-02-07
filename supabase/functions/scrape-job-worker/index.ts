import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MS = [5 * 60 * 1000, 20 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]; // 5m, 20m, 1h, 6h, 24h
const MAX_JOBS_PER_RUN = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const triggerToken = Deno.env.get("SCRAPE_TRIGGER_TOKEN") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (triggerToken) {
      const headerToken = req.headers.get("x-scrape-trigger-token") ?? "";
      const authHeader = req.headers.get("Authorization") ?? "";
      const bearerToken = authHeader.replace("Bearer ", "");
      const isAuthorized =
        headerToken === triggerToken || bearerToken === supabaseServiceKey;
      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    const { data: rows, error: jobsError } = await supabase
      .from("scrape_jobs")
      .select("id, platform, job_type, reference_id, reference_type, input, attempts, max_attempts, last_actor_id")
      .in("status", ["queued", "cooldown"])
      .lte("scheduled_for", now)
      .order("priority", { ascending: false })
      .order("scheduled_for", { ascending: true })
      .limit(MAX_JOBS_PER_RUN * 2);

    const jobs = (rows ?? []).filter(
      (j: { attempts: number; max_attempts: number }) => j.attempts < j.max_attempts
    ).slice(0, MAX_JOBS_PER_RUN);

    if (jobsError) {
      console.error("Failed to fetch jobs:", jobsError);
      return new Response(
        JSON.stringify({ success: false, error: jobsError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No jobs due" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const scrapePostUrl = `${supabaseUrl}/functions/v1/scrape-post`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    };

    let processed = 0;
    for (const job of jobs as Array<{
      id: string;
      platform: string;
      job_type: string;
      reference_id: string;
      reference_type: string;
      input: Record<string, unknown>;
      attempts: number;
      max_attempts: number;
      last_actor_id: string | null;
    }>) {
      if (job.job_type !== "post") continue;

      const input = job.input as { postId?: string; postUrl?: string; platform?: string };
      if (!input?.postId || !input?.postUrl || !input?.platform) {
        await supabase
          .from("scrape_jobs")
          .update({ status: "failed", last_error: "Invalid job input (missing postId/postUrl/platform)" })
          .eq("id", job.id);
        processed++;
        continue;
      }

      let actorId: string;
      const { data: primary } = await supabase
        .from("parser_versions")
        .select("actor_id")
        .eq("platform", job.platform)
        .eq("role", "primary")
        .eq("is_active", true)
        .maybeSingle();
      const { data: fallback } = await supabase
        .from("parser_versions")
        .select("actor_id")
        .eq("platform", job.platform)
        .eq("role", "fallback")
        .eq("is_active", true)
        .maybeSingle();

      const lastWasPrimary = job.last_actor_id === (primary?.actor_id ?? null);
      if (fallback?.actor_id && lastWasPrimary) {
        actorId = fallback.actor_id;
      } else {
        actorId = primary?.actor_id ?? "unknown";
      }

      const { data: run, error: runInsertError } = await supabase
        .from("scrape_runs")
        .insert({
          job_id: job.id,
          actor_id: actorId,
          status: "started",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (runInsertError || !run?.id) {
        console.error("Failed to insert scrape_runs:", runInsertError);
        continue;
      }

      await supabase
        .from("scrape_jobs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      const body = {
        ...input,
        isAutoScrape: true,
        run_id: run.id,
        actor_id: actorId,
      };

      const scrapeRes = await fetch(scrapePostUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const result = await scrapeRes.json().catch(() => ({}));
      const success = scrapeRes.ok && result?.success === true;

      if (success) {
        await supabase
          .from("scrape_jobs")
          .update({ status: "success", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        // Clear cooldown on the post
        await supabase
          .from("posts")
          .update({ next_retry_at: null, cooldown_until: null })
          .eq("id", input.postId);

        processed++;
        continue;
      }

      const errorMessage = result?.error ?? `HTTP ${scrapeRes.status}`;
      const errorType = result?.error_type ?? "unknown";
      const attempts = job.attempts + 1;
      const isBlocked =
        scrapeRes.status === 403 ||
        /blocked|challenge|rate limit|429/i.test(String(errorMessage));
      const nextBackoffMs = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      const nextRetryAt = new Date(
        Date.now() + (isBlocked ? 60 * 60 * 1000 : nextBackoffMs)
      ).toISOString();

      const update: Record<string, unknown> = {
        attempts,
        last_error: errorMessage.substring(0, 2000),
        last_actor_id: actorId,
        updated_at: new Date().toISOString(),
      };

      if (attempts >= job.max_attempts) {
        update.status = "failed";
      } else {
        update.status = "cooldown";
        update.next_retry_at = nextRetryAt;
        update.scheduled_for = nextRetryAt;
      }

      await supabase.from("scrape_jobs").update(update).eq("id", job.id);

      // Mirror next_retry_at / cooldown to the post so UI can show "Retry in X"
      await supabase
        .from("posts")
        .update({
          next_retry_at: attempts >= job.max_attempts ? null : nextRetryAt,
          cooldown_until: attempts >= job.max_attempts ? null : nextRetryAt,
        })
        .eq("id", input.postId);

      processed++;
    }

    return new Response(
      JSON.stringify({ success: true, processed, total: jobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("scrape-job-worker error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
