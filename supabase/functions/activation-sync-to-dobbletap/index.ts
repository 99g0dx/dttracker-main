import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { syncToDobbleTap, getDobbleTapActivityType } from '../_shared/dobble-tap-sync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader =
      req.headers.get('Authorization') ?? req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { activationId } = body;

    if (!activationId) {
      return new Response(JSON.stringify({ error: 'activationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: activation, error: activationError } = await supabase
      .from('activations')
      .select('*')
      .eq('id', activationId)
      .single();

    if (activationError || !activation) {
      return new Response(
        JSON.stringify({ error: 'Activation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Allow sync for draft or live activations (e.g. live but never synced)
    if (activation.status !== 'draft' && activation.status !== 'live') {
      return new Response(
        JSON.stringify({
          error: 'Only draft or live activations can be synced to Dobble Tap',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const workspaceId = activation.workspace_id;

    // For community activations, fetch targeted fans with their DT user IDs
    let targetedFans: any[] = [];
    if (activation.visibility === 'community') {
      const communityFanIds = activation.community_fan_ids;
      let fansQuery = supabase
        .from('community_fans')
        .select('id, handle, platform, email, dobble_tap_user_id, creator_id')
        .eq('workspace_id', workspaceId);

      if (Array.isArray(communityFanIds) && communityFanIds.length > 0) {
        fansQuery = fansQuery.in('id', communityFanIds);
      }

      const { data: fans } = await fansQuery;

      if (fans && fans.length > 0) {
        // For fans without a direct dobble_tap_user_id, fall back to creators table
        const fansWithoutDtId = fans.filter((f: any) => !f.dobble_tap_user_id && f.creator_id);
        let creatorDtMap: Record<string, string> = {};
        if (fansWithoutDtId.length > 0) {
          const creatorIds = fansWithoutDtId.map((f: any) => f.creator_id);
          const { data: creators } = await supabase
            .from('creators')
            .select('id, dobble_tap_user_id')
            .in('id', creatorIds)
            .not('dobble_tap_user_id', 'is', null);
          if (creators) {
            creatorDtMap = Object.fromEntries(creators.map((c: any) => [c.id, c.dobble_tap_user_id]));
          }
        }

        targetedFans = fans.map((f: any) => ({
          community_fan_id: f.id,
          dobble_tap_user_id: f.dobble_tap_user_id || (f.creator_id ? (creatorDtMap[f.creator_id] || null) : null),
          handle: f.handle,
          platform: f.platform,
          email: f.email,
        }));
      }
    }

    // Same payload shape as activation-publish so Dobble Tap treats contest and sm_panel the same
    const syncPayload: Record<string, any> = {
      dttrackerCampaignId: activation.id,
      activation_id: activation.id,
      dttracker_workspace_id: workspaceId,
      type: activation.type,
      campaignType: activation.type,
      campaign_type: activation.type,
      title: activation.title,
      brief: activation.brief,
      deadline: activation.deadline,
      total_budget: activation.total_budget,
      prize_structure: activation.prize_structure,
      winner_count:
        activation.type === 'contest'
          ? activation.winner_count ?? 20
          : activation.winner_count,
      max_posts_per_creator:
        activation.type === 'contest'
          ? activation.max_posts_per_creator ?? 5
          : null,
      scoring_method:
        activation.type === 'contest' ? 'cumulative' : null,
      performance_weights:
        activation.type === 'contest'
          ? { views: 1, likes: 2, comments: 3 }
          : null,
      task_type: activation.task_type,
      activity_type: getDobbleTapActivityType(activation.task_type),
      // sm_panel_activity_type is only valid for sm_panel campaigns.
      // Sending it for contest campaigns violates DT's check constraint.
      ...(activation.type === 'sm_panel' ? { sm_panel_activity_type: getDobbleTapActivityType(activation.task_type) } : {}),
      target_url: activation.target_url,
      payment_per_action: activation.payment_per_action,
      base_rate: activation.base_rate,
      verification_type: activation.task_type === 'comment' ? 'comment_text'
        : activation.task_type === 'like' ? 'screenshot'
        : activation.task_type === 'repost' ? 'repost_url'
        : 'screenshot',
      required_comment_text: activation.required_comment_text,
      comment_guidelines: activation.comment_guidelines,
      max_participants: activation.max_participants,
      platforms: activation.platforms,
      requirements: activation.requirements,
      instructions: activation.instructions,
    };

    // Always include visibility for community activations
    if (activation.visibility === 'community') {
      syncPayload.visibility = 'community';
      if (targetedFans.length > 0) {
        syncPayload.targeted_fans = targetedFans;
      }
    }

    const activityType = getDobbleTapActivityType(activation.task_type);
    console.log('Syncing activation to Dobble Tap:', {
      activationId: activation.id,
      type: activation.type,
      task_type: activation.task_type,
      activity_type: activityType,
      syncType: activation.status === 'live' ? 'activation_update' : 'activation',
    });

    // Use 'activation_update' for live activations that may already exist on Dobble Tap
    // to avoid duplicate campaign creation errors. Use 'activation' only for drafts.
    const isLive = activation.status === 'live';
    const syncType = isLive ? 'activation_update' : 'activation';

    let syncResult = await syncToDobbleTap(
      supabase,
      syncType,
      '/webhooks/dttracker',
      syncPayload,
      activation.id,
      { queueOnFailure: false }
    );

    // Fallback: if update failed (campaign doesn't exist on DT yet), try create
    if (!syncResult.success && isLive) {
      console.log('activation_update failed, retrying as campaign_created');
      syncResult = await syncToDobbleTap(
        supabase,
        'activation',
        '/webhooks/dttracker',
        syncPayload,
        activation.id
      );
    }

    const updateData: Record<string, unknown> = {
      synced_to_dobble_tap: syncResult.synced,
      updated_at: new Date().toISOString(),
    };
    if (syncResult.dobbleTapId) {
      updateData.dobble_tap_activation_id = syncResult.dobbleTapId;
    }

    const { data: updatedActivation, error: updateError } = await supabase
      .from('activations')
      .update(updateData)
      .eq('id', activationId)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update activation' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        activation: updatedActivation,
        synced: syncResult.synced,
        error: syncResult.error ?? undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('activation-sync-to-dobbletap error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
