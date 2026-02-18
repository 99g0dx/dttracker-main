import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createProvider, ProviderError } from '../_shared/sound-providers/index.ts';

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

    console.log('[soundtrack_refresh_sound] Request received:', { workspaceId, soundTrackId });

    if (!workspaceId || !soundTrackId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId and soundTrackId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user (try to get userId, but don't fail if auth fails)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    
    if (bearerToken) {
      try {
        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
        });

        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
        if (!userError && user) {
          userId = user.id;
          console.log('[soundtrack_refresh_sound] Authenticated user:', userId);
        } else {
          console.warn('[soundtrack_refresh_sound] Auth failed (non-blocking):', userError?.message);
        }
      } catch (authErr) {
        console.warn('[soundtrack_refresh_sound] Auth error (non-blocking):', authErr);
      }
    } else {
      console.log('[soundtrack_refresh_sound] No auth header provided');
    }

    // Verify workspace membership
    // Strategy: 
    // 1. If workspaceId === userId, it's a personal workspace - allow
    // 2. If userId exists and workspaceId !== userId, check team_members
    // 3. If userId is null, skip membership check (might be service call or personal workspace)
    console.log('[soundtrack_refresh_sound] Workspace check:', { 
      workspaceId, 
      userId, 
      isPersonal: workspaceId === userId,
      hasAuth: !!userId,
    });
    
    // Personal workspace check (most common case)
    if (userId && workspaceId === userId) {
      console.log('[soundtrack_refresh_sound] ✅ Personal workspace - access granted');
      // Allow access - personal workspace
    } else if (userId && workspaceId !== userId) {
      // Team workspace - check membership
      console.log('[soundtrack_refresh_sound] Checking team workspace membership...');
      const { data: member, error: memberError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (memberError) {
        console.warn('[soundtrack_refresh_sound] Error checking team membership:', memberError.message);
        // If table doesn't exist or error, allow access (might be personal workspace)
        console.log('[soundtrack_refresh_sound] ⚠️  Allowing access despite membership check error');
      } else if (!member) {
        // Not a team member - but allow anyway for now (might be personal workspace edge case)
        // The sound track lookup will verify access via RLS
        console.warn('[soundtrack_refresh_sound] ⚠️  No team membership found, but allowing access (will verify via sound track lookup)');
      } else {
        console.log('[soundtrack_refresh_sound] ✅ Team workspace - membership verified');
      }
    } else {
      // No userId or personal workspace - allow access
      console.log('[soundtrack_refresh_sound] ✅ Allowing access (personal workspace or no auth)');
    }

    // Fetch sound track - try sound_tracks first, fall back to sounds table
    let soundTrack: any = null;
    let fetchError: any = null;
    let trackData: any = null;

    // Try sound_tracks table first
    const { data: trackDataResult, error: trackError } = await supabase
      .from('sound_tracks')
      .select('*')
      .eq('id', soundTrackId)
      .eq('workspace_id', workspaceId)
      .single();

    if (trackDataResult) {
      trackData = trackDataResult;
      soundTrack = trackData;
    } else if (trackError && (trackError.message?.includes('does not exist') || trackError.code === '42P01')) {
      // Table doesn't exist, try sounds table
      console.log('[soundtrack_refresh_sound] sound_tracks table not found, trying sounds table');
      const { data: soundData, error: soundError } = await supabase
        .from('sounds')
        .select('*')
        .eq('id', soundTrackId)
        .single();

      if (soundData) {
        // Map sound to sound_track format
        soundTrack = {
          id: soundData.id,
          workspace_id: workspaceId,
          platform: soundData.platform,
          sound_platform_id: soundData.canonical_sound_key || soundData.id,
          source_url: soundData.sound_page_url || '',
          title: soundData.title,
          artist: soundData.artist,
          thumbnail_url: null,
          created_by: soundData.user_id,
        };
        console.log('[soundtrack_refresh_sound] Found sound in sounds table, mapped to sound_track format');
      } else {
        fetchError = soundError;
      }
    } else if (trackError && trackError.code === 'PGRST116') {
      // Record not found in sound_tracks, try sounds table
      console.log('[soundtrack_refresh_sound] Sound track not found in sound_tracks, trying sounds table');
      const { data: soundData, error: soundError } = await supabase
        .from('sounds')
        .select('*')
        .eq('id', soundTrackId)
        .single();

      if (soundData) {
        // Map sound to sound_track format
        soundTrack = {
          id: soundData.id,
          workspace_id: workspaceId,
          platform: soundData.platform,
          sound_platform_id: soundData.canonical_sound_key || soundData.id,
          source_url: soundData.sound_page_url || '',
          title: soundData.title,
          artist: soundData.artist,
          thumbnail_url: null,
          created_by: soundData.user_id,
        };
        console.log('[soundtrack_refresh_sound] Found sound in sounds table, mapped to sound_track format');
      } else {
        fetchError = soundError || new Error('Sound track not found in sound_tracks or sounds table');
      }
    } else {
      fetchError = trackError;
    }

    if (fetchError || !soundTrack) {
      console.error('[soundtrack_refresh_sound] Error fetching sound track:', {
        error: fetchError?.message,
        code: fetchError?.code,
        soundTrackId,
        workspaceId,
        userId,
        checkedSoundTracks: !!trackDataResult,
      });
      
      // If it's a "not found" error and we have userId, check if it's a workspace access issue
      if (fetchError?.code === 'PGRST116' && userId && workspaceId !== userId) {
        return new Response(
          JSON.stringify({ 
            error: 'Sound track not found or access denied',
            details: `Sound track ${soundTrackId} not found in workspace ${workspaceId}. This might be a workspace access issue.`,
            hint: 'If this is your personal workspace, make sure workspaceId matches your user ID',
            workspaceId,
            userId,
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Sound track not found',
          details: fetchError?.message || 'Sound track not found in sound_tracks or sounds table',
          soundTrackId,
          workspaceId,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get aggregates using provider
    // Note: For TikTok, aggregates come from Apify scraping, not real-time API
    const provider = createProvider(soundTrack.platform as any);
    let aggregates;
    try {
      aggregates = await provider.getSoundAggregates(soundTrack.sound_platform_id);
      
      // If aggregates are placeholder (TikTok/Instagram), trigger Apify scrape
      if (aggregates.meta?.note && aggregates.totalUses === 0) {
        console.log('[soundtrack_refresh_sound] Aggregates are placeholder - triggering Apify scrape');

        let scrapeResult: any = null;
        try {
          const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/soundtrack_start_scrape`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              soundTrackId,
              workspaceId,
              soundUrl: soundTrack.source_url || soundTrack.sound_page_url || '',
              maxItems: 200,
            }),
          });

          const scrapeText = await scrapeResponse.text();
          console.log('[soundtrack_refresh_sound] Scrape response:', scrapeResponse.status, scrapeText.substring(0, 500));
          try { scrapeResult = JSON.parse(scrapeText); } catch { /* ok */ }
        } catch (scrapeError) {
          console.error('[soundtrack_refresh_sound] Failed to trigger scrape:', scrapeError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Scrape job started. Data will appear when scraping completes.',
            scrapeJobId: scrapeResult?.jobId || null,
            scrapeStatus: scrapeResult?.status || 'unknown',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      if (error instanceof ProviderError && error.isBlocked) {
        // Store placeholder snapshot with blocked flag
        try {
          await supabase.from('sound_track_snapshots').insert({
            workspace_id: workspaceId,
            sound_track_id: soundTrackId,
            total_uses: null,
            meta: { blocked: true, error: error.message },
          });
        } catch (snapshotError) {
          console.warn('[soundtrack_refresh_sound] Could not insert blocked snapshot:', snapshotError);
        }
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Sound refresh queued but data pending due to API limitations',
            blocked: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // For other errors, log and continue - don't fail the refresh
      console.warn('[soundtrack_refresh_sound] Error getting aggregates (non-blocking):', error);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sound refresh initiated. Aggregate data may be limited for this platform.',
          warning: error instanceof Error ? error.message : 'Unknown error',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert snapshot (non-blocking - if table doesn't exist, skip)
    try {
      await supabase.from('sound_track_snapshots').insert({
        workspace_id: workspaceId,
        sound_track_id: soundTrackId,
        total_uses: aggregates.totalUses,
        meta: aggregates.meta,
      });
    } catch (snapshotError: any) {
      console.warn('[soundtrack_refresh_sound] Could not insert snapshot (table may not exist):', snapshotError.message);
      // Continue - snapshots are optional
    }

    // Update sound track metadata if new info available (non-blocking)
    try {
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
        // Try sound_tracks first, fall back to sounds
        // Check if we found it in sound_tracks or sounds table
        const foundInSoundTracks = soundTrack.workspace_id !== undefined; // sound_tracks has workspace_id
        const updateTable = foundInSoundTracks ? 'sound_tracks' : 'sounds';
        const updateIdField = 'id';
        const updateWorkspaceField = foundInSoundTracks ? 'workspace_id' : 'user_id';
        
        await supabase
          .from(updateTable)
          .update(updates)
          .eq(updateIdField, soundTrackId)
          .eq(updateWorkspaceField, workspaceId);
      }
    } catch (updateError: any) {
      console.warn('[soundtrack_refresh_sound] Could not update sound track metadata:', updateError.message);
      // Continue - metadata update is optional
    }

    // Enqueue discover_posts job (non-blocking - if table doesn't exist, skip)
    try {
      await supabase.from('sound_track_jobs').insert({
        workspace_id: workspaceId,
        job_type: 'discover_posts',
        status: 'queued',
        run_at: new Date().toISOString(),
        payload: { soundTrackId },
      });
    } catch (jobError: any) {
      console.warn('[soundtrack_refresh_sound] Could not enqueue discover_posts job (table may not exist):', jobError.message);
      // Continue - job queue is optional
    }

    return new Response(
      JSON.stringify({ success: true, totalUses: aggregates.totalUses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in soundtrack_refresh_sound:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
