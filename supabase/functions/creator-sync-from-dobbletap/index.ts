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
      creator_id: dobbleTapCreatorId,
      profile_photo,
      bio,
      location,
      social_accounts = [],
    } = body;

    if (!dobbleTapCreatorId) {
      return new Response(
        JSON.stringify({ error: 'creator_id required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!Array.isArray(social_accounts) || social_accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'social_accounts array required with at least one account' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const primary = social_accounts[0];
    const platform = primary.platform || 'tiktok';
    const handle = primary.handle?.replace(/^@/, '') || 'unknown';
    const name = handle;

    let { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('dobble_tap_user_id', dobbleTapCreatorId)
      .maybeSingle();

    if (creatorError) {
      return new Response(
        JSON.stringify({ error: creatorError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date().toISOString();

    if (!creator) {
      const { data: newCreator, error: insertError } = await supabase
        .from('creators')
        .insert({
          user_id: null,
          dobble_tap_user_id: dobbleTapCreatorId,
          name,
          handle: `@${handle}`,
          platform,
          follower_count: primary.followers || 0,
          avg_engagement: 0,
          profile_photo: profile_photo || null,
          bio: bio || null,
          location: location || null,
          status: 'active',
          last_active_at: now,
        })
        .select('id')
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      creator = newCreator;
    } else {
      await supabase
        .from('creators')
        .update({
          profile_photo: profile_photo || null,
          bio: bio || null,
          location: location || null,
          status: 'active',
          last_active_at: now,
          updated_at: now,
        })
        .eq('id', creator.id);
    }

    const creatorId = creator.id;

    for (const acc of social_accounts) {
      const plat = acc.platform || 'tiktok';
      const h = acc.handle?.replace(/^@/, '') || '';
      if (!h) continue;

      await supabase
        .from('creator_social_accounts')
        .upsert(
          {
            creator_id: creatorId,
            platform: plat,
            handle: h.startsWith('@') ? h : `@${h}`,
            followers: acc.followers || 0,
            verified_at: acc.verified_at || null,
            last_synced_at: now,
          },
          { onConflict: 'creator_id,platform' }
        );
    }

    return new Response(
      JSON.stringify({ success: true, creator_id: creatorId }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('creator-sync-from-dobbletap error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
