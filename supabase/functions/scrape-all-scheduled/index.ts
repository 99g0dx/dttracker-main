import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Age-based scraping schedule
const HOURS_IN_MS = 1000 * 60 * 60;
const INTERVAL_0_48H = 6;
const INTERVAL_2_7D = 12;
const INTERVAL_7_30D = 24;
const INTERVAL_30D_PLUS = 168; // 7 days

type PostOrSubmission = {
  last_scraped_at?: string | null;
  submitted_at?: string | null;
  posted_date?: string | null;
  created_at?: string | null;
};

function shouldScrapeByAge(item: PostOrSubmission, now: Date): boolean {
  const referenceDate = item.submitted_at
    ? new Date(item.submitted_at)
    : item.posted_date
    ? new Date(item.posted_date)
    : item.created_at
    ? new Date(item.created_at)
    : now;
  const refTime = referenceDate.getTime();
  if (Number.isNaN(refTime)) return true;

  const lastScraped = item.last_scraped_at
    ? new Date(item.last_scraped_at).getTime()
    : null;
  const hoursSinceLastScrape =
    lastScraped != null ? (now.getTime() - lastScraped) / HOURS_IN_MS : Infinity;
  const hoursSincePosted = (now.getTime() - refTime) / HOURS_IN_MS;

  let minInterval: number;
  if (hoursSincePosted <= 48) {
    minInterval = INTERVAL_0_48H;
  } else if (hoursSincePosted <= 168) {
    // 7 days
    minInterval = INTERVAL_2_7D;
  } else if (hoursSincePosted <= 720) {
    // 30 days
    minInterval = INTERVAL_7_30D;
  } else {
    minInterval = INTERVAL_30D_PLUS;
  }

  return hoursSinceLastScrape >= minInterval;
}

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
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    console.log("=== Scheduled Auto-Scraping Started ===");
    console.log("Timestamp:", now.toISOString());

    const scrapeSubmissionUrl = `${supabaseUrl}/functions/v1/scrape-activation-submission`;
    const serviceRoleHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    };

    const MAX_POSTS = 15;
    const MAX_SUBMISSIONS = 15;
    let jobsEnqueued = 0;
    let contestSuccess = 0;
    let contestErrors = 0;
    const errors: Array<{ id: string; type: string; message: string }> = [];

    // ========== Part 1: Campaign Tracking Posts ==========
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("status", "active");

    const campaignIds = campaigns?.map((c) => c.id) ?? [];
    if (campaignIds.length > 0) {
      const { data: posts, error: fetchError } = await supabase
        .from("posts")
        .select(
          `id, post_url, platform, campaign_id, posted_date, last_scraped_at, created_at, status,
           initial_scrape_completed, initial_scrape_attempted, initial_scrape_failed`
        )
        .in("campaign_id", campaignIds)
        .not("post_url", "is", null)
        .in("status", ["pending", "scraped", "failed", "manual"]);

      if (fetchError) {
        console.error("Error fetching posts:", fetchError);
      } else if (posts && posts.length > 0) {
        const eligiblePosts = posts.filter(
          (p: Record<string, unknown>) =>
            p.initial_scrape_completed === true ||
            (p.initial_scrape_attempted === true &&
              p.initial_scrape_failed === true) ||
            (p.initial_scrape_completed == null &&
              p.initial_scrape_attempted == null &&
              (p.status === "scraped" || p.status === "manual"))
        );

        const duePosts = eligiblePosts.filter((p) =>
          shouldScrapeByAge(p, now)
        );
        const sortedDue = duePosts.sort(
          (a, b) =>
            new Date(a.last_scraped_at ?? a.created_at).getTime() -
            new Date(b.last_scraped_at ?? b.created_at).getTime()
        );
        const postsToScrape = sortedDue.slice(0, MAX_POSTS);

        console.log(
          `Campaign posts: ${posts.length} total, ${duePosts.length} due, enqueueing ${postsToScrape.length}`
        );

        const nowIso = now.toISOString();
        for (const post of postsToScrape) {
          const jobRow = {
            platform: post.platform,
            job_type: "post",
            reference_type: "post",
            reference_id: post.id,
            input: {
              postId: post.id,
              postUrl: post.post_url,
              platform: post.platform,
            },
            priority: 0,
            scheduled_for: nowIso,
            status: "queued",
          };
          const { error: insertErr } = await supabase
            .from("scrape_jobs")
            .insert(jobRow);

          if (insertErr) {
            if (insertErr.code === "23505") {
              const { error: updateErr } = await supabase
                .from("scrape_jobs")
                .update({
                  status: "queued",
                  attempts: 0,
                  scheduled_for: nowIso,
                  next_retry_at: null,
                  updated_at: nowIso,
                })
                .eq("reference_type", "post")
                .eq("reference_id", post.id)
                .in("status", ["failed", "cooldown"]);
              if (!updateErr) jobsEnqueued++;
            }
          } else {
            jobsEnqueued++;
          }
        }
      }
    }

    // ========== Part 2: Contest Activation Submissions ==========
    const { data: activeContests } = await supabase
      .from("activations")
      .select("id")
      .eq("type", "contest")
      .eq("status", "live")
      .gte("deadline", now.toISOString());

    const contestIds = activeContests?.map((c) => c.id) ?? [];
    if (contestIds.length > 0) {
      const { data: submissions, error: subError } = await supabase
        .from("activation_submissions")
        .select("id, content_url, submitted_at, last_scraped_at")
        .in("activation_id", contestIds)
        .eq("status", "approved")
        .not("content_url", "is", null);

      if (subError) {
        console.error("Error fetching contest submissions:", subError);
      } else if (submissions && submissions.length > 0) {
        const dueSubmissions = submissions.filter((s) =>
          shouldScrapeByAge(s, now)
        );
        const sortedSub = dueSubmissions.sort(
          (a, b) =>
            new Date(a.last_scraped_at ?? a.submitted_at ?? 0).getTime() -
            new Date(b.last_scraped_at ?? b.submitted_at ?? 0).getTime()
        );
        const toScrape = sortedSub.slice(0, MAX_SUBMISSIONS);

        console.log(
          `Contest submissions: ${submissions.length} total, ${dueSubmissions.length} due, scraping ${toScrape.length}`
        );

        for (let i = 0; i < toScrape.length; i++) {
          const sub = toScrape[i];
          try {
            const resp = await fetch(scrapeSubmissionUrl, {
              method: "POST",
              headers: serviceRoleHeaders,
              body: JSON.stringify({ submissionId: sub.id }),
            });

            if (!resp.ok) {
              const errText = await resp.text();
              throw new Error(`HTTP ${resp.status}: ${errText}`);
            }

            const result = await resp.json();
            if (result.success !== false && !result.error) {
              contestSuccess++;
            } else {
              contestErrors++;
              errors.push({
                id: sub.id,
                type: "submission",
                message: result.error || "Unknown error",
              });
            }
          } catch (err) {
            contestErrors++;
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({ id: sub.id, type: "submission", message: msg });
          }

          if (i < toScrape.length - 1) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }
    }

    const totalSuccess = contestSuccess;
    const totalErrors = contestErrors;

    console.log(
      `=== Auto-Scraping Complete === Jobs enqueued: ${jobsEnqueued}. Contest: ${contestSuccess} ok, ${contestErrors} err`
    );

    return new Response(
      JSON.stringify({
        success: true,
        jobs_enqueued: jobsEnqueued,
        scraped_count: totalSuccess,
        error_count: totalErrors,
        contest_submissions_scraped: contestSuccess,
        errors: errors.slice(0, 10),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Scheduled scraping error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
