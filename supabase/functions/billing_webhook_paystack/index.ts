import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getSupabaseAdmin,
  paystackRequest,
  toInt,
  verifyPaystackSignature,
} from "../_shared/billing.ts";

const GRACE_DAYS = 3;

async function createSubscription(
  customerCode: string,
  planCode: string,
  authorizationCode?: string,
  quantity?: number,
) {
  return paystackRequest("/subscription", "POST", {
    customer: customerCode,
    plan: planCode,
    authorization: authorizationCode,
    quantity,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const isValid = await verifyPaystackSignature(rawBody, signature);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data || {};

    const supabase = getSupabaseAdmin();
    const eventId =
      data.id?.toString() ||
      payload.id?.toString() ||
      `${event}_${data.reference || data.subscription_code || Date.now()}`;

    const { data: existingEvent } = await supabase
      .from("paystack_events")
      .select("id")
      .eq("paystack_event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = data.metadata || {};
    let workspaceId =
      metadata.workspace_id || data.metadata?.workspace_id || null;
    const reference = data.reference || null;

    if (!workspaceId && data.subscription_code) {
      const { data: subLookup } = await supabase
        .from("subscriptions")
        .select("workspace_id")
        .or(
          `paystack_base_subscription_code.eq.${data.subscription_code},paystack_seat_subscription_code.eq.${data.subscription_code}`,
        )
        .maybeSingle();
      workspaceId = subLookup?.workspace_id || null;
    }

    const { data: loggedEvent } = await supabase
      .from("paystack_events")
      .insert({
        paystack_event_id: eventId,
        event_type: event,
        reference,
        workspace_id: workspaceId,
        payload,
      })
      .select()
      .single();

    const now = new Date();

    switch (event) {
      case "charge.success": {
        if (!workspaceId) break;

        const basePlanCode = metadata.base_plan_code;
        const seatPlanCode = metadata.seat_plan_code;
        const tier = metadata.tier || "starter";
        const billingCycle = metadata.billing_cycle || "monthly";
        const includedSeats = toInt(metadata.included_seats, 1);
        const extraSeats = Math.min(
          2,
          Math.max(0, toInt(metadata.extra_seats, 0)),
        );
        const totalSeats = includedSeats + extraSeats;
        const customerCode = data.customer?.customer_code;
        const authorizationCode = data.authorization?.authorization_code;

        let baseSubscriptionCode = null;
        let baseEmailToken = null;
        let seatSubscriptionCode = null;
        let seatEmailToken = null;
        let periodStart = now.toISOString();
        let periodEnd = null;

        if (basePlanCode && customerCode) {
          const baseSub = await createSubscription(
            customerCode,
            basePlanCode,
            authorizationCode,
          );
          baseSubscriptionCode = baseSub.data.subscription_code;
          baseEmailToken = baseSub.data.email_token;
          if (baseSub.data.start_date) {
            periodStart = baseSub.data.start_date;
          }
          if (baseSub.data.next_payment_date) {
            periodEnd = baseSub.data.next_payment_date;
          }
        }

        if (!periodEnd) {
          const cycleDays = billingCycle === "yearly" ? 365 : 30;
          periodEnd = new Date(
            now.getTime() + cycleDays * 24 * 60 * 60 * 1000,
          ).toISOString();
        }

        if (extraSeats > 0 && seatPlanCode && customerCode) {
          const seatSub = await createSubscription(
            customerCode,
            seatPlanCode,
            authorizationCode,
            extraSeats,
          );
          seatSubscriptionCode = seatSub.data.subscription_code;
          seatEmailToken = seatSub.data.email_token;
        }

        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const payload = {
          workspace_id: workspaceId,
          tier,
          billing_cycle: billingCycle,
          status: "active",
          base_plan_code: basePlanCode,
          seat_plan_code: seatPlanCode,
          paystack_customer_code: customerCode,
          paystack_authorization_code: authorizationCode,
          paystack_base_subscription_code: baseSubscriptionCode,
          paystack_base_email_token: baseEmailToken,
          paystack_seat_subscription_code: seatSubscriptionCode,
          paystack_seat_email_token: seatEmailToken,
          included_seats: includedSeats,
          extra_seats: extraSeats,
          total_seats: totalSeats,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        };

        if (existingSub?.id) {
          await supabase
            .from("subscriptions")
            .update(payload)
            .eq("id", existingSub.id);
        } else {
          await supabase.from("subscriptions").insert(payload);
        }

        break;
      }
      case "invoice.payment_failed":
      case "charge.failed": {
        if (!workspaceId) break;
        const graceEnd = new Date(
          now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
        );
        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            current_period_end: graceEnd.toISOString(),
          })
          .eq("workspace_id", workspaceId);
        break;
      }
      case "subscription.disable":
      case "subscription.not_renew": {
        if (!workspaceId) break;
        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
          })
          .eq("workspace_id", workspaceId);
        break;
      }
      case "subscription.create": {
        if (!workspaceId) break;
        const planCode = data.plan?.plan_code;
        const subscriptionCode = data.subscription_code;
        const emailToken = data.email_token;

        const update: Record<string, unknown> = {};
        if (planCode && subscriptionCode) {
          if (planCode.includes("seat")) {
            update.paystack_seat_subscription_code = subscriptionCode;
            update.paystack_seat_email_token = emailToken;
          } else {
            update.paystack_base_subscription_code = subscriptionCode;
            update.paystack_base_email_token = emailToken;
          }
        }

        if (Object.keys(update).length > 0) {
          await supabase
            .from("subscriptions")
            .update(update)
            .eq("workspace_id", workspaceId);
        }
        break;
      }
      default:
        break;
    }

    if (loggedEvent) {
      await supabase
        .from("paystack_events")
        .update({ processed_at: now.toISOString() })
        .eq("id", loggedEvent.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("billing_webhook_paystack error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
