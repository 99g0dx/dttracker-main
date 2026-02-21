import { supabase } from "../supabase";
import { getBillingCallbackUrl } from "../env";

export type BillingTier = "free" | "starter" | "pro" | "agency";
export type BillingCycle = "monthly" | "yearly";

export interface PlanCatalogEntry {
  id: string;
  tier: BillingTier;
  billing_cycle: BillingCycle;
  base_price_cents: number;
  included_seats: number;
  extra_seat_price_cents: number | null;
  max_active_campaigns: number | null;
  max_creators_per_campaign: number | null;
  platforms: string[];
  scrape_interval_minutes: number;
  retention_days: number;
  api_access: boolean;
  white_label: boolean;
}

export interface PlanCatalogTier {
  tier: BillingTier;
  monthly?: PlanCatalogEntry;
  yearly?: PlanCatalogEntry;
}

export interface BillingCatalogResponse {
  currency: string;
  tiers: PlanCatalogTier[];
}

export interface SubscriptionRecord {
  id: string;
  workspace_id: string;
  tier: BillingTier;
  billing_cycle: BillingCycle;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  included_seats: number;
  extra_seats: number;
  total_seats: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface UsageCounters {
  active_campaigns_count: number;
}

export type AgencyRole = "agency" | "super_agency" | null;

export interface BillingSummary {
  workspace_id: string;
  subscription: SubscriptionRecord;
  plan: PlanCatalogEntry;
  usage: UsageCounters;
  seats_used: number;
  seats_total: number;
  is_paid: boolean;
  is_trialing: boolean;
  days_until_period_end: number | null;
  agency_role: AgencyRole;
}

export interface CheckoutResponse {
  success: boolean;
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface CancelResponse {
  success: boolean;
  cancel_at_period_end: boolean;
}

export interface UpdateSeatsResponse {
  success: boolean;
  extra_seats: number;
  total_seats: number;
}

interface WorkspaceLookup {
  workspaceId: string;
  error: Error | null;
}

async function resolveWorkspaceId(): Promise<WorkspaceLookup> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { workspaceId: "", error: new Error("Not authenticated") };
  }

  const { data: workspaceMember, error: workspaceMemberError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspaceMemberError && workspaceMember?.workspace_id) {
    return { workspaceId: workspaceMember.workspace_id, error: null };
  }

  const { data: legacyMember } = await supabase
    .from("team_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!legacyMember?.workspace_id) {
    return { workspaceId: "", error: new Error("No workspace found — please contact support.") };
  }
  return { workspaceId: legacyMember.workspace_id, error: null };
}

// Default catalog for when edge function isn't available
const DEFAULT_CATALOG: BillingCatalogResponse = {
  currency: "USD",
  tiers: [
    {
      tier: "free",
      monthly: {
        id: "free-monthly",
        tier: "free",
        billing_cycle: "monthly",
        base_price_cents: 0,
        included_seats: 1,
        extra_seat_price_cents: null,
        max_active_campaigns: 1,
        max_creators_per_campaign: 10,
        platforms: ["tiktok"],
        scrape_interval_minutes: 2880,
        retention_days: 30,
        api_access: false,
        white_label: false,
      },
    },
    {
      tier: "starter",
      monthly: {
        id: "starter-monthly",
        tier: "starter",
        billing_cycle: "monthly",
        base_price_cents: 1900,
        included_seats: 1,
        extra_seat_price_cents: 500,
        max_active_campaigns: 3,
        max_creators_per_campaign: 25,
        platforms: ["tiktok", "instagram"],
        scrape_interval_minutes: 720,
        retention_days: 180,
        api_access: false,
        white_label: false,
      },
      yearly: {
        id: "starter-yearly",
        tier: "starter",
        billing_cycle: "yearly",
        base_price_cents: 18200,
        included_seats: 1,
        extra_seat_price_cents: 4800,
        max_active_campaigns: 3,
        max_creators_per_campaign: 25,
        platforms: ["tiktok", "instagram"],
        scrape_interval_minutes: 720,
        retention_days: 180,
        api_access: false,
        white_label: false,
      },
    },
    {
      tier: "pro",
      monthly: {
        id: "pro-monthly",
        tier: "pro",
        billing_cycle: "monthly",
        base_price_cents: 4900,
        included_seats: 2,
        extra_seat_price_cents: 900,
        max_active_campaigns: 10,
        max_creators_per_campaign: 100,
        platforms: ["tiktok", "instagram", "youtube", "x", "facebook"],
        scrape_interval_minutes: 240,
        retention_days: 36500,
        api_access: false,
        white_label: false,
      },
      yearly: {
        id: "pro-yearly",
        tier: "pro",
        billing_cycle: "yearly",
        base_price_cents: 47000,
        included_seats: 2,
        extra_seat_price_cents: 8600,
        max_active_campaigns: 10,
        max_creators_per_campaign: 100,
        platforms: ["tiktok", "instagram", "youtube", "x", "facebook"],
        scrape_interval_minutes: 240,
        retention_days: 36500,
        api_access: false,
        white_label: false,
      },
    },
    {
      tier: "agency",
      monthly: {
        id: "agency-monthly",
        tier: "agency",
        billing_cycle: "monthly",
        base_price_cents: 12900,
        included_seats: 3,
        extra_seat_price_cents: 700,
        max_active_campaigns: null,
        max_creators_per_campaign: null,
        platforms: ["tiktok", "instagram", "youtube", "x", "facebook"],
        scrape_interval_minutes: 30,
        retention_days: 36500,
        api_access: true,
        white_label: true,
      },
      yearly: {
        id: "agency-yearly",
        tier: "agency",
        billing_cycle: "yearly",
        base_price_cents: 123800,
        included_seats: 3,
        extra_seat_price_cents: 6700,
        max_active_campaigns: null,
        max_creators_per_campaign: null,
        platforms: ["tiktok", "instagram", "youtube", "x", "facebook"],
        scrape_interval_minutes: 30,
        retention_days: 36500,
        api_access: true,
        white_label: true,
      },
    },
  ],
};

