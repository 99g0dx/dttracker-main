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
    const { eventType, timestamp, creators } = body;

    // Validate payload structure
    if (!Array.isArray(creators) || creators.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'creators array required with at least one creator',
          received: body
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = [];
    const errors = [];
    const now = new Date().toISOString();

    // Process each creator in the batch
    for (const creatorData of creators) {
      try {
        const {
          creator_id: dobbleTapCreatorId,
          handle,
          platform,
          followerCount,
          email,
          phone,
          verificationStatus,
          profilePhoto,
          profileStatus,
          bio,
          location,
        } = creatorData;

        if (!dobbleTapCreatorId) {
          errors.push({
            creator: creatorData,
            error: 'creator_id required',
          });
          continue;
        }

        if (!handle) {
          errors.push({
            creator_id: dobbleTapCreatorId,
            error: 'handle required',
          });
          continue;
        }

        // Normalize handle
        const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
        const creatorPlatform = platform || 'tiktok';
        const name = handle.replace(/^@/, '');

        // Check if creator already exists by dobble_tap_user_id
        let { data: creator, error: creatorError } = await supabase
          .from('creators')
          .select('id')
          .eq('dobble_tap_user_id', dobbleTapCreatorId)
          .maybeSingle();

        if (creatorError) {
          errors.push({
            creator_id: dobbleTapCreatorId,
            error: creatorError.message,
          });
          continue;
        }

        if (!creator) {
          // Check if creator exists by handle/platform
          const { data: existingByHandle, error: lookupError } = await supabase
            .from('creators')
            .select('id')
            .eq('platform', creatorPlatform)
            .eq('handle', normalizedHandle)
            .maybeSingle();

          if (lookupError) {
            errors.push({
              creator_id: dobbleTapCreatorId,
              error: lookupError.message,
            });
            continue;
          }

          if (existingByHandle) {
            // Update existing creator with dobble_tap_user_id
            creator = existingByHandle;
            const updateData: Record<string, any> = {
                dobble_tap_user_id: dobbleTapCreatorId,
                handle: normalizedHandle,
                name,
                profile_photo: profilePhoto || null,
                bio: bio || null,
                location: location || null,
                status: verificationStatus === 'verified' ? 'active' : 'inactive',
                last_active_at: now,
                updated_at: now,
                follower_count: followerCount || 0,
                email: email || null,
                phone: phone || null,
              };
            if (profileStatus === 'live' || profileStatus === 'draft') {
              updateData.profile_status = profileStatus;
            }
            await supabase
              .from('creators')
              .update(updateData)
              .eq('id', creator.id);
          } else {
            // Create new creator
            const insertData: Record<string, any> = {
                user_id: null,
                dobble_tap_user_id: dobbleTapCreatorId,
                name,
                handle: normalizedHandle,
                platform: creatorPlatform,
                follower_count: followerCount || 0,
                avg_engagement: 0,
                profile_photo: profilePhoto || null,
                bio: bio || null,
                location: location || null,
                email: email || null,
                phone: phone || null,
                status: verificationStatus === 'verified' ? 'active' : 'inactive',
                last_active_at: now,
              };
            if (profileStatus === 'live' || profileStatus === 'draft') {
              insertData.profile_status = profileStatus;
            }
            const { data: newCreator, error: insertError } = await supabase
              .from('creators')
              .insert(insertData)
              .select('id')
              .single();

            if (insertError) {
              errors.push({
                creator_id: dobbleTapCreatorId,
                error: insertError.message,
              });
              continue;
            }
            creator = newCreator;
          }
        } else {
          // Update existing creator (including handle/name from Dobbletap)
          const existingUpdateData: Record<string, any> = {
              handle: normalizedHandle,
              name,
              profile_photo: profilePhoto || null,
              bio: bio || null,
              location: location || null,
              email: email || null,
              phone: phone || null,
              status: verificationStatus === 'verified' ? 'active' : 'inactive',
              last_active_at: now,
              updated_at: now,
              follower_count: followerCount || 0,
            };
          if (profileStatus === 'live' || profileStatus === 'draft') {
            existingUpdateData.profile_status = profileStatus;
          }
          await supabase
            .from('creators')
            .update(existingUpdateData)
            .eq('id', creator.id);
        }

        const creatorId = creator.id;

        // Create/update social account entries (all platforms)
        const socialAccounts = creatorData.socialAccounts;
        if (Array.isArray(socialAccounts) && socialAccounts.length > 0) {
          for (const sa of socialAccounts) {
            const saHandle = sa.handle?.startsWith('@') ? sa.handle : `@${sa.handle}`;
            await supabase
              .from('creator_social_accounts')
              .upsert(
                {
                  creator_id: creatorId,
                  platform: sa.platform || creatorPlatform,
                  handle: saHandle,
                  followers: sa.followers || 0,
                  verified_at: verificationStatus === 'verified' ? now : null,
                  last_synced_at: now,
                },
                { onConflict: 'creator_id,platform' }
              );
          }
        } else {
          // Fallback: single social account from top-level fields
          await supabase
            .from('creator_social_accounts')
            .upsert(
              {
                creator_id: creatorId,
                platform: creatorPlatform,
                handle: normalizedHandle,
                followers: followerCount || 0,
                verified_at: verificationStatus === 'verified' ? now : null,
                last_synced_at: now,
              },
              { onConflict: 'creator_id,platform' }
            );
        }

        results.push({
          dobble_tap_creator_id: dobbleTapCreatorId,
          dttracker_creator_id: creatorId,
          status: 'synced',
        });

      } catch (err) {
        errors.push({
          creator: creatorData,
          error: (err as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: results.length,
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
