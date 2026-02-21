import { supabase } from "../supabase";
import type {
  Activation,
  ActivationInsert,
  ActivationUpdate,
  ActivationSubmission,
  LeaderboardEntry,
  ApiResponse,
  ApiListResponse,
} from "../types/database";
import {
  buildPrizeStructure,
  calculatePerformanceScore,
} from "../utils/contest-prizes";

/**
 * Calculate service fee (10% of base amount)
 */
export function calculateServiceFee(amount: number): number {
  return Math.round(amount * 0.10 * 100) / 100;
}

/**
 * Calculate total cost including service fee
 */
export function calculateTotalCost(budget: number): {
  budget: number;
  serviceFee: number;
  total: number;
} {
  const serviceFee = calculateServiceFee(budget);
  return {
    budget,
    serviceFee,
    total: budget + serviceFee,
  };
}

export interface ActivationWithSubmissionCount extends Activation {
  submissions_count?: number;
  total_views?: number;
  approved_count?: number;
}

export async function listActivations(
  workspaceId: string | null,
  filters?: {
    type?: "contest" | "sm_panel" | "creator_request";
    status?: string;
    visibility?: "public" | "community" | "all";
  }
): Promise<ApiListResponse<ActivationWithSubmissionCount>> {
  if (!workspaceId) {
    return { data: null, error: new Error("Workspace ID required") };
  }
  try {
    let query = supabase
      .from("activations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.visibility && filters.visibility !== "all") {
      query = query.eq("visibility", filters.visibility);
    }

    const { data: activations, error } = await query;

    if (error) return { data: null, error };

    const ids = (activations || []).map((a: any) => a.id);
    let submissionCounts: Record<string, number> = {};
    let viewCounts: Record<string, number> = {};
    let approvedCounts: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: submissions } = await supabase
        .from("activation_submissions")
        .select("activation_id, performance_metrics, status")
        .in("activation_id", ids);

      const arr = (submissions || []) as { activation_id: string; performance_metrics: Record<string, unknown> | null; status: string }[];
      arr.forEach((s) => {
        submissionCounts[s.activation_id] =
          (submissionCounts[s.activation_id] || 0) + 1;
        if (s.status === 'approved') {
          approvedCounts[s.activation_id] =
            (approvedCounts[s.activation_id] || 0) + 1;
        }
        const views = Number(s.performance_metrics?.views) || 0;
        viewCounts[s.activation_id] =
          (viewCounts[s.activation_id] || 0) + views;
      });
    }

    const items = (activations || []).map((a: any) => ({
      ...a,
      submissions_count: submissionCounts[a.id] ?? 0,
      total_views: viewCounts[a.id] ?? 0,
      approved_count: approvedCounts[a.id] ?? 0,
    }));

    return { data: items, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getActivation(
  id: string
): Promise<ApiResponse<Activation>> {
  try {
    const { data, error } = await supabase
      .from("activations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return { data: null, error };
    return { data: data as Activation, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export interface ContestLeaderboardResult {
  leaderboard: LeaderboardEntry[];
  activation: Activation;
}

export async function getContestLeaderboard(
  activationId: string
): Promise<ApiResponse<ContestLeaderboardResult>> {
  try {
    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select("*")
      .eq("id", activationId)
      .single();

    if (actError || !activation) {
      return {
        data: null,
        error: actError || new Error("Activation not found"),
      };
    }

    const { data: submissions, error: subError } = await supabase
      .from("activation_submissions")
      .select("*")
      .eq("activation_id", activationId)
      .order("submitted_at", { ascending: true });

    if (subError) return { data: null, error: subError };

    const subs = (submissions || []) as ActivationSubmission[];

    // Helper: strip leading @ from handles
    const stripAt = (h: string | null | undefined): string | null =>
      h ? h.replace(/^@+/, "") || null : null;

    // Determine the activation's target platform for handle resolution
    const activationPlatform =
      activation.platforms && activation.platforms.length > 0
        ? activation.platforms[0]
        : null;

    // Look up creator handles/names for submissions that only have a creator_id
    const allCreatorIds = [
      ...new Set(subs.map((s) => s.creator_id).filter(Boolean) as string[]),
    ];

    // Maps: submissionCreatorId → { dtCreatorId, handle, name, platform }
    const creatorMap = new Map<
      string,
      {
        dtCreatorId: string;
        handle: string | null;
        name: string | null;
        platform: string | null;
      }
    >();

    if (allCreatorIds.length > 0) {
      // First try matching by creators.id (DTTracker native IDs)
      const { data: byId } = await supabase
        .from("creators")
        .select("id, handle, name, platform, dobble_tap_user_id")
        .in("id", allCreatorIds);

      if (byId) {
        for (const c of byId) {
          creatorMap.set(c.id, {
            dtCreatorId: c.id,
            handle: c.handle,
            name: c.name,
            platform: c.platform,
          });
        }
      }

      // For any IDs not found, try matching by dobble_tap_user_id
      const unresolvedIds = allCreatorIds.filter((id) => !creatorMap.has(id));
      if (unresolvedIds.length > 0) {
        const { data: byDtId } = await supabase
          .from("creators")
          .select("id, handle, name, platform, dobble_tap_user_id")
          .in("dobble_tap_user_id", unresolvedIds);

        if (byDtId) {
          for (const c of byDtId) {
            if (c.dobble_tap_user_id) {
              creatorMap.set(c.dobble_tap_user_id, {
                dtCreatorId: c.id,
                handle: c.handle,
                name: c.name,
                platform: c.platform,
              });
            }
          }
        }
      }
    }

    // Look up platform-specific handles from creator_social_accounts
    // e.g. for a TikTok activation, get the creator's TikTok handle
    const socialHandleMap = new Map<string, string>(); // dtCreatorId → platform handle

    const dtCreatorIds = [
      ...new Set(
        Array.from(creatorMap.values()).map((c) => c.dtCreatorId)
      ),
    ];

    if (dtCreatorIds.length > 0 && activationPlatform) {
      const { data: socialAccounts } = await supabase
        .from("creator_social_accounts")
        .select("creator_id, handle")
        .in("creator_id", dtCreatorIds)
        .eq("platform", activationPlatform);

      if (socialAccounts) {
        for (const sa of socialAccounts) {
          socialHandleMap.set(sa.creator_id, sa.handle);
        }
      }
    }

    const byCreator = new Map<
      string,
      {
        creator_id: string | null;
        creator_handle: string | null;
        creator_platform: string | null;
        total_views: number;
        total_likes: number;
        total_comments: number;
        submissions: ActivationSubmission[];
      }
    >();

    for (const s of subs) {
      // Resolve handle: prefer platform-specific social handle, then submission handle, then creators table
      const looked = s.creator_id ? creatorMap.get(s.creator_id) : null;
      const platformHandle = looked
        ? stripAt(socialHandleMap.get(looked.dtCreatorId))
        : null;
      const resolvedHandle =
        platformHandle ??
        stripAt(s.creator_handle) ??
        stripAt(looked?.handle) ??
        stripAt(looked?.name) ??
        null;
      const resolvedPlatform =
        s.creator_platform ?? looked?.platform ?? null;

      const key =
        s.creator_id ?? `${resolvedHandle ?? ""}:${resolvedPlatform ?? ""}`;

      if (!byCreator.has(key)) {
        byCreator.set(key, {
          creator_id: s.creator_id,
          creator_handle: resolvedHandle,
          creator_platform: resolvedPlatform,
          total_views: 0,
          total_likes: 0,
          total_comments: 0,
          submissions: [],
        });
      }
      const entry = byCreator.get(key)!;
      const m = (s.performance_metrics || {}) as Record<string, number>;
      entry.total_views += m.views ?? 0;
      entry.total_likes += m.likes ?? 0;
      entry.total_comments += m.comments ?? 0;
      entry.submissions.push(s);
    }

    const totalBudget = Number(activation.total_budget) || 0;
    const prizeStructure = buildPrizeStructure(totalBudget);

    const leaderboard: LeaderboardEntry[] = Array.from(byCreator.values())
      .map((e) => ({
        ...e,
        cumulative_score: calculatePerformanceScore(
          e.total_views,
          e.total_likes,
          e.total_comments
        ),
      }))
      .sort((a, b) => b.cumulative_score - a.cumulative_score)
      .map((e, idx) => {
        const rank = idx + 1;
        const prizeAmount = Number(prizeStructure[String(rank)] ?? 0);
        return {
          creator_id: e.creator_id,
          creator_handle: e.creator_handle,
          creator_platform: e.creator_platform,
          total_posts: e.submissions.length,
          total_views: e.total_views,
          total_likes: e.total_likes,
          total_comments: e.total_comments,
          cumulative_score: e.cumulative_score,
          current_rank: rank,
          prize_amount: prizeAmount,
          is_winner: rank <= 20,
          submissionIds: e.submissions.map((s) => s.id),
          submissions: e.submissions.map((s) => ({
            id: s.id,
            content_url: s.content_url || s.post_url,
            performance_metrics: s.performance_metrics,
            performance_score: s.performance_score,
            submitted_at: s.submitted_at,
          })),
        };
      });

    return {
      data: { leaderboard, activation: activation as Activation },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/** Submission with optional display handle resolved from creators when creator_handle is null */
export type ActivationSubmissionWithDisplay = ActivationSubmission & {
  display_handle?: string | null;
};

export async function getActivationSubmissions(
  activationId: string
): Promise<ApiResponse<ActivationSubmissionWithDisplay[]>> {
  try {
    const { data, error } = await supabase
      .from("activation_submissions")
      .select("*")
      .eq("activation_id", activationId)
      .order("performance_score", { ascending: false, nullsFirst: false })
      .order("submitted_at", { ascending: true });

    if (error) return { data: null, error };
    const submissions = (data || []) as ActivationSubmissionWithDisplay[];

    const creatorIdsToResolve = [
      ...new Set(
        submissions
          .filter((s) => !s.creator_handle && s.creator_id)
          .map((s) => s.creator_id as string)
      ),
    ];
    if (creatorIdsToResolve.length > 0) {
      const creatorMap = new Map<
        string,
        { handle: string | null; name: string | null }
      >();

      // Try matching by creators.id (DTTracker native IDs)
      const { data: byId } = await supabase
        .from("creators")
        .select("id, handle, name")
        .in("id", creatorIdsToResolve);
      for (const c of byId || []) {
        creatorMap.set(c.id, { handle: c.handle, name: c.name });
      }

      // For unresolved IDs, try matching by dobble_tap_user_id
      const unresolvedIds = creatorIdsToResolve.filter((id) => !creatorMap.has(id));
      if (unresolvedIds.length > 0) {
        const { data: byDtId } = await supabase
          .from("creators")
          .select("id, handle, name, dobble_tap_user_id")
          .in("dobble_tap_user_id", unresolvedIds);
        for (const c of byDtId || []) {
          if (c.dobble_tap_user_id) {
            creatorMap.set(c.dobble_tap_user_id, { handle: c.handle, name: c.name });
          }
        }
      }

      for (const s of submissions) {
        if (!s.creator_handle && s.creator_id) {
          const creator = creatorMap.get(s.creator_id);
          s.display_handle =
            creator?.handle ?? creator?.name ?? null;
        }
      }
    }

    return { data: submissions, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function createActivation(
  activation: ActivationInsert,
  createdBy?: string
): Promise<ApiResponse<Activation>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const insert = {
      ...activation,
      created_by: createdBy ?? user.id,
      status: "draft",
    };

    const { data, error } = await supabase
      .from("activations")
      .insert(insert)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as Activation, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function updateActivation(
  id: string,
  updates: ActivationUpdate
): Promise<ApiResponse<Activation>> {
  try {
    const { data: existing } = await supabase
      .from("activations")
      .select("status")
      .eq("id", id)
      .single();

    const isOnlyImageUrl =
      Object.keys(updates).length === 1 && "image_url" in updates;
    if (existing && existing.status !== "draft" && !isOnlyImageUrl) {
      return {
        data: null,
        error: new Error(
          "Cannot update activation that is not in draft status"
        ),
      };
    }

    const { data, error } = await supabase
      .from("activations")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as Activation, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function deleteActivation(
  id: string
): Promise<ApiResponse<void>> {
  try {
    const { data: existing } = await supabase
      .from("activations")
      .select("status")
      .eq("id", id)
      .single();

    if (!existing) {
      return {
        data: null,
        error: new Error("Activation not found"),
      };
    }

    if (existing.status !== "draft" && existing.status !== "cancelled") {
      return {
        data: null,
        error: new Error(
          "Can only delete activations in draft or cancelled status"
        ),
      };
    }

    const { error } = await supabase
      .from("activations")
      .delete()
      .eq("id", id);

    if (error) return { data: null, error };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function publishActivation(
  activationId: string
): Promise<ApiResponse<Activation>> {
  try {
    if (!activationId) {
      return { data: null, error: new Error("Activation ID required") };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data, error } = await supabase.functions.invoke(
      "activation-publish",
      {
        body: { activationId },
      }
    );

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (data?.error) {
      return { data: null, error: new Error(data.error) };
    }

    return { data: data?.activation as Activation, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function syncActivationToDobbleTap(
  activationId: string
): Promise<ApiResponse<Activation>> {
  try {
    if (!activationId) {
      return { data: null, error: new Error("Activation ID required") };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data, error } = await supabase.functions.invoke(
      "activation-sync-to-dobbletap",
      {
        body: { activationId },
      }
    );

    if (error) {
      const message =
        typeof data?.error === "string"
          ? data.error
          : error.message || "Failed to send a request to the Edge Function";
      return { data: null, error: new Error(message) };
    }

    if (data?.error) {
      return { data: null, error: new Error(String(data.error)) };
    }

    return { data: data?.activation as Activation, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function approveSubmission(
  submissionId: string,
  paymentAmount?: number
): Promise<ApiResponse<ActivationSubmission>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: existing, error: fetchError } = await supabase
      .from("activation_submissions")
      .select("id, payment_amount, activation_id, activations(type)")
      .eq("id", submissionId)
      .single();

    if (fetchError || !existing) {
      return {
        data: null,
        error: fetchError || new Error("Submission not found"),
      };
    }

    const effectivePayment =
      paymentAmount != null
        ? paymentAmount
        : existing.payment_amount != null
          ? Number(existing.payment_amount)
          : 0;

    // Call wallet RPC first so we don't mark approved if deduction fails
    if (effectivePayment > 0) {
      const { error: unlockError } = await supabase.rpc(
        "release_sm_panel_payment",
        {
          p_submission_id: submissionId,
          p_payment_amount: effectivePayment,
        }
      );
      if (unlockError) {
        return { data: null, error: unlockError };
      }
    }

    const { data, error } = await supabase
      .from("activation_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        ...(paymentAmount != null && { payment_amount: paymentAmount }),
      })
      .eq("id", submissionId)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as ActivationSubmission, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function rejectSubmission(
  submissionId: string
): Promise<ApiResponse<ActivationSubmission>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // reject_sm_panel_submission atomically:
    //   1. Marks submission as rejected
    //   2. Returns the reserved payment amount from locked_balance to available balance
    //   3. Decrements activations.spent_amount
    const { error: rpcError } = await supabase.rpc("reject_sm_panel_submission", {
      p_submission_id: submissionId,
    });

    if (rpcError) {
      console.error("rejectSubmission: RPC error", rpcError);
      return { data: null, error: rpcError };
    }

    // Stamp reviewed_by (kept in the frontend call to avoid passing user_id into SECURITY DEFINER)
    await supabase
      .from("activation_submissions")
      .update({ reviewed_by: user.id })
      .eq("id", submissionId);

    const { data, error } = await supabase
      .from("activation_submissions")
      .select()
      .eq("id", submissionId)
      .single();

    if (error) return { data: null, error };
    return { data: data as ActivationSubmission, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function scrapeSubmissionMetrics(
  submissionId: string
): Promise<ApiResponse<{ metrics: Record<string, number> }>> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!supabaseUrl) {
      return { data: null, error: new Error("Missing Supabase URL") };
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/scrape-activation-submission`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          ...(import.meta.env.VITE_SUPABASE_ANON_KEY && {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          }),
        },
        body: JSON.stringify({ submissionId }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: new Error(
          result?.error || result?.message || "Failed to scrape metrics"
        ),
      };
    }

    return { data: result, error: null };
  } catch (err) {
    const error = err as Error;
    const message = error.message || "";

    // Provide user-friendly message for network errors
    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("Network request failed")
    ) {
      return {
        data: null,
        error: new Error(
          'Cannot reach scraping service. The Edge Function "scrape-activation-submission" may not be deployed.'
        ),
      };
    }

    return { data: null, error };
  }
}

export async function finalizeContestWinners(
  activationId: string,
  winnerSubmissions: Array<{
    submissionId: string;
    rank: number;
    prizeAmount: number;
  }>
): Promise<ApiResponse<void>> {
  try {
    const winnerPayments = winnerSubmissions.map((w) => ({
      submission_id: w.submissionId,
      prize_amount: w.prizeAmount,
    }));

    const { error: walletError } = await supabase.rpc(
      "finalize_contest_wallet",
      {
        p_activation_id: activationId,
        p_winner_payments: winnerPayments,
      }
    );

    if (walletError) {
      return { data: null, error: walletError };
    }

    for (const w of winnerSubmissions) {
      const { error } = await supabase
        .from("activation_submissions")
        .update({
          rank: w.rank,
          prize_amount: w.prizeAmount,
          status: "approved",
        })
        .eq("id", w.submissionId)
        .eq("activation_id", activationId);

      if (error) {
        return { data: null, error };
      }
    }

    const totalPaid = winnerSubmissions.reduce((s, w) => s + w.prizeAmount, 0);

    const { error: updateError } = await supabase
      .from("activations")
      .update({
        status: "completed",
        finalized_at: new Date().toISOString(),
        spent_amount: totalPaid,
      })
      .eq("id", activationId);

    if (updateError) return { data: null, error: updateError };

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Finalize an SM panel activation: refund unused budget and mark completed.
 * Calls finalize_sm_panel_activation RPC (SM panel only).
 */
export async function finalizeActivation(
  activationId: string
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.rpc("finalize_sm_panel_activation", {
      p_activation_id: activationId,
    });
    if (error) return { data: null, error };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Cancel an SM panel activation: refund remaining locked budget and mark cancelled.
 * Calls cancel_sm_panel_activation RPC (SM panel only).
 */
export async function cancelActivation(
  activationId: string
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.rpc("cancel_sm_panel_activation", {
      p_activation_id: activationId,
    });
    if (error) return { data: null, error };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Close a live activation: set status to cancelled.
 * - SM panel: uses cancel_sm_panel_activation RPC (refunds remaining budget).
 * - Contest: direct status update to cancelled.
 */
export async function closeActivation(
  activationId: string
): Promise<ApiResponse<void>> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("activations")
      .select("id, type, status")
      .eq("id", activationId)
      .single();

    if (fetchError || !existing) {
      return {
        data: null,
        error: fetchError || new Error("Activation not found"),
      };
    }

    if (existing.status !== "live") {
      return {
        data: null,
        error: new Error("Only live activations can be closed"),
      };
    }

    if (existing.type === "sm_panel") {
      return cancelActivation(activationId);
    }

    // Contest: use dedicated cancel RPC which refunds remaining locked budget
    // and sets status = 'cancelled' atomically.
    const { error } = await supabase.rpc("cancel_contest_activation", {
      p_activation_id: activationId,
    });

    if (error) return { data: null, error };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
