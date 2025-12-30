import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let token: string | null = null;
  try {
    // Get token from query string
    const url = new URL(req.url);
    token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get password from request body if POST, or query params if GET
    let password: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        password = body.password || null;
      } catch {
        // No body or invalid JSON
      }
    }

    // Initialize Supabase client with service role key (server-side only)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables:", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Look up campaign by share_token where share_enabled = true
    // First attempt: Try with password columns (if migration has been run)
    let campaign: any = null;
    let campaignError: any = null;
    let hasPasswordColumns = false;

    const { data: campaignWithPassword, error: errorWithPassword } =
      await supabase
        .from("campaigns")
        .select(
          "id, name, brand_name, cover_image_url, status, share_expires_at, share_allow_export, share_password_hash, share_password_protected, created_at"
        )
        .eq("share_token", token)
        .eq("share_enabled", true)
        .single();

    if (campaignWithPassword && !errorWithPassword) {
      // Success - password columns exist
      campaign = campaignWithPassword;
      hasPasswordColumns = true;
      console.log("Campaign query succeeded with password columns");
    } else {
      // Check if error is due to missing columns
      const errorMessage = errorWithPassword?.message?.toLowerCase() || "";
      const isColumnError =
        errorMessage.includes("column") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("undefined column");

      if (isColumnError) {
        // Columns don't exist - retry without password columns (backward compatibility)
        console.log(
          "Password columns not found, retrying without them (backward compatibility mode)"
        );
        const { data: campaignWithoutPassword, error: errorWithoutPassword } =
          await supabase
            .from("campaigns")
            .select(
              "id, name, brand_name, cover_image_url, status, share_expires_at, share_allow_export, created_at"
            )
            .eq("share_token", token)
            .eq("share_enabled", true)
            .single();

        if (campaignWithoutPassword && !errorWithoutPassword) {
          campaign = campaignWithoutPassword;
          hasPasswordColumns = false;
          console.log("Campaign query succeeded without password columns");
        } else {
          campaignError = errorWithoutPassword;
        }
      } else {
        // Other error (not a column error)
        campaignError = errorWithPassword;
      }
    }

    if (campaignError || !campaign) {
      console.error("Campaign query failed:", {
        error: campaignError?.message || "Campaign not found",
        code: campaignError?.code,
        hint: campaignError?.hint,
      });
      // Return 404 to avoid leaking information
      return new Response(
        JSON.stringify({ error: "Link not found or expired" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check expiry if set
    if (campaign.share_expires_at) {
      const expiresAt = new Date(campaign.share_expires_at);
      const now = new Date();
      if (now > expiresAt) {
        console.log("Share link expired:", { expiresAt, now });
        return new Response(JSON.stringify({ error: "Link expired" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check password protection (only if password columns exist)
    if (hasPasswordColumns && campaign.share_password_protected) {
      console.log("Password protection is enabled for this campaign");
      if (!password) {
        return new Response(JSON.stringify({ error: "Password required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hash the provided password and compare with stored hash
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (hashHex !== campaign.share_password_hash) {
        console.log("Password verification failed");
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("Password verified successfully");
    } else if (hasPasswordColumns && !campaign.share_password_protected) {
      console.log("Password protection is disabled for this campaign");
    } else {
      console.log(
        "Password columns not available - treating as no password protection (backward compatibility)"
      );
    }

    // Fetch posts with creator info
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(
        `
        id,
        platform,
        post_url,
        status,
        views,
        likes,
        comments,
        shares,
        engagement_rate,
        posted_date,
        created_at,
        creator:creators(
          id,
          name,
          handle
        )
      `
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("Error fetching posts:", {
        error: postsError.message,
        code: postsError.code,
        hint: postsError.hint,
        details: postsError.details,
      });
      return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate totals (only from KPI platforms: TikTok and Instagram)
    const kpiPosts = (posts || []).filter((p) =>
      ["tiktok", "instagram"].includes(p.platform)
    );

    const totals = {
      views: kpiPosts.reduce((sum, p) => sum + (p.views || 0), 0),
      likes: kpiPosts.reduce((sum, p) => sum + (p.likes || 0), 0),
      comments: kpiPosts.reduce((sum, p) => sum + (p.comments || 0), 0),
      shares: kpiPosts.reduce((sum, p) => sum + (p.shares || 0), 0),
    };

    // Fetch time series data from post_metrics
    const { data: metricsHistory, error: metricsError } = await supabase
      .from("post_metrics")
      .select(
        `
        views,
        likes,
        comments,
        shares,
        scraped_at,
        posts!inner(campaign_id, platform)
      `
      )
      .eq("posts.campaign_id", campaign.id)
      .in("posts.platform", ["tiktok", "instagram"])
      .order("scraped_at", { ascending: true });

    // Build time series data
    const seriesData: Record<string, Array<{ date: string; value: number }>> = {
      views: [],
      likes: [],
      comments: [],
      shares: [],
    };

    if (!metricsError && metricsHistory && metricsHistory.length > 0) {
      const metricsByDate = new Map<
        string,
        {
          views: number;
          likes: number;
          comments: number;
          shares: number;
        }
      >();

      metricsHistory.forEach((metric: any) => {
        const dateStr = metric.scraped_at
          ? metric.scraped_at.split("T")[0]
          : null;
        if (!dateStr) return;

        if (!metricsByDate.has(dateStr)) {
          metricsByDate.set(dateStr, {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
          });
        }

        const point = metricsByDate.get(dateStr)!;
        point.views += Number(metric.views || 0);
        point.likes += Number(metric.likes || 0);
        point.comments += Number(metric.comments || 0);
        point.shares += Number(metric.shares || 0);
      });

      // Convert to array format
      Array.from(metricsByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, values]) => {
          seriesData.views.push({ date, value: values.views });
          seriesData.likes.push({ date, value: values.likes });
          seriesData.comments.push({ date, value: values.comments });
          seriesData.shares.push({ date, value: values.shares });
        });
    } else {
      // Fallback: use current post data grouped by date
      const postsByDate = new Map<string, typeof kpiPosts>();
      kpiPosts.forEach((post: any) => {
        const dateStr = post.posted_date
          ? post.posted_date.split("T")[0]
          : post.created_at
          ? post.created_at.split("T")[0]
          : new Date().toISOString().split("T")[0];

        if (!postsByDate.has(dateStr)) {
          postsByDate.set(dateStr, []);
        }
        postsByDate.get(dateStr)!.push(post);
      });

      Array.from(postsByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, datePosts]) => {
          seriesData.views.push({
            date,
            value: datePosts.reduce((sum, p) => sum + (p.views || 0), 0),
          });
          seriesData.likes.push({
            date,
            value: datePosts.reduce((sum, p) => sum + (p.likes || 0), 0),
          });
          seriesData.comments.push({
            date,
            value: datePosts.reduce((sum, p) => sum + (p.comments || 0), 0),
          });
          seriesData.shares.push({
            date,
            value: datePosts.reduce((sum, p) => sum + (p.shares || 0), 0),
          });
        });
    }

    // Sanitize response - only return safe, public fields
    const response = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        brand_name: campaign.brand_name || null,
        status: campaign.status,
        coverImageUrl: campaign.cover_image_url || null,
        createdAt: campaign.created_at,
      },
      totals,
      series: seriesData,
      posts: (posts || []).map((post: any) => ({
        id: post.id,
        platform: post.platform,
        postUrl: post.post_url,
        status: post.status,
        views: post.views || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        engagementRate: post.engagement_rate || 0,
        postedDate: post.posted_date || null,
        createdAt: post.created_at,
        creator: post.creator
          ? {
              id: post.creator.id,
              name: post.creator.name,
              handle: post.creator.handle,
            }
          : null,
      })),
      share: {
        allowExport: campaign.share_allow_export || false,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in share-campaign function:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      token: token ? `${token.substring(0, 8)}...` : "missing",
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
