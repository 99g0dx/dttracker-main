import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function buildPrizeStructure(totalBudget: number): Record<string, number> {
  const first = totalBudget * 0.25;
  const second = totalBudget * 0.15;
  const third = totalBudget * 0.1;
  const remainingPool = totalBudget * 0.5;
  const remainingPerWinner = remainingPool / 17;
  const structure: Record<string, number> = {
    "1": first,
    "2": second,
    "3": third,
  };
  for (let r = 4; r <= 20; r++) structure[String(r)] = remainingPerWinner;
  return structure;
}

function calculatePerformanceScore(
  views: number,
  likes: number,
  comments: number,
): number {
  return views + likes * 2 + comments * 3;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let token: string | null = null;
  try {
    const url = new URL(req.url);
    token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let password: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        password = body.password || null;
      } catch {
        // no body
      }
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select(
        "id, title, brief, image_url, deadline, status, type, total_budget, winner_count, platforms, share_expires_at, share_password_hash, share_password_protected",
      )
      .eq("share_token", token)
      .eq("share_enabled", true)
      .single();

    if (actError || !activation) {
      return new Response(
        JSON.stringify({ error: "Share link not found or expired" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (activation.share_expires_at) {
      const expiresAt = new Date(activation.share_expires_at);
      if (new Date() > expiresAt) {
        return new Response(JSON.stringify({ error: "Link expired" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (activation.share_password_protected) {
      if (!password) {
        return new Response(JSON.stringify({ error: "Password required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hashHex !== activation.share_password_hash) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: submissions, error: subError } = await supabase
      .from("activation_submissions")
      .select(
        "id, creator_id, creator_handle, creator_platform, content_url, post_url, performance_metrics, submitted_at",
      )
      .eq("activation_id", activation.id)
      .order("submitted_at", { ascending: true });

    if (subError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch leaderboard" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const subs = submissions || [];

    const stripAt = (h: string | null | undefined): string | null =>
      h ? h.replace(/^@+/, "").trim() || null : null;

    type SubRow = {
      content_url: string | null;
      post_url: string | null;
      views: number;
      likes: number;
      comments: number;
      submitted_at: string;
    };
    const byCreator = new Map<
      string,
      {
        creator_handle: string | null;
        total_views: number;
        total_likes: number;
        total_comments: number;
        count: number;
        submissions: SubRow[];
      }
    >();

    for (const s of subs) {
      const handle = stripAt(s.creator_handle) || "Unknown";
      const key = s.creator_id ?? `${handle}:${s.creator_platform ?? ""}`;

      if (!byCreator.has(key)) {
        byCreator.set(key, {
          creator_handle: stripAt(s.creator_handle) || null,
          total_views: 0,
          total_likes: 0,
          total_comments: 0,
          count: 0,
          submissions: [],
        });
      }
      const entry = byCreator.get(key)!;
      const m = (s.performance_metrics || {}) as Record<string, number>;
      const views = m.views ?? 0;
      const likes = m.likes ?? 0;
      const comments = m.comments ?? 0;
      entry.total_views += views;
      entry.total_likes += likes;
      entry.total_comments += comments;
      entry.count += 1;
      entry.submissions.push({
        content_url: s.content_url ?? null,
        post_url: s.post_url ?? null,
        views,
        likes,
        comments,
        submitted_at: s.submitted_at ?? "",
      });
    }

    const totalBudget = Number(activation.total_budget) || 0;
    const prizeStructure = buildPrizeStructure(totalBudget);

    const leaderboardRows = Array.from(byCreator.values())
      .map((e) => ({
        ...e,
        cumulative_score: calculatePerformanceScore(
          e.total_views,
          e.total_likes,
          e.total_comments,
        ),
      }))
      .sort((a, b) => b.cumulative_score - a.cumulative_score)
      .map((e, idx) => {
        const rank = idx + 1;
        const prizeAmount = Number(prizeStructure[String(rank)] ?? 0);
        return {
          creator_handle: e.creator_handle,
          total_posts: e.count,
          total_views: e.total_views,
          total_likes: e.total_likes,
          total_comments: e.total_comments,
          cumulative_score: e.cumulative_score,
          current_rank: rank,
          prize_amount: prizeAmount,
          is_winner: rank <= (activation.winner_count ?? 20),
          submissions: e.submissions,
        };
      });

    const totals = {
      views: leaderboardRows.reduce((s, r) => s + r.total_views, 0),
      likes: leaderboardRows.reduce((s, r) => s + r.total_likes, 0),
      comments: leaderboardRows.reduce((s, r) => s + r.total_comments, 0),
      entries: leaderboardRows.reduce((s, r) => s + r.total_posts, 0),
    };

    const response = {
      activation: {
        id: activation.id,
        title: activation.title,
        brief: activation.brief ?? null,
        image_url: activation.image_url ?? null,
        deadline: activation.deadline,
        status: activation.status,
        type: activation.type,
        total_budget: totalBudget,
        winner_count: activation.winner_count ?? 20,
        platforms: activation.platforms ?? null,
      },
      leaderboard: leaderboardRows,
      totals,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in share_activation:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
