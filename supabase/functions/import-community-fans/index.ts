import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'];

interface FanRow {
  handle: string;
  platform: string;
  name?: string;
  followers?: number;
  email?: string;
  phone?: string;
}

function parseCSV(csvText: string): { fans: FanRow[]; errors: Array<{ row: number; message: string }> } {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { fans: [], errors: [{ row: 0, message: 'CSV file is empty' }] };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^@/, ''));
  const handleIdx = headers.findIndex(h => h === 'handle' || h === 'creator_handle');
  const platformIdx = headers.findIndex(h => h === 'platform');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'creator_name');
  const followersIdx = headers.findIndex(h => h === 'followers' || h === 'follower_count');
  const emailIdx = headers.findIndex(h => h === 'email');
  const phoneIdx = headers.findIndex(h => h === 'phone');

  if (handleIdx === -1) {
    return { fans: [], errors: [{ row: 0, message: 'Missing required column: handle' }] };
  }
  if (platformIdx === -1) {
    return { fans: [], errors: [{ row: 0, message: 'Missing required column: platform' }] };
  }

  const fans: FanRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const rowNumber = i + 1;

    const handle = row[handleIdx]?.trim().replace(/^@/, '');
    const platform = row[platformIdx]?.trim().toLowerCase();

    if (!handle) {
      errors.push({ row: rowNumber, message: 'Missing handle' });
      continue;
    }

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      errors.push({
        row: rowNumber,
        message: `Invalid platform "${platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
      });
      continue;
    }

    const name = nameIdx >= 0 ? row[nameIdx]?.trim() : undefined;
    const followersStr = followersIdx >= 0 ? row[followersIdx]?.trim() : undefined;
    const followers = followersStr ? parseInt(followersStr, 10) || undefined : undefined;
    const email = emailIdx >= 0 ? row[emailIdx]?.trim() || undefined : undefined;
    const phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() || undefined : undefined;

    fans.push({
      handle,
      platform,
      name,
      followers,
      email,
      phone,
    });
  }

  return { fans, errors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { workspaceId, csvData } = body;

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!csvData) {
      return new Response(JSON.stringify({ error: 'csvData required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse CSV
    const { fans, errors: parseErrors } = parseCSV(csvData);

    if (fans.length === 0 && parseErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success_count: 0,
          error_count: parseErrors.length,
          errors: parseErrors,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare fan records for bulk insert
    const fanRecords = fans.map(fan => ({
      workspace_id: workspaceId,
      handle: fan.handle,
      platform: fan.platform,
      name: fan.name || null,
      follower_count: fan.followers || null,
      email: fan.email || null,
      phone: fan.phone || null,
      metadata: {},
    }));

    // Bulk insert with conflict handling (ignore duplicates)
    const { data: insertedFans, error: insertError } = await supabase
      .from('community_fans')
      .upsert(fanRecords, {
        onConflict: 'workspace_id,platform,handle',
        ignoreDuplicates: false,
      })
      .select();

    const createErrors: Array<{ row: number; message: string }> = [];
    let successCount = 0;

    if (insertError) {
      // If bulk insert fails, try individual inserts to get better error messages
      for (let i = 0; i < fanRecords.length; i++) {
        const fan = fanRecords[i];
        const { error } = await supabase
          .from('community_fans')
          .insert(fan)
          .select()
          .single();

        if (error) {
          createErrors.push({
            row: i + 2,
            message: `${fan.handle} (${fan.platform}): ${error.message}`,
          });
        } else {
          successCount++;
        }
      }
    } else {
      successCount = insertedFans?.length || 0;
    }

    const allErrors = [...parseErrors, ...createErrors];

    return new Response(
      JSON.stringify({
        success_count: successCount,
        error_count: allErrors.length,
        errors: allErrors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('import-community-fans error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
