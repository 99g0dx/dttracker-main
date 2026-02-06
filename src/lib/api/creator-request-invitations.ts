import { supabase } from "../supabase";
import type {
  CreatorRequestInvitation,
  CreatorRequestInvitationStatus,
  ApiResponse,
  ApiListResponse,
} from "../types/database";

export interface CreatorRequestInvitationWithActivation extends CreatorRequestInvitation {
  activations?: {
    id: string;
    title: string;
    brief: string | null;
    deadline: string;
    status: string;
  } | null;
}

export interface CreateInvitationInput {
  creator_id: string;
  quoted_rate: number;
  currency?: string;
  brand_notes?: string | null;
  deliverable_description?: string | null;
}

export interface CreatorRequestInvitationWithCreator extends CreatorRequestInvitation {
  creators?: { id: string; name: string | null; handle: string | null } | null;
}

/**
 * List all invitations for an activation (brand view).
 * Optionally include creator name/handle via withCreator.
 */
export async function listActivationInvitations(
  activationId: string,
  options?: { withCreator?: boolean }
): Promise<
  ApiListResponse<
    CreatorRequestInvitation | CreatorRequestInvitationWithCreator
  >
> {
  try {
    const select = options?.withCreator ? "*, creators(id, name, handle)" : "*";
    const { data, error } = await supabase
      .from("creator_request_invitations")
      .select(select)
      .eq("activation_id", activationId)
      .order("invited_at", { ascending: false });

    if (error) return { data: null, error };
    return {
      data: (data || []) as (CreatorRequestInvitation & {
        creators?: {
          id: string;
          name: string | null;
          handle: string | null;
        } | null;
      })[],
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List invitations for the current user as a creator.
 * RLS restricts to invitations where creator_id matches current user's creator profile.
 */
export async function listMyInvitations(
  status?: CreatorRequestInvitationStatus
): Promise<ApiListResponse<CreatorRequestInvitationWithActivation>> {
  try {
    let query = supabase
      .from("creator_request_invitations")
      .select("*, activations(id, title, brief, deadline, status)")
      .order("invited_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) return { data: null, error };
    return {
      data: (data || []) as CreatorRequestInvitationWithActivation[],
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create invitations for an activation (brand sends invitations to creators).
 */
export async function createInvitations(
  activationId: string,
  invitations: CreateInvitationInput[]
): Promise<ApiListResponse<CreatorRequestInvitation>> {
  if (!invitations.length) {
    return { data: [], error: null };
  }
  try {
    const rows = invitations.map((inv) => ({
      activation_id: activationId,
      creator_id: inv.creator_id,
      quoted_rate: inv.quoted_rate,
      currency: inv.currency ?? "NGN",
      brand_notes: inv.brand_notes ?? null,
      deliverable_description: inv.deliverable_description ?? null,
    }));

    const { data, error } = await supabase
      .from("creator_request_invitations")
      .insert(rows)
      .select("*");

    if (error) return { data: null, error };
    return { data: (data || []) as CreatorRequestInvitation[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Creator accepts invitation. Calls RPC which locks funds from workspace wallet.
 */
export async function acceptInvitation(
  invitationId: string
): Promise<
  ApiResponse<{
    success: boolean;
    invitation_id: string;
    locked_amount: number;
    activation_title?: string;
  }>
> {
  try {
    const { data, error } = await supabase.rpc(
      "accept_creator_request_invitation",
      {
        p_invitation_id: invitationId,
      }
    );

    if (error) return { data: null, error };
    return {
      data: data as {
        success: boolean;
        invitation_id: string;
        locked_amount: number;
        activation_title?: string;
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Creator declines invitation. No wallet changes.
 */
export async function declineInvitation(
  invitationId: string
): Promise<ApiResponse<{ success: boolean; invitation_id: string }>> {
  try {
    const { data, error } = await supabase.rpc(
      "decline_creator_request_invitation",
      {
        p_invitation_id: invitationId,
      }
    );

    if (error) return { data: null, error };
    return {
      data: data as { success: boolean; invitation_id: string },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Brand releases payment to creator after approving deliverable.
 */
export async function releasePayment(
  invitationId: string
): Promise<
  ApiResponse<{
    success: boolean;
    invitation_id: string;
    payment_amount: number;
  }>
> {
  try {
    const { data, error } = await supabase.rpc(
      "release_creator_request_payment",
      {
        p_invitation_id: invitationId,
      }
    );

    if (error) return { data: null, error };
    return {
      data: data as {
        success: boolean;
        invitation_id: string;
        payment_amount: number;
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Brand cancels invitation. Refunds locked funds if creator had accepted.
 */
export async function cancelInvitation(
  invitationId: string
): Promise<
  ApiResponse<{ success: boolean; invitation_id: string; refunded?: number }>
> {
  try {
    const { data, error } = await supabase.rpc(
      "cancel_creator_request_invitation",
      {
        p_invitation_id: invitationId,
      }
    );

    if (error) return { data: null, error };
    return {
      data: data as {
        success: boolean;
        invitation_id: string;
        refunded?: number;
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
