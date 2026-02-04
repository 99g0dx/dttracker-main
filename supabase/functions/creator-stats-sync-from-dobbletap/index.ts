import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    const syncApiKey = Deno.env.get('SYNC_API_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!syncApiKey || authHeader !== `Bearer ${syncApiKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const body = await req.json();
    const {
      creator_id,
      activation_id,
      views = 0,
      likes = 0,
      comments = 0,
      shares = 0,
      engagement_rate = 0,
    } = body;

    if (!creator_id) {
      return new Response(
        JSON.stringify({ error: 'creator_id required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existing } = await supabase
      .from('creator_stats')
      .select('*')
      .eq('creator_id', creator_id)
      .maybeSingle();

    const totalViews = Number(views) || 0;
    const totalEngagements = Number(likes) || 0 + Number(comments) || 0 + Number(shares) || 0;
    const engRate = Number(engagement_rate) || 0;

    const prevReach = existing?.total_reach ? Number(existing.total_reach) : 0;
    const prevCompleted = existing?.campaigns_completed ? Number(existing.campaigns_completed) : 0;
    const prevAvgEng = existing?.avg_engagement_rate ? Number(existing.avg_engagement_rate) : 0;
    const prevAvgViews = existing?.avg_views_per_post;
    const prevTotalReach = prevReach + totalViews;

    const newCampaignsCompleted = prevCompleted + 1;
    const newAvgEngagement =
      prevCompleted === 0
        ? engRate
        : (prevAvgEng * prevCompleted + engRate) / newCampaignsCompleted;
    const newAvgViewsPerPost =
      prevAvgViews != null
        ? Math.round((prevAvgViews * prevCompleted + totalViews) / newCampaignsCompleted)
        : totalViews > 0 ? totalViews : null;

    const { error } = await supabase
      .from('creator_stats')
      .upsert(
        {
          creator_id,
          avg_engagement_rate: Math.round(newAvgEngagement * 100) / 100,
          campaigns_completed: newCampaignsCompleted,
          total_reach: prevTotalReach,
          avg_views_per_post: newAvgViewsPerPost,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'creator_id' }
      );

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('creator-stats-sync-from-dobbletap error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
