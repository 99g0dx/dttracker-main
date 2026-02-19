import { supabase } from "../supabase";

export interface CommunityInviteLink {
  id: string;
  workspace_id: string;
  token: string;
  enabled: boolean;
  created_by: string;
  join_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityInviteVerifyResult {
  valid: boolean;
  workspace_id?: string;
  workspace_name?: string;
  error?: string;
}

export interface DobbleTapVerifyResult {
  found: boolean;
  dobble_tap_user_id?: string;
  handles?: Array<{ handle: string; platform: string }>;
}

export interface JoinCommunityRequest {
  invite_token: string;
  path: "existing_dt_user" | "new_user";
  handle: string;
  platform: string;
  name?: string;
  email: string;
  phone?: string;
  dobble_tap_user_id?: string;
}

export interface JoinCommunityResult {
  success: boolean;
  fan_id?: string;
  already_member?: boolean;
  redirect_url?: string;
  message?: string;
  error?: string;
}

// ---- Authenticated (management) ----

export async function getCommunityInviteLink(
  workspaceId: string
): Promise<CommunityInviteLink | null> {
  const { data, error } = await supabase
    .from("community_invite_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    // Table may not exist yet
    if (error.message?.includes("does not exist")) return null;
    throw error;
  }

  return data;
}

export async function generateCommunityInviteLink(
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("generate_community_invite_link", {
    p_workspace_id: workspaceId,
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Failed to generate invite link");

  return data[0].token;
}

export async function revokeCommunityInviteLink(
  workspaceId: string
): Promise<void> {
  const { error } = await supabase.rpc("revoke_community_invite_link", {
    p_workspace_id: workspaceId,
  });

  if (error) throw error;
}

// ---- Public (no auth) ----

export async function verifyCommunityInviteToken(
  token: string
): Promise<CommunityInviteVerifyResult> {
  const { data, error } = await supabase.functions.invoke(
    "community-invite-verify",
    { body: { token } }
  );

  if (error) {
    // Prefer backend message when available (e.g. 404 "Invite link not found or no longer active")
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : error.message;
    return { valid: false, error: msg };
  }

  return data as CommunityInviteVerifyResult;
}

export async function verifyDobbleTapUser(
  inviteToken: string,
  email: string,
): Promise<DobbleTapVerifyResult> {
  const { data, error } = await supabase.functions.invoke(
    "community-fan-verify-dt",
    {
      body: {
        invite_token: inviteToken,
        email,
      },
    }
  );

  if (error) {
    return { found: false };
  }

  return data as DobbleTapVerifyResult;
}

export async function joinCommunity(
  request: JoinCommunityRequest
): Promise<JoinCommunityResult> {
  const { data, error } = await supabase.functions.invoke(
    "community-fan-join",
    { body: request }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return data as JoinCommunityResult;
}
