import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { detectPlatformFromUrl } from "../_shared/scrape-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Age-based scraping schedule (used as a ceiling for very old posts)
const HOURS_IN_MS = 1000 * 60 * 60;
const MINUTES_IN_MS = 1000 * 60;
const INTERVAL_0_48H_HOURS = 6;
const INTERVAL_2_7D_HOURS = 12;
const INTERVAL_7_30D_HOURS = 24;
const INTERVAL_30D_PLUS_HOURS = 168; // 7 days

type PostOrSubmission = {
  id?: string;
  campaign_id?: string;
  last_scraped_at?: string | null;
  submitted_at?: string | null;
  posted_date?: string | null;
  created_at?: string | null;
};

type WorkspacePlanInfo = {
  tier: string;
  scrape_interval_minutes: number;
};

const DEFAULT_SCRAPE_INTERVAL_MINUTES = 2880; // 48h - matches free tier

const TIER_PRIORITY: Record<string, number> = {
  agency: 10,
  pro: 5,
  starter: 2,
  free: 0,
};

function getReferenceDate(item: PostOrSubmission, now: Date): Date {
  const referenceDate = item.submitted_at
    ? new Date(item.submitted_at)
    : item.posted_date
    ? new Date(item.posted_date)
    : item.created_at
    ? new Date(item.created_at)
    : now;
  const refTime = referenceDate.getTime();
  if (Number.isNaN(refTime)) return now;
  return referenceDate;
}

function getAgeBasedIntervalMinutes(item: PostOrSubmission, now: Date): number {
  const referenceDate = getReferenceDate(item, now);
  const hoursSincePosted = (now.getTime() - referenceDate.getTime()) / HOURS_IN_MS;

  let minIntervalHours: number;
  if (hoursSincePosted <= 48) {
    minIntervalHours = INTERVAL_0_48H_HOURS;
  } else if (hoursSincePosted <= 168) {
    // 7 days
    minIntervalHours = INTERVAL_2_7D_HOURS;
  } else if (hoursSincePosted <= 720) {
    // 30 days
    minIntervalHours = INTERVAL_7_30D_HOURS;
  } else {
    minIntervalHours = INTERVAL_30D_PLUS_HOURS;
  }

  return minIntervalHours * 60;
}

