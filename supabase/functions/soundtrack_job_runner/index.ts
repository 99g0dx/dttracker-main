import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createProvider } from '../_shared/sound-providers/index.ts';
import { ProviderError } from '../_shared/sound-providers/base.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_JOBS_PER_RUN = 10;

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
  const runnerId = `runner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Clean up stale locks (older than LOCK_TIMEOUT_MS)
    const staleLockCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
    await supabase
      .from('sound_track_jobs')
      .update({ locked_at: null, locked_by: null, status: 'queued' })
      .eq('status', 'running')
      .lt('locked_at', staleLockCutoff);

    // Claim queued jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('sound_track_jobs')
      .select('*')
      .eq('status', 'queued')
      .lte('run_at', new Date().toISOString())
      .order('run_at', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (jobsError) {
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No jobs to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lock jobs
    const jobIds = jobs.map(j => j.id);
    const { error: lockError } = await supabase
      .from('sound_track_jobs')
      .update({
        status: 'running',
        locked_at: new Date().toISOString(),
        locked_by: runnerId,
      })
      .in('id', jobIds)
      .eq('status', 'queued'); // Only lock if still queued (prevent race conditions)

    if (lockError) {
      throw lockError;
    }

    // Process each job
    const results = [];
    for (const job of jobs) {
      try {
        const result = await processJob(supabase, job);
        results.push({ jobId: job.id, success: true, result });
        
        // Mark as success
        await supabase
          .from('sound_track_jobs')
          .update({
            status: 'success',
            locked_at: null,
            locked_by: null,
          })
          .eq('id', job.id);
      } catch (error) {
        const attempts = job.attempts + 1;
        const shouldRetry = attempts < job.max_attempts;
        
        // Calculate exponential backoff: 2^attempts minutes
        const backoffMinutes = Math.pow(2, attempts);
        const nextRunAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        if (shouldRetry) {
          // Retry with backoff
          await supabase
            .from('sound_track_jobs')
            .update({
              status: 'queued',
              attempts,
              run_at: nextRunAt,
              last_error: error instanceof Error ? error.message : 'Unknown error',
              locked_at: null,
              locked_by: null,
            })
            .eq('id', job.id);
          
          results.push({ 
            jobId: job.id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            willRetry: true,
            nextRunAt,
          });
        } else {
          // Max attempts reached, mark as failed
          await supabase
            .from('sound_track_jobs')
            .update({
              status: 'failed',
              attempts,
              last_error: error instanceof Error ? error.message : 'Unknown error',
              locked_at: null,
              locked_by: null,
            })
            .eq('id', job.id);
          
          results.push({ 
            jobId: job.id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            willRetry: false,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: jobs.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in soundtrack_job_runner:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processJob(supabase: any, job: any) {
  const { soundTrackId, postPlatformId, platform } = job.payload;
  const workspaceId = job.workspace_id;

  switch (job.job_type) {
    case 'refresh_sound':
      return await handleRefreshSound(supabase, workspaceId, soundTrackId);

    case 'discover_posts':
      return await handleDiscoverPosts(supabase, workspaceId, soundTrackId);

    case 'refresh_post_metrics':
      return await handleRefreshPostMetrics(supabase, workspaceId, soundTrackId, postPlatformId, platform);

    default:
      throw new Error(`Unknown job type: ${job.job_type}`);
  }
}

async function handleRefreshSound(supabase: any, workspaceId: string, soundTrackId: string) {
  const { data: soundTrack } = await supabase
    .from('sound_tracks')
    .select('*')
    .eq('id', soundTrackId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!soundTrack) {
    throw new Error('Sound track not found');
  }

  const provider = createProvider(soundTrack.platform as any);
  
  let aggregates;
  try {
    aggregates = await provider.getSoundAggregates(soundTrack.sound_platform_id);
  } catch (error) {
    if (error instanceof ProviderError && error.isBlocked) {
      // Store placeholder snapshot
      await supabase.from('sound_track_snapshots').insert({
        workspace_id: workspaceId,
        sound_track_id: soundTrackId,
        total_uses: null,
        meta: { blocked: true, error: error.message },
      });
      return { totalUses: null, blocked: true };
    }
    throw error;
  }

  await supabase.from('sound_track_snapshots').insert({
    workspace_id: workspaceId,
    sound_track_id: soundTrackId,
    total_uses: aggregates.totalUses,
    meta: aggregates.meta,
  });

  // Update sound track metadata if new info available
  const updates: any = {};
  if (aggregates.meta.title && !soundTrack.title) {
    updates.title = aggregates.meta.title;
  }
  if (aggregates.meta.artist && !soundTrack.artist) {
    updates.artist = aggregates.meta.artist;
  }
  if (aggregates.meta.thumbnail_url && !soundTrack.thumbnail_url) {
    updates.thumbnail_url = aggregates.meta.thumbnail_url;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('sound_tracks')
      .update(updates)
      .eq('id', soundTrackId);
  }

  // Enqueue discover_posts job
  await supabase.from('sound_track_jobs').insert({
    workspace_id: workspaceId,
    job_type: 'discover_posts',
    status: 'queued',
    run_at: new Date().toISOString(),
    payload: { soundTrackId },
  });

  return { totalUses: aggregates.totalUses };
}

async function handleDiscoverPosts(supabase: any, workspaceId: string, soundTrackId: string) {
  const { data: soundTrack } = await supabase
    .from('sound_tracks')
    .select('*')
    .eq('id', soundTrackId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!soundTrack) {
    throw new Error('Sound track not found');
  }

  const provider = createProvider(soundTrack.platform as any);
  
  let topPosts, recentPosts;
  try {
    topPosts = await provider.listSoundPosts(soundTrack.sound_platform_id, 'top');
    recentPosts = await provider.listSoundPosts(soundTrack.sound_platform_id, 'recent');
  } catch (error) {
    if (error instanceof ProviderError && error.isBlocked) {
      // Store placeholder to indicate data is pending
      return { postsDiscovered: 0, blocked: true };
    }
    throw error;
  }

  const allPosts = [...topPosts.posts, ...recentPosts.posts];
  const uniquePosts = new Map<string, typeof allPosts[0]>();
  for (const post of allPosts) {
    const key = `${post.postPlatformId}`;
    if (!uniquePosts.has(key)) {
      uniquePosts.set(key, post);
    }
  }

  const postsToUpsert = Array.from(uniquePosts.values()).map(post => ({
    workspace_id: workspaceId,
    sound_track_id: soundTrackId,
    platform: soundTrack.platform,
    post_platform_id: post.postPlatformId,
    post_url: post.postUrl,
    creator_platform_id: post.creatorPlatformId || null,
    creator_handle: post.creatorHandle || null,
    created_at_platform: post.createdAtPlatform ? new Date(post.createdAtPlatform).toISOString() : null,
    last_seen_at: new Date().toISOString(),
  }));

  if (postsToUpsert.length > 0) {
    await supabase
      .from('sound_track_posts')
      .upsert(postsToUpsert, {
        onConflict: 'workspace_id,platform,post_platform_id',
      });

    // Update last_seen_at for existing posts
    const postIds = postsToUpsert.map(p => p.post_platform_id);
    await supabase
      .from('sound_track_posts')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('sound_track_id', soundTrackId)
      .in('post_platform_id', postIds);
  }

  // Enqueue metric refresh jobs for top 50 posts
  const top50 = Array.from(uniquePosts.values())
    .sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0))
    .slice(0, 50);

  const metricJobs = top50.map(post => ({
    workspace_id: workspaceId,
    job_type: 'refresh_post_metrics',
    status: 'queued',
    run_at: new Date().toISOString(),
    payload: { 
      soundTrackId,
      postPlatformId: post.postPlatformId,
      platform: soundTrack.platform,
    },
  }));

  if (metricJobs.length > 0) {
    await supabase.from('sound_track_jobs').insert(metricJobs);
  }

  // Store initial metrics if available
  for (const post of top50) {
    if (post.metrics) {
      const { data: postRecord } = await supabase
        .from('sound_track_posts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('post_platform_id', post.postPlatformId)
        .single();

      if (postRecord) {
        await supabase.from('sound_track_post_snapshots').insert({
          workspace_id: workspaceId,
          sound_track_post_id: postRecord.id,
          views: post.metrics.views || null,
          likes: post.metrics.likes || null,
          comments: post.metrics.comments || null,
          shares: post.metrics.shares || null,
          meta: {},
        });
      }
    }
  }

  return { postsDiscovered: uniquePosts.size };
}

async function handleRefreshPostMetrics(
  supabase: any,
  workspaceId: string,
  soundTrackId: string,
  postPlatformId: string,
  platform: string
) {
  const { data: postRecord } = await supabase
    .from('sound_track_posts')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('post_platform_id', postPlatformId)
    .single();

  if (!postRecord) {
    throw new Error('Post not found');
  }

  const provider = createProvider(platform as any);
  
  let metrics;
  try {
    metrics = await provider.getPostMetrics(postPlatformId);
  } catch (error) {
    if (error instanceof ProviderError && error.isBlocked) {
      // Store placeholder snapshot
      await supabase.from('sound_track_post_snapshots').insert({
        workspace_id: workspaceId,
        sound_track_post_id: postRecord.id,
        views: null,
        likes: null,
        comments: null,
        shares: null,
        meta: { blocked: true, error: error.message },
      });
      return { metrics: null, blocked: true };
    }
    throw error;
  }

  await supabase.from('sound_track_post_snapshots').insert({
    workspace_id: workspaceId,
    sound_track_post_id: postRecord.id,
    views: metrics.views || null,
    likes: metrics.likes || null,
    comments: metrics.comments || null,
    shares: metrics.shares || null,
    meta: metrics.meta,
  });

  return { metrics };
}
