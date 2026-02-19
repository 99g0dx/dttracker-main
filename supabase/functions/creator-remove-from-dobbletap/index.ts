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
    const { creators } = body;

    if (!Array.isArray(creators) || creators.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'creators array required with at least one creator',
          received: body,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results: Array<{ dobble_tap_creator_id: string; dttracker_creator_id?: string; status: string }> = [];
    const errors: Array<{ creator_id?: string; creator?: unknown; error: string }> = [];
    const now = new Date().toISOString();

    for (const creatorData of creators) {
      const { creator_id: dobbleTapCreatorId } = creatorData;

      if (!dobbleTapCreatorId) {
        errors.push({ creator: creatorData, error: 'creator_id required' });
        continue;
      }

      try {
        const { data: creator, error: lookupError } = await supabase
          .from('creators')
          .select('id')
          .eq('dobble_tap_user_id', dobbleTapCreatorId)
          .maybeSingle();

        if (lookupError) {
          errors.push({ creator_id: dobbleTapCreatorId, error: lookupError.message });
          continue;
        }

        if (!creator) {
          // Not tracked in DTTracker — nothing to remove
          results.push({
            dobble_tap_creator_id: dobbleTapCreatorId,
            status: 'not_found',
          });
          continue;
        }

        // Hide from discover: set profile_status to 'draft' and status to 'inactive'
        const { error: updateError } = await supabase
          .from('creators')
          .update({
            profile_status: 'draft',
            status: 'inactive',
            updated_at: now,
          })
          .eq('id', creator.id);

        if (updateError) {
          errors.push({ creator_id: dobbleTapCreatorId, error: updateError.message });
          continue;
        }

        results.push({
          dobble_tap_creator_id: dobbleTapCreatorId,
          dttracker_creator_id: creator.id,
          status: 'removed',
        });
      } catch (err) {
        errors.push({
          creator_id: dobbleTapCreatorId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        removed: results.filter((r) => r.status === 'removed').length,
        not_found: results.filter((r) => r.status === 'not_found').length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('creator-remove-from-dobbletap error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
