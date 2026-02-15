/**
 * Resolve a creator's DTTracker identity from a Dobbletap user ID or other identifiers.
 * Tries multiple lookup strategies to find the creator in the creators table.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export interface ResolvedCreator {
  creator_id: string;
  creator_handle: string | null;
  creator_platform: string | null;
}

/**
 * Try to resolve a creator from the creators table using available identifiers.
 *
 * Lookup order:
 * 1. By creators.id (if the ID is a DTTracker creator UUID)
 * 2. By creators.dobble_tap_user_id (if the ID is a Dobbletap user ID)
 *
 * Returns the DTTracker creator identity or null if not found.
 */
/** Strip leading @ from a handle so callers can add their own prefix */
function stripAt(handle: string | null | undefined): string | null {
  if (!handle) return null;
  return handle.replace(/^@+/, "") || null;
}

export async function resolveCreator(
  supabase: ReturnType<typeof createClient>,
  candidateId: string | null,
  fallbackHandle?: string | null,
  fallbackPlatform?: string | null,
): Promise<ResolvedCreator | null> {
  if (!candidateId) return null;

  // 1. Try by creators.id (DTTracker native UUID)
  const { data: byId } = await supabase
    .from("creators")
    .select("id, handle, name, platform")
    .eq("id", candidateId)
    .maybeSingle();

  if (byId) {
    return {
      creator_id: byId.id,
      creator_handle:
        stripAt(byId.handle) ||
        stripAt(byId.name) ||
        stripAt(fallbackHandle) ||
        null,
      creator_platform: byId.platform || fallbackPlatform || null,
    };
  }

  // 2. Try by dobble_tap_user_id (Dobbletap user/creator ID)
  const { data: byDtId } = await supabase
    .from("creators")
    .select("id, handle, name, platform")
    .eq("dobble_tap_user_id", candidateId)
    .maybeSingle();

  if (byDtId) {
    return {
      creator_id: byDtId.id,
      creator_handle:
        stripAt(byDtId.handle) ||
        stripAt(byDtId.name) ||
        stripAt(fallbackHandle) ||
        null,
      creator_platform: byDtId.platform || fallbackPlatform || null,
    };
  }

  // Not found in creators table
  return null;
}
