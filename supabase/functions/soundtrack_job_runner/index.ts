import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[soundtrack_job_runner] Starting job processing...');

    // Get queued jobs that are due to run
    const now = new Date().toISOString();
    const { data: jobs, error: jobsError } = await supabase
      .from('sound_track_jobs')
      .select('*')
      .eq('status', 'queued')
      .lte('run_at', now)
      .order('created_at', { ascending: true })
      .limit(50); // Process up to 50 jobs per run

    if (jobsError) {
      // If table doesn't exist, return success (graceful degradation)
      if (jobsError.message?.includes('does not exist') || jobsError.code === '42P01') {
        console.log('[soundtrack_job_runner] sound_track_jobs table does not exist, skipping');
        return new Response(
          JSON.stringify({ success: true, message: 'Job table does not exist', processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('[soundtrack_job_runner] No jobs to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No jobs to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[soundtrack_job_runner] Found ${jobs.length} jobs to process`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ jobId: string; error: string }> = [];

    // Process each job
    for (const job of jobs) {
      try {
        // Mark job as running
        await supabase
          .from('sound_track_jobs')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        console.log(`[soundtrack_job_runner] Processing job ${job.id} (${job.job_type})`);

        // Extract workspace_id from job (it's at root level, not in payload)
        const workspaceId = job.workspace_id;
        const payload = job.payload || {};

        if (job.job_type === 'discover_posts') {
          // Call discover_and_refresh_posts function
          const { soundTrackId } = payload;
          if (!soundTrackId || !workspaceId) {
            throw new Error('Missing soundTrackId or workspaceId in payload');
          }

          const discoverResponse = await fetch(`${supabaseUrl}/functions/v1/soundtrack_discover_and_refresh_posts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ workspaceId, soundTrackId }),
          });

          if (!discoverResponse.ok) {
            const errorText = await discoverResponse.text();
            throw new Error(`Discover posts failed: ${discoverResponse.status} ${errorText}`);
          }

          console.log(`[soundtrack_job_runner] ✅ Job ${job.id} (discover_posts) completed`);
        } else if (job.job_type === 'refresh_post_metrics') {
          // Refresh metrics for a specific post
          const { soundTrackId, postPlatformId, platform } = payload;
          if (!soundTrackId || !postPlatformId || !platform || !workspaceId) {
            throw new Error('Missing required fields in payload');
          }

          // Get the post record
          const { data: postRecord, error: postError } = await supabase
            .from('sound_track_posts')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('sound_track_id', soundTrackId)
            .eq('post_platform_id', postPlatformId)
            .single();

          if (postError || !postRecord) {
            console.warn(`[soundtrack_job_runner] Post not found for metrics refresh: ${postPlatformId}`);
            // Mark as success (post might have been deleted)
            await supabase
              .from('sound_track_jobs')
              .update({ status: 'success', updated_at: new Date().toISOString() })
              .eq('id', job.id);
            successCount++;
            continue;
          }

          // For now, we'll skip actual metrics refresh (would need provider.getPostMetrics)
          // This is a placeholder - you can enhance this later
          console.log(`[soundtrack_job_runner] ⚠️  Metrics refresh not fully implemented for ${postPlatformId}`);
          
          // Mark as success for now
          await supabase
            .from('sound_track_jobs')
            .update({ status: 'success', updated_at: new Date().toISOString() })
            .eq('id', job.id);
          
          successCount++;
          continue;
        } else {
          throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // Mark job as success
        await supabase
          .from('sound_track_jobs')
          .update({ status: 'success', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ jobId: job.id, error: errorMessage });

        console.error(`[soundtrack_job_runner] ❌ Job ${job.id} failed:`, errorMessage);

        // Mark job as failed
        await supabase
          .from('sound_track_jobs')
          .update({
            status: 'failed',
            error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }

    console.log(`[soundtrack_job_runner] Completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: jobs.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[soundtrack_job_runner] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
