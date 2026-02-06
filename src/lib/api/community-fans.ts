import Papa from 'papaparse';
import { supabase } from '../supabase';
import type { ApiResponse, ApiListResponse } from '../types/database';
import { normalizeColumnName, getRowValue, downloadCSV } from '../utils/csv';

export interface CommunityFan {
  id: string;
  workspace_id: string;
  creator_id: string | null;
  handle: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook';
  name: string | null;
  follower_count: number | null;
  email: string | null;
  phone: string | null;
  imported_at: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FanStats {
  total_fans: number;
  by_platform: Record<string, number>;
  total_followers: number;
}

export interface ImportResult {
  success_count: number;
  error_count: number;
  errors: Array<{ row: number; message: string }>;
}

interface ParseResult {
  fans: Array<{
    handle: string;
    platform: string;
    name?: string;
    followers?: number;
    email?: string;
    phone?: string;
  }>;
  errors: Array<{ row: number; message: string }>;
}

function parseFanCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const fans: ParseResult['fans'] = [];
    const errors: ParseResult['errors'] = [];
    const validPlatforms = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeColumnName(header),
      complete: (results) => {
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const rowNumber = i + 2;

          const handle = getRowValue(row, 'handle')?.toString().trim().replace(/^@/, '');
          const platform = getRowValue(row, 'platform')?.toString().trim().toLowerCase();

          if (!handle) {
            errors.push({ row: rowNumber, message: 'Missing handle' });
            continue;
          }

          if (!platform || !validPlatforms.includes(platform)) {
            errors.push({
              row: rowNumber,
              message: `Invalid platform "${platform}". Must be one of: ${validPlatforms.join(', ')}`,
            });
            continue;
          }

          const name = getRowValue(row, 'name')?.toString().trim();
          const followersStr = getRowValue(row, 'followers')?.toString().trim();
          const followers = followersStr ? parseInt(followersStr, 10) || undefined : undefined;
          const email = getRowValue(row, 'email')?.toString().trim() || undefined;
          const phone = getRowValue(row, 'phone')?.toString().trim() || undefined;

          fans.push({
            handle,
            platform,
            name,
            followers,
            email,
            phone,
          });
        }

        resolve({ fans, errors });
      },
      error: (error) => {
        resolve({
          fans: [],
          errors: [{ row: 0, message: `CSV parsing error: ${error.message}` }],
        });
      },
    });
  });
}

export async function importFans(file: File, workspaceId: string): Promise<ApiResponse<{ parseResult: ParseResult; createResult: ImportResult }>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Parse CSV
    const parseResult = await parseFanCSV(file);

    if (parseResult.fans.length === 0) {
      return {
        data: {
          parseResult,
          createResult: {
            success_count: 0,
            error_count: parseResult.errors.length,
            errors: parseResult.errors,
          },
        },
        error: null,
      };
    }

    // Convert to CSV string for edge function
    const csvRows = parseResult.fans.map((fan) => [
      fan.handle,
      fan.platform,
      fan.name || '',
      fan.followers?.toString() || '',
      fan.email || '',
      fan.phone || '',
    ]);
    const csvWithHeaders = Papa.unparse({
      fields: ['handle', 'platform', 'name', 'followers', 'email', 'phone'],
      data: csvRows,
    });

    // Call edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/import-community-fans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId,
        csvData: csvWithHeaders,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { data: null, error: new Error(result.error || 'Import failed') };
    }

    return {
      data: {
        parseResult,
        createResult: {
          success_count: result.success_count || 0,
          error_count: result.error_count || 0,
          errors: result.errors || [],
        },
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function listFans(
  workspaceId: string,
  filters?: {
    platform?: string;
    search?: string;
  }
): Promise<ApiListResponse<CommunityFan>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    let query = supabase
      .from('community_fans')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('imported_at', { ascending: false });

    if (filters?.platform) {
      query = query.eq('platform', filters.platform);
    }

    if (filters?.search) {
      query = query.or(`handle.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) return { data: null, error };
    return { data: data || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function deleteFan(fanId: string): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { error } = await supabase.from('community_fans').delete().eq('id', fanId);

    if (error) return { data: null, error };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getFanStats(workspaceId: string): Promise<ApiResponse<FanStats>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data: fans, error } = await supabase
      .from('community_fans')
      .select('platform, follower_count')
      .eq('workspace_id', workspaceId);

    if (error) return { data: null, error };

    const stats: FanStats = {
      total_fans: fans?.length || 0,
      by_platform: {},
      total_followers: 0,
    };

    fans?.forEach((fan) => {
      stats.by_platform[fan.platform] = (stats.by_platform[fan.platform] || 0) + 1;
      if (fan.follower_count) {
        stats.total_followers += fan.follower_count;
      }
    });

    return { data: stats, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export interface MatchResult {
  matched_count: number;
  unmatched_count: number;
}

/**
 * Match community fans to creators by handle + platform
 */
export async function matchFansToCreators(workspaceId: string): Promise<ApiResponse<MatchResult>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase.rpc('match_community_fans_to_creators', {
      p_workspace_id: workspaceId,
    });

    if (error) return { data: null, error };

    const result = Array.isArray(data) && data.length > 0 ? data[0] : { matched_count: 0, unmatched_count: 0 };
    return { data: result as MatchResult, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get matching fan IDs for a creator
 */
export async function getCreatorFanMatch(
  creatorId: string,
  workspaceId: string
): Promise<ApiResponse<string[]>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('community_fans')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('creator_id', creatorId);

    if (error) return { data: null, error };

    const fanIds = (data || []).map((fan) => fan.id);
    return { data: fanIds, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