export async function getBillingCatalog(): Promise<BillingCatalogResponse> {
  try {
    const response = await supabase.functions.invoke("billing_get_catalog", {
      method: "GET",
    });

    if (response.error) {
      console.warn("billing_get_catalog failed, using default catalog:", response.error);
      return DEFAULT_CATALOG;
    }

    // Validate response has expected structure
    if (!response.data?.tiers || !Array.isArray(response.data.tiers)) {
      console.warn("Invalid catalog response, using default catalog");
      return DEFAULT_CATALOG;
    }

    return response.data as BillingCatalogResponse;
  } catch (err) {
    console.warn("Failed to fetch billing catalog, using default:", err);
    return DEFAULT_CATALOG;
  }
}

// Default plan for when database hasn't been set up
const DEFAULT_FREE_PLAN: PlanCatalogEntry = {
  id: "default-free",
  tier: "free",
  billing_cycle: "monthly",
  base_price_cents: 0,
  included_seats: 1,
  extra_seat_price_cents: null,
  max_active_campaigns: 1,
  max_creators_per_campaign: 10,
  platforms: ["tiktok"],
  scrape_interval_minutes: 2880,
  retention_days: 30,
  api_access: false,
  white_label: false,
};

export async function getBillingSummary(workspaceIdParam?: string): Promise<BillingSummary> {
  let workspaceId: string;
  if (workspaceIdParam) {
    workspaceId = workspaceIdParam;
  } else {
    const lookup = await resolveWorkspaceId();
    if (lookup.error) {
      throw lookup.error;
    }
    workspaceId = lookup.workspaceId;
  }

  // Fetch agency_role from profiles
  let agencyRole: AgencyRole = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.agency_role === "agency" || profile?.agency_role === "super_agency") {
        agencyRole = profile.agency_role;
      }
    }
  } catch (e) {
    console.warn("Could not fetch agency_role from profiles:", e);
  }

  // Try to get subscription - may not exist if migration not run or table doesn't exist
  let subscription: any = null;
  try {
    const { data, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subError) {
      subscription = data;
    }
  } catch (e) {
    // Table might not exist yet - continue with defaults
    console.warn("subscriptions table may not exist:", e);
  }

  const tier = (subscription?.tier as BillingTier) || "free";
  const billingCycle = (subscription?.billing_cycle as BillingCycle) || "monthly";

  // Try to get plan from catalog - use default if not available
  let plan: any = null;
  try {
    const { data, error: planError } = await supabase
      .from("plan_catalog")
      .select("*")
      .eq("tier", tier)
      .eq("billing_cycle", billingCycle)
      .eq("is_active", true)
      .maybeSingle();

    if (!planError) {
      plan = data;
    }
  } catch (e) {
    // Table might not exist yet - continue with defaults
    console.warn("plan_catalog table may not exist:", e);
  }

  // Use default free plan if database not set up
  const effectivePlan = plan || DEFAULT_FREE_PLAN;

  // Try to get usage counters - may not exist
  let usageCount = 0;
  try {
    const { data: usage } = await supabase
      .from("usage_counters")
      .select("active_campaigns_count")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    usageCount = usage?.active_campaigns_count ?? 0;
  } catch (e) {
    // Table might not exist - try counting campaigns directly
    try {
      const { count } = await supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("user_id", workspaceId)
        .eq("status", "active");
      usageCount = count || 0;
    } catch {
      // Campaigns table should exist but just in case
    }
  }

  // Count seats from workspace_members or fall back to team_members
  let seatsUsed = 1;
  try {
    const { count: workspaceMemberCount } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (workspaceMemberCount !== null && workspaceMemberCount > 0) {
      seatsUsed = workspaceMemberCount;
    } else {
      throw new Error("No workspace_members, try team_members");
    }
  } catch {
    // Fall back to team_members if workspace_members doesn't exist
    try {
      const { count: teamMemberCount } = await supabase
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      seatsUsed = teamMemberCount || 1;
    } catch {
      seatsUsed = 1;
    }
  }

  const currentPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const daysUntilPeriodEnd = currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil(
          (currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const fallbackSubscription: SubscriptionRecord = subscription || {
    id: "",
    workspace_id: workspaceId,
    tier: "free",
    billing_cycle: "monthly",
    status: "active",
    included_seats: effectivePlan.included_seats,
    extra_seats: 0,
    total_seats: effectivePlan.included_seats,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
  };

  const totalSeats =
    subscription?.total_seats ?? effectivePlan.included_seats ?? 1;

  return {
    workspace_id: workspaceId,
    subscription: fallbackSubscription,
    plan: effectivePlan,
    usage: {
      active_campaigns_count: usageCount,
    },
    seats_used: seatsUsed,
    seats_total: totalSeats,
    is_paid: tier !== "free" && subscription?.status === "active",
    is_trialing: subscription?.status === "trialing",
    days_until_period_end: daysUntilPeriodEnd,
    agency_role: agencyRole,
  };
}

export async function createCheckout(params: {
  workspaceId: string;
  tier: BillingTier;
  billingCycle: BillingCycle;
  extraSeats: number;
  callbackUrl?: string;
}): Promise<CheckoutResponse> {
  const getSession = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;
    const now = Date.now() / 1000;
    const isExpiringSoon = !session?.expires_at || session.expires_at - now < 60;

    if (!session || isExpiringSoon) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      session = refreshData.session ?? session;
    }

    return session;
  };

  const invokeCheckout = async (token: string) =>
    supabase.functions.invoke("billing_create_checkout", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        workspace_id: params.workspaceId,
        tier: params.tier,
        billing_cycle: params.billingCycle,
        extra_seats: params.extraSeats,
        callback_url: params.callbackUrl || getBillingCallbackUrl(),
      },
    });

  let session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const extractErrorDetails = async (response: {
    error: Error | null;
    data: unknown;
    response?: Response;
  }) => {
    let detailedMessage = "";
    const errorResponse =
      (response.error as { context?: Response }).context || response.response;

    if (errorResponse) {
      try {
        const contentType = errorResponse.headers.get("Content-Type") || "";
        const bodyText = await errorResponse.text();
        if (contentType.includes("application/json")) {
          const parsed = JSON.parse(bodyText);
          detailedMessage = parsed.error || parsed.message || bodyText;
        } else {
          detailedMessage = bodyText;
        }
      } catch {
        // ignore parsing errors
      }
    }

    const fallbackDetail = (response.data as { error?: string } | null)?.error;
    const statusDetail =
      errorResponse && "status" in errorResponse
        ? `Request failed (${errorResponse.status} ${errorResponse.statusText || ""})`.trim()
        : "";
    return {
      detailedMessage,
      fallbackDetail,
      statusDetail,
      rawMessage: response.error?.message || "",
    };
  };

  let response = await invokeCheckout(session.access_token);
  let retried = false;

  if (response.error) {
    const details = await extractErrorDetails(response);
    const errorMessage =
      details.detailedMessage || details.fallbackDetail || details.rawMessage;
    if (!retried && /invalid jwt/i.test(errorMessage)) {
      retried = true;
      const { data: refreshData } = await supabase.auth.refreshSession();
      const refreshed = refreshData.session;
      if (!refreshed) {
        throw new Error("Session expired. Please sign in again.");
      }
      response = await invokeCheckout(refreshed.access_token);
      if (!response.error) {
        return response.data as CheckoutResponse;
      }
      const retryDetails = await extractErrorDetails(response);
      throw new Error(
        retryDetails.detailedMessage ||
          retryDetails.fallbackDetail ||
          retryDetails.statusDetail ||
          retryDetails.rawMessage ||
          "Failed to create checkout"
      );
    }
    throw new Error(
      details.detailedMessage ||
        details.fallbackDetail ||
        details.statusDetail ||
        details.rawMessage ||
        "Failed to create checkout"
    );
  }

  if ((response.data as { error?: string } | null)?.error) {
    throw new Error((response.data as { error?: string }).error || "Failed to create checkout");
  }

  return response.data as CheckoutResponse;
}

export async function updateSeats(params: {
  workspaceId: string;
  extraSeats: number;
}): Promise<UpdateSeatsResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;
  const now = Date.now() / 1000;
  const isExpiringSoon = !session?.expires_at || session.expires_at - now < 60;

  if (!session || isExpiringSoon) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    session = refreshData.session ?? session;
  }

  if (!session) {
    throw new Error("Not authenticated");
  }

  const response = await supabase.functions.invoke("billing_update_seats", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      workspace_id: params.workspaceId,
      new_extra_seats: params.extraSeats,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || "Failed to update seats");
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data as UpdateSeatsResponse;
}

export async function cancelSubscription(workspaceId: string): Promise<CancelResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;
  const now = Date.now() / 1000;
  const isExpiringSoon = !session?.expires_at || session.expires_at - now < 60;

  if (!session || isExpiringSoon) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    session = refreshData.session ?? session;
  }

  if (!session) {
    throw new Error("Not authenticated");
  }

  const response = await supabase.functions.invoke("billing_cancel", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      workspace_id: workspaceId,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || "Failed to cancel subscription");
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data as CancelResponse;
}

export function formatPrice(amountInCents: number, currency = "USD") {
  if (amountInCents === 0) return "Free";
  const amount = amountInCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
