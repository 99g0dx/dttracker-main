import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createProvider } from '../_shared/sound-providers/index.ts';
import { ProviderError } from '../_shared/sound-providers/base.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SB_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let userId: string | null = null;

  try {
    const { workspaceId, soundTrackId } = await req.json();

    if (!workspaceId || !soundTrackId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId and soundTrackId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    userId = user.id;

    // Verify workspace membership
    const { data: member } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!member && workspaceId !== userId) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch sound track
    const { data: soundTrack, error: fetchError } = await supabase
      .from('sound_tracks')
      .select('*')
      .eq('id', soundTrackId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !soundTrack) {
      return new Response(
        JSON.stringify({ error: 'Sound track not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Discover posts using provider
    const provider = createProvider(soundTrack.platform as any);
    let topPosts, recentPosts;
    
    try {
      topPosts = await provider.listSoundPosts(soundTrack.sound_platform_id, 'top');
      recentPosts = await provider.listSoundPosts(soundTrack.sound_platform_id, 'recent');
    } catch (error) {
      if (error instanceof ProviderError && error.isBlocked) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Post discovery queued but data pending due to API limitations',
            blocked: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Combine and deduplicate posts
    const allPosts = [...topPosts.posts, ...recentPosts.posts];
    const uniquePosts = new Map<string, typeof allPosts[0]>();
    for (const post of allPosts) {
      const key = `${post.postPlatformId}`;
      if (!uniquePosts.has(key)) {
        uniquePosts.set(key, post);
      }
    }

    // Upsert posts
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

    // Enqueue refresh_post_metrics jobs for top 50 posts
    const top50Posts = Array.from(uniquePosts.values())
      .sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0))
      .slice(0, 50);

    const metricJobs = top50Posts.map(post => ({
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

    // Fetch and store metrics for posts that have them
    for (const post of top50Posts) {
      if (post.metrics) {
        // Get the post record ID
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        postsDiscovered: uniquePosts.size,
        metricsQueued: metricJobs.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in soundtrack_discover_and_refresh_posts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