function shouldScrapeWithTierInterval(
  item: PostOrSubmission,
  tierIntervalMinutes: number,
  now: Date,
): boolean {
  // If we've never scraped this item, always allow the scrape
  if (!item.last_scraped_at) {
    return true;
  }

  const lastScrapedTime = new Date(item.last_scraped_at).getTime();
  if (Number.isNaN(lastScrapedTime)) {
    return true;
  }

  const minutesSinceLastScrape =
    (now.getTime() - lastScrapedTime) / MINUTES_IN_MS;

  const ageIntervalMinutes = getAgeBasedIntervalMinutes(item, now);
  const effectiveIntervalMinutes = Math.max(
    tierIntervalMinutes || DEFAULT_SCRAPE_INTERVAL_MINUTES,
    ageIntervalMinutes,
  );

  return minutesSinceLastScrape >= effectiveIntervalMinutes;
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

    const MAX_POSTS = 50;
    const MAX_SUBMISSIONS = 30;
    let jobsEnqueued = 0;
    let submissionJobsEnqueued = 0;

    // ========== Part 1: Campaign Tracking Posts ==========
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, workspace_id")
      .eq("status", "active");

    const campaignIds = campaigns?.map((c) => c.id) ?? [];

    // Map campaigns to workspaces and collect unique workspace_ids
    const campaignWorkspaceMap: Record<string, string> = {};
    const workspaceIds = new Set<string>();
    for (const c of campaigns ?? []) {
      if (c.id && c.workspace_id) {
        campaignWorkspaceMap[c.id] = c.workspace_id;
        workspaceIds.add(c.workspace_id);
      }
    }

    // Load workspace plan info (tier + scrape_interval_minutes) for all workspaces
    const workspacePlans: Record<string, WorkspacePlanInfo> = {};
    if (workspaceIds.size > 0) {
      await Promise.all(
        Array.from(workspaceIds).map(async (workspaceId) => {
          const { data: plan, error } = await supabase.rpc(
            "get_workspace_plan",
            { target_workspace_id: workspaceId },
          );
          if (error || !plan) {
            console.error(
              "Failed to load workspace plan for workspace",
              workspaceId,
              error,
            );
            return;
          }
          workspacePlans[workspaceId] = {
            tier: plan.tier ?? "free",
            scrape_interval_minutes:
              plan.scrape_interval_minutes ?? DEFAULT_SCRAPE_INTERVAL_MINUTES,
          };
        }),
      );
    }

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
          (p: any) =>
            p.initial_scrape_completed === true ||
            (p.initial_scrape_attempted === true &&
              p.initial_scrape_failed === true) ||
            (p.initial_scrape_completed == null &&
              p.initial_scrape_attempted == null &&
              (p.status === "scraped" || p.status === "manual"))
        );

        // Attach workspace + tier info and filter by effective interval
        type PostWithMeta = {
          post: any;
          workspaceId: string;
          tier: string;
        };

        const postsWithMeta: PostWithMeta[] = [];
        for (const p of eligiblePosts as any[]) {
          const campaignId = p.campaign_id as string | undefined;
          if (!campaignId) continue;
          const workspaceId = campaignWorkspaceMap[campaignId];
          if (!workspaceId) continue;
          const plan = workspacePlans[workspaceId];
          const tier = plan?.tier ?? "free";
          const intervalMinutes =
            plan?.scrape_interval_minutes ?? DEFAULT_SCRAPE_INTERVAL_MINUTES;

          if (
            shouldScrapeWithTierInterval(
              p,
              intervalMinutes,
              now,
            )
          ) {
            postsWithMeta.push({ post: p, workspaceId, tier });
          }
        }

        // Sort within each workspace by last_scraped_at / created_at
        const postsByWorkspace: Record<string, PostWithMeta[]> = {};
        for (const item of postsWithMeta) {
          const list = postsByWorkspace[item.workspaceId] ??
            (postsByWorkspace[item.workspaceId] = []);
          list.push(item);
        }
        for (const workspaceId of Object.keys(postsByWorkspace)) {
          postsByWorkspace[workspaceId].sort((a, b) => {
            const aTime = new Date(
              a.post.last_scraped_at ?? a.post.created_at,
            ).getTime();
            const bTime = new Date(
              b.post.last_scraped_at ?? b.post.created_at,
            ).getTime();
            return aTime - bTime;
          });
        }

        // Round-robin across workspaces to pick up to MAX_POSTS
        const postsToScrape: PostWithMeta[] = [];
        let round = 0;
        let added = true;
        const workspaceIdList = Object.keys(postsByWorkspace);
        while (added && postsToScrape.length < MAX_POSTS) {
          added = false;
          for (const workspaceId of workspaceIdList) {
            const list = postsByWorkspace[workspaceId];
            if (round < list.length) {
              postsToScrape.push(list[round]);
              added = true;
              if (postsToScrape.length >= MAX_POSTS) break;
            }
          }
          round++;
        }

        console.log(
          `Campaign posts: ${posts.length} total, ${postsWithMeta.length} due (after tier intervals), enqueueing ${postsToScrape.length}`
        );

        const nowIso = now.toISOString();
        for (const item of postsToScrape) {
          const post = item.post;
          const workspaceId = item.workspaceId;
          const plan = workspacePlans[workspaceId];
          const tier = plan?.tier ?? "free";
          const priority = TIER_PRIORITY[tier] ?? 0;

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
            priority,
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
        // Use a default interval for submissions (6 hours for fresh content)
        const defaultIntervalMinutes = INTERVAL_0_48H_HOURS * 60;
        const dueSubmissions = submissions.filter((s) =>
          shouldScrapeWithTierInterval(s, defaultIntervalMinutes, now)
        );
        const sortedSub = dueSubmissions.sort(
          (a, b) =>
            new Date(a.last_scraped_at ?? a.submitted_at ?? 0).getTime() -
            new Date(b.last_scraped_at ?? b.submitted_at ?? 0).getTime()
        );
        const toEnqueue = sortedSub.slice(0, MAX_SUBMISSIONS);

        console.log(
          `Contest submissions: ${submissions.length} total, ${dueSubmissions.length} due, enqueueing ${toEnqueue.length}`
        );

        const nowIso = now.toISOString();
        for (const sub of toEnqueue) {
          if (!sub.content_url) continue;
          const platform = detectPlatformFromUrl(sub.content_url);
          if (platform === "unknown") {
            console.warn(
              `Could not detect platform for submission ${sub.id} with URL: ${sub.content_url}`
            );
            continue;
          }

          const jobRow = {
            platform,
            job_type: "activation_submission",
            reference_type: "activation_submission",
            reference_id: sub.id,
            input: {
              submissionId: sub.id,
              contentUrl: sub.content_url,
            },
            priority: 1, // Higher priority than regular posts
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
                .eq("reference_type", "activation_submission")
                .eq("reference_id", sub.id)
                .in("status", ["failed", "cooldown"]);
              if (!updateErr) submissionJobsEnqueued++;
            }
          } else {
            submissionJobsEnqueued++;
          }
        }
      }
    }

    const totalJobsEnqueued = jobsEnqueued + submissionJobsEnqueued;

    console.log(
      `=== Auto-Scraping Complete === Post jobs enqueued: ${jobsEnqueued}, Submission jobs enqueued: ${submissionJobsEnqueued}, Total: ${totalJobsEnqueued}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        jobs_enqueued: totalJobsEnqueued,
        post_jobs_enqueued: jobsEnqueued,
        submission_jobs_enqueued: submissionJobsEnqueued,
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
