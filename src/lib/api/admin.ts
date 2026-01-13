import { supabase } from '../supabase';
import type { Creator, AgencyInventory, ApiResponse } from '../types/database';

/**
 * Admin API for managing the agency marketplace (agency_inventory)
 * These functions allow admins to harvest creators from user networks
 * and add them to the All Creators marketplace.
 */

/**
 * Get all creators that can be harvested into the marketplace
 * Returns creators that:
 * - Were created by a workspace (created_by_workspace_id IS NOT NULL)
 * - Are not yet in agency_inventory
 */
export async function getCreatorsForHarvesting(): Promise<ApiResponse<Creator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // First, get all creators that are in agency_inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('agency_inventory')
      .select('creator_id');

    if (inventoryError) {
      return { data: null, error: inventoryError };
    }

    const inventoryCreatorIds = new Set((inventory || []).map(ai => ai.creator_id));

    // Query creators available for harvesting
    // These are creators that were introduced by users but not yet in marketplace
    const { data: creators, error } = await supabase
      .from('creators')
      .select('*')
      .not('created_by_workspace_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching creators for harvesting:', error);
      return { data: null, error };
    }

    // Filter out creators that are already in agency_inventory
    const availableCreators = (creators || []).filter(
      creator => !inventoryCreatorIds.has(creator.id)
    );

    console.log(`📥 Found ${availableCreators.length} creators available for harvesting`);

    return { data: availableCreators, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Add a creator to the agency marketplace (agency_inventory)
 * This makes the creator visible in All Creators for all brands
 */
export async function addCreatorToMarketplace(
  creatorId: string,
  defaultRate?: number,
  currency: string = 'USD',
  tags?: string[]
): Promise<ApiResponse<AgencyInventory>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify creator exists
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', creatorId)
      .maybeSingle();

    if (creatorError || !creator) {
      return { data: null, error: new Error('Creator not found') };
    }

    // Check if creator is already in inventory
    const { data: existing, error: existingError } = await supabase
      .from('agency_inventory')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      return { data: null, error: existingError };
    }

    if (existing) {
      // Update existing entry
      const { data: updated, error: updateError } = await supabase
        .from('agency_inventory')
        .update({
          status: 'active',
          default_rate: defaultRate || existing.default_rate,
          currency: currency || existing.currency,
          tags: tags || existing.tags,
          added_by_admin_user_id: user.id,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        return { data: null, error: updateError };
      }

      return { data: updated, error: null };
    }

    // Insert new entry
    const { data: inventory, error: insertError } = await supabase
      .from('agency_inventory')
      .insert({
        creator_id: creatorId,
        status: 'active',
        default_rate: defaultRate || null,
        currency: currency,
        tags: tags || null,
        added_by_admin_user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error adding creator to marketplace:', insertError);
      return { data: null, error: insertError };
    }

    console.log(`✅ Added creator ${creatorId} to marketplace`);

    return { data: inventory, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update the marketplace status of a creator
 * Can be used to pause or activate creators in the marketplace
 */
export async function updateMarketplaceStatus(
  creatorId: string,
  status: 'active' | 'paused'
): Promise<ApiResponse<AgencyInventory>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Find the inventory entry
    const { data: existing, error: findError } = await supabase
      .from('agency_inventory')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      return { data: null, error: findError };
    }

    if (!existing) {
      return { data: null, error: new Error('Creator not found in marketplace') };
    }

    // Update status
    const { data: updated, error: updateError } = await supabase
      .from('agency_inventory')
      .update({ status })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError };
    }

    console.log(`✅ Updated marketplace status for creator ${creatorId} to ${status}`);

    return { data: updated, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Remove a creator from the marketplace
 * This effectively pauses them (sets status to 'paused')
 */
export async function removeCreatorFromMarketplace(
  creatorId: string
): Promise<ApiResponse<void>> {
  return updateMarketplaceStatus(creatorId, 'paused');
}
