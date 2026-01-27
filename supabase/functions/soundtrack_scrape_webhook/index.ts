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

  console.log("[soundtrack_scrape_webhook] Webhook received");

  try {
    const webhookData = await req.json();
    const { runId, status, defaultDatasetId, secret } = webhookData;

    // Verify webhook secret
    const expectedSecret = Deno.env.get("APIFY_WEBHOOK_SECRET") || "change-me-secret";
    if (secret !== expectedSecret) {
      console.error("[soundtrack_scrape_webhook] Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!runId || !status) {
      return new Response(
        JSON.stringify({ error: "runId and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase config
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "";
    const apifyToken = Deno.env.get("APIFY_API_TOKEN") ?? "";

    if (!supabaseUrl || !supabaseServiceKey || !apifyToken) {
      console.error("[soundtrack_scrape_webhook] Missing configuration");
      return new Response(
        JSON.stringify({ error: "Missing configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find job by run_id
    const { data: job, error: jobError } = await supabase
      .from("sound_scrape_jobs")
      .select("*")
      .eq("run_id", runId)
      .single();

    if (jobError || !job) {
      console.error("[soundtrack_scrape_webhook] Job not found for runId:", runId);
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[soundtrack_scrape_webhook] Processing job:", job.id, "status:", status);

    // Handle different statuses
    if (status === "SUCCEEDED") {
      // Fetch results from Apify dataset
      const datasetId = defaultDatasetId || job.dataset_id;
      if (!datasetId) {
        throw new Error("Dataset ID not found");
      }

      const apifyResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
        headers: {
          "Authorization": `Bearer ${apifyToken}`,
        },
      });

      if (!apifyResponse.ok) {
        throw new Error(`Failed to fetch Apify results: ${apifyResponse.status}`);
      }

      const videos = await apifyResponse.json();
      console.log("[soundtrack_scrape_webhook] Fetched", videos.length, "videos from Apify");

      // Extract sound metadata from first video (if available)
      let soundTitle: string | null = null;
      let soundArtist: string | null = null;
      
      if (videos.length > 0) {
        const firstVideo = videos[0];
        // Apify might return sound metadata in different places
        const musicMeta = firstVideo.musicMeta || firstVideo.music || firstVideo.sound || {};
        soundTitle = musicMeta.title || musicMeta.musicName || musicMeta.name || null;
        soundArtist = musicMeta.authorName || musicMeta.artist || musicMeta.author || null;
        
        console.log("[soundtrack_scrape_webhook] Extracted sound metadata:", {
          title: soundTitle,
          artist: soundArtist,
        });
      }

      // Update sound_tracks table with metadata if available
      if (soundTitle || soundArtist) {
        const { error: updateError } = await supabase
          .from("sound_tracks")
          .update({
            ...(soundTitle && { title: soundTitle }),
            ...(soundArtist && { artist: soundArtist }),
          })
          .eq("id", job.sound_track_id);

        if (updateError) {
          console.warn("[soundtrack_scrape_webhook] Failed to update sound_tracks metadata:", updateError);
        } else {
          console.log("[soundtrack_scrape_webhook] Updated sound_tracks with metadata");
        }

        // Also update sounds table if it exists
        const { error: soundsUpdateError } = await supabase
          .from("sounds")
          .update({
            ...(soundTitle && { title: soundTitle }),
            ...(soundArtist && { artist: soundArtist }),
          })
          .eq("id", job.sound_track_id);

        if (soundsUpdateError && !soundsUpdateError.message?.includes('does not exist')) {
          console.warn("[soundtrack_scrape_webhook] Failed to update sounds metadata:", soundsUpdateError);
        }
      }

      // Process and insert videos
      const videosToInsert = videos.map((video: any) => {
        const author = video.authorMeta || video.author || {};
        const stats = {
          playCount: video.playCount || video.stats?.playCount || 0,
          diggCount: video.diggCount || video.stats?.diggCount || 0,
          commentCount: video.commentCount || video.stats?.commentCount || 0,
          shareCount: video.shareCount || video.stats?.shareCount || 0,
        };
        const videoId = video.id || video.video_id;
        const uniqueId = author.name || author.uniqueId || author.unique_id;

        return {
          sound_track_id: job.sound_track_id,
          workspace_id: job.workspace_id,
          video_id: videoId,
          video_url: video.webVideoUrl || `https://www.tiktok.com/@${uniqueId}/video/${videoId}`,
          platform: "tiktok",
          creator_handle: uniqueId,
          creator_platform_id: author.id || author.userId,
          creator_name: author.nickname || author.name,
          views: stats.playCount,
          likes: stats.diggCount,
          comments: stats.commentCount,
          shares: stats.shareCount,
          engagement_rate: stats.playCount > 0
            ? ((stats.diggCount + stats.commentCount + stats.shareCount) / stats.playCount) * 100
            : 0,
          posted_at: video.createTime ? new Date(video.createTime * 1000).toISOString() : null,
          scrape_job_id: job.id,
          raw_data: video,
        };
      });

      // Bulk upsert videos
      if (videosToInsert.length > 0) {
        const { error: videosError } = await supabase
          .from("sound_track_videos")
          .upsert(videosToInsert, {
            onConflict: "sound_track_id,video_id,platform",
          });

        if (videosError) {
          console.error("[soundtrack_scrape_webhook] Error inserting videos:", videosError);
        } else {
          console.log("[soundtrack_scrape_webhook] Inserted", videosToInsert.length, "videos");
        }
      }

      // Calculate and upsert stats
      const totalVideos = videosToInsert.length;
      const totalViews = videosToInsert.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const totalLikes = videosToInsert.reduce((sum: number, v: any) => sum + (v.likes || 0), 0);
      const totalComments = videosToInsert.reduce((sum: number, v: any) => sum + (v.comments || 0), 0);
      const totalShares = videosToInsert.reduce((sum: number, v: any) => sum + (v.shares || 0), 0);
      const topVideo = videosToInsert.sort((a: any, b: any) => (b.views || 0) - (a.views || 0))[0];

      await supabase
        .from("sound_track_stats")
        .upsert(
          {
            sound_track_id: job.sound_track_id,
            workspace_id: job.workspace_id,
            total_uses: totalVideos,
            total_videos: totalVideos,
            avg_views: totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0,
            avg_likes: totalVideos > 0 ? Math.round(totalLikes / totalVideos) : 0,
            avg_comments: totalVideos > 0 ? Math.round(totalComments / totalVideos) : 0,
            avg_shares: totalVideos > 0 ? Math.round(totalShares / totalVideos) : 0,
            top_video_views: topVideo?.views || 0,
            top_video_likes: topVideo?.likes || 0,
            scrape_job_id: job.id,
          },
          {
            onConflict: "sound_track_id",
          }
        );

      // Update job status
      await supabase
        .from("sound_scrape_jobs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      console.log("[soundtrack_scrape_webhook] Job completed successfully");

    } else if (status === "FAILED" || status === "ABORTED") {
      // Update job status to failed
      await supabase
        .from("sound_scrape_jobs")
        .update({
          status: "failed",
          error: `Apify run ${status.toLowerCase()}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      console.log("[soundtrack_scrape_webhook] Job failed:", status);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[soundtrack_scrape_webhook] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
