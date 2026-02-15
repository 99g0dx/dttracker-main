/**
 * Shared lookup logic for Dobble Tap → DTTracker webhooks.
 * Resolves submission by id or dobble_tap_submission_id, with activation-scoped fallback.
 * Schema: activation_submissions (id, dobble_tap_submission_id, activation_id).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const ACCEPTED_ID_KEYS = [
  "submissionId",
  "entryId",
  "assetId",
  "id",
  "submission_id",
  "entry_id",
  "asset_id",
  "creatorCampaignEntryId",
] as const;

export function getLookupId(data: Record<string, unknown>): string | null {
  const id =
    (data.submissionId as string) ||
    (data.entryId as string) ||
    (data.assetId as string) ||
    (data.id as string) ||
    (data.submission_id as string) ||
    (data.entry_id as string) ||
    (data.asset_id as string) ||
    (data.creatorCampaignEntryId as string);
  return id && typeof id === "string" ? id : null;
}

export function getActivationIdFromPayload(data: Record<string, unknown>): string | null {
  const aid =
    (data.activationId as string) ||
    (data.creatorCampaignId as string) ||
    (data.campaignId as string) ||
    (data.activation_id as string) ||
    (data.campaign_id as string);
  return aid && typeof aid === "string" ? aid : null;
}

export type ResolveResult = {
  resolvedSubmissionId: string;
  resolvedVia: "id" | "dobble_tap_submission_id";
};

/**
 * Resolve activation_submissions.id from payload.
 * 1) Try activation_submissions.id = lookupId
 * 2) Try activation_submissions.dobble_tap_submission_id = lookupId
 * 3) If activation id in payload: try activation_id + id, then activation_id + dobble_tap_submission_id
 */
export async function resolveSubmissionId(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
): Promise<ResolveResult | null> {
  const lookupId = getLookupId(data);
  if (!lookupId) return null;

  const { data: byId } = await supabase
    .from("activation_submissions")
    .select("id")
    .eq("id", lookupId)
    .maybeSingle();
  if (byId?.id) {
    return { resolvedSubmissionId: byId.id, resolvedVia: "id" };
  }

  const { data: byDobbleTapId } = await supabase
    .from("activation_submissions")
    .select("id")
    .eq("dobble_tap_submission_id", lookupId)
    .maybeSingle();
  if (byDobbleTapId?.id) {
    return { resolvedSubmissionId: byDobbleTapId.id, resolvedVia: "dobble_tap_submission_id" };
  }

  const activationId = getActivationIdFromPayload(data);
  if (activationId) {
    const { data: byActivationAndId } = await supabase
      .from("activation_submissions")
      .select("id")
      .eq("activation_id", activationId)
      .eq("id", lookupId)
      .maybeSingle();
    if (byActivationAndId?.id) {
      return { resolvedSubmissionId: byActivationAndId.id, resolvedVia: "id" };
    }
    const { data: byActivationAndDtId } = await supabase
      .from("activation_submissions")
      .select("id")
      .eq("activation_id", activationId)
      .eq("dobble_tap_submission_id", lookupId)
      .maybeSingle();
    if (byActivationAndDtId?.id) {
      return { resolvedSubmissionId: byActivationAndDtId.id, resolvedVia: "dobble_tap_submission_id" };
    }
  }

  return null;
}

export function log404Payload(
  webhookName: string,
  data: Record<string, unknown>,
  lookupId: string | null,
): void {
  const activationId = getActivationIdFromPayload(data);
  console.warn(`${webhookName}: Submission not found`, {
    lookupId,
    activationId,
    receivedKeys: Object.keys(data),
  });
}
