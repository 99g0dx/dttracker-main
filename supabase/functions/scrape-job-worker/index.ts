import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MS = [5 * 60 * 1000, 20 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]; // 5m, 20m, 1h, 6h, 24h
const MAX_JOBS_PER_RUN = 10;
const CONCURRENCY = 3; // Process 3 jobs in parallel

type Job = {
  id: string;
  platform: string;
  job_type: string;
  reference_id: string;
  reference_type: string;
  input: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  last_actor_id: string | null;
};

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

    // Auth is always required. If SCRAPE_TRIGGER_TOKEN is not configured,
    // reject all requests — do not allow unauthenticated access.
    if (!triggerToken) {
      console.error("scrape-job-worker: SCRAPE_TRIGGER_TOKEN is not set — rejecting all requests");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized — server misconfigured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    // Recover jobs that were left in "running" state for more than 10 minutes
    // This can happen if a previous worker invocation crashed mid-run.
    await supabase
      .from("scrape_jobs")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("status", "running")
      .lt(
        "updated_at",
        new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      );

    // Atomically claim jobs using RPC (prevents race conditions with concurrent workers)
    const { data: jobs, error: jobsError } = await supabase.rpc("claim_scrape_jobs", {
      p_limit: MAX_JOBS_PER_RUN,
    });

    if (jobsError) {
      console.error("Failed to claim jobs:", jobsError);
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
    const scrapeSubmissionUrl = `${supabaseUrl}/functions/v1/scrape-activation-submission`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    };

    // Process a single job
    const processJob = async (job: Job): Promise<boolean> => {
      // Route to appropriate handler based on job_type
      if (job.job_type === "post") {
        // Process post scraping job

      const input = job.input as { postId?: string; postUrl?: string; platform?: string };
      if (!input?.postId || !input?.postUrl || !input?.platform) {
        await supabase
          .from("scrape_jobs")
          .update({ status: "failed", last_error: "Invalid job input (missing postId/postUrl/platform)" })
          .eq("id", job.id);
        return true;
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
        // Reset job status back to queued since we failed to create the run
        await supabase
          .from("scrape_jobs")
          .update({ status: "queued", updated_at: new Date().toISOString() })
          .eq("id", job.id);
        return false;
      }

      // Job status is already set to "running" by claim_scrape_jobs RPC

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
        return true;
      }

      const errorMessage = result?.error ?? `HTTP ${scrapeRes.status}`;
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
      processed++;
      } else if (job.job_type === "activation_submission") {
        // Process activation submission scraping job
        const input = job.input as { submissionId?: string; contentUrl?: string };
        if (!input?.submissionId || !input?.contentUrl) {
          await supabase
            .from("scrape_jobs")
            .update({ status: "failed", last_error: "Invalid job input (missing submissionId/contentUrl)" })
            .eq("id", job.id);
          return true;
        }

        const { data: run, error: runInsertError } = await supabase
          .from("scrape_runs")
          .insert({
            job_id: job.id,
            actor_id: "activation_submission_scraper",
            status: "started",
            started_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (runInsertError || !run?.id) {
          console.error("Failed to insert scrape_runs for submission:", runInsertError);
          await supabase
            .from("scrape_jobs")
            .update({ status: "queued", updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return false;
        }

        const scrapeRes = await fetch(scrapeSubmissionUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ submissionId: input.submissionId }),
        });

        const result = await scrapeRes.json().catch(() => ({}));
        const success = scrapeRes.ok && result?.success === true;

        if (success) {
          await supabase
            .from("scrape_jobs")
            .update({ status: "success", updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return true;
        }

        const errorMessage = result?.error ?? `HTTP ${scrapeRes.status}`;
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
          updated_at: new Date().toISOString(),
        };

        if (attempts >= job.max_attempts) {
          // Move to dead letter queue before deleting from main queue
          const deadJob = {
            ...job,
            moved_at: new Date().toISOString(),
            resolution: "max_attempts_exceeded" as const,
          };
          await supabase.from("scrape_jobs_dead").insert(deadJob);
          // Delete from main queue
          await supabase.from("scrape_jobs").delete().eq("id", job.id);
          return true;
        } else {
          update.status = "cooldown";
          update.next_retry_at = nextRetryAt;
          update.scheduled_for = nextRetryAt;
          await supabase.from("scrape_jobs").update(update).eq("id", job.id);
          return true;
        }
      } else {
        // Unknown job type - mark as failed
        await supabase
          .from("scrape_jobs")
          .update({ status: "failed", last_error: `Unknown job_type: ${job.job_type}` })
          .eq("id", job.id);
        return true;
      }
    };

    // Process jobs in parallel batches
    const jobArray = jobs as Job[];
    let processed = 0;
    const chunks: Job[][] = [];
    for (let i = 0; i < jobArray.length; i += CONCURRENCY) {
      chunks.push(jobArray.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map((job) => processJob(job)));
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          processed++;
        } else if (result.status === "rejected") {
          console.error("Job processing error:", result.reason);
        }
      }
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
