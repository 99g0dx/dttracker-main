import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  ACCEPTED_ID_KEYS,
  getLookupId,
  resolveSubmissionId,
  log404Payload,
} from "../_shared/dttracker-webhook-lookup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-source",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const syncApiKey = Deno.env.get("SYNC_API_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!syncApiKey || authHeader !== `Bearer ${syncApiKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { eventType, timestamp } = body;
    const data = body?.data ?? {};
    const verificationStatusRaw =
      data.verificationStatus ?? data.status ?? null;
    const verificationStatusNormalized =
      typeof verificationStatusRaw === "string"
        ? verificationStatusRaw.toLowerCase()
        : null;

    if (!eventType || !timestamp || !data || !verificationStatusRaw) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const lookupId = getLookupId(data);
    if (!lookupId) {
      console.warn(
        "dobbletap-webhook-verification-completed: Missing submission identifier",
        { receivedKeys: Object.keys(data), eventType },
      );
      return new Response(
        JSON.stringify({
          error: "Missing submission identifier",
          required: [...ACCEPTED_ID_KEYS],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const idempotencyKey = `${lookupId}-${eventType}-${timestamp}`;

    const { data: existingEvent } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      return new Response(
        JSON.stringify({
          id: existingEvent.id,
          status: "already_processed",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Store webhook event
    const { data: webhookEvent } = await supabase
      .from("webhook_events")
      .insert({
        event_type: eventType,
        campaign_id: data.campaignId || null,
        timestamp: timestamp,
        payload: body,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    const resolved = await resolveSubmissionId(supabase, data);
    if (!resolved) {
      log404Payload("dobbletap-webhook-verification-completed", data, lookupId);
      return new Response(
        JSON.stringify({
          error: "Submission not found",
          event_id: webhookEvent?.id,
          status: "submission_not_found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { resolvedSubmissionId, resolvedVia } = resolved;

    // Store verification results (use DTTracker submission id)
    const { data: verification, error: verificationError } = await supabase
      .from("verification_results")
      .insert({
        submission_id: resolvedSubmissionId,
        verification_type: data.verificationType,
        status: verificationStatusRaw,
        results: data.verificationResults || {},
        verified_at: data.verifiedAt || timestamp,
        dobble_tap_verification_id: data.verificationId || null,
      })
      .select()
      .single();

    if (verificationError) {
      console.error(
        "dobbletap-webhook-verification-completed: Failed to store verification",
        verificationError,
      );
      throw verificationError;
    }

    // Update submission status based on verification
    if (
      verificationStatusNormalized === "verified" ||
      verificationStatusNormalized === "approved" ||
      verificationStatusNormalized === "approved_with_notes" ||
      verificationStatusNormalized === "completed"
    ) {
      const payloadHandle =
        data.creatorHandle ||
        data.creatorUsername ||
        data.creatorName ||
        data.creator_handle ||
        null;
      const creatorHandle =
        typeof payloadHandle === "string"
          ? payloadHandle.replace(/^@/, "").trim() || null
          : null;

      const updatePayload: Record<string, unknown> = {
        verification_method: data.verificationType,
        verified_at: data.verifiedAt || timestamp,
        status: "approved",
        performance_metrics: data.verificationResults?.metrics || null,
      };
      if (creatorHandle) updatePayload.creator_handle = creatorHandle;

      await supabase
        .from("activation_submissions")
        .update(updatePayload)
        .eq("id", resolvedSubmissionId);

      // Set payment_amount and release from locked budget (deduct, pay creator)
      const { data: submissionRow } = await supabase
        .from("activation_submissions")
        .select("id, activation_id, activations(base_rate, payment_per_action)")
        .eq("id", resolvedSubmissionId)
        .single();

      if (submissionRow?.activation_id) {
        const activation = submissionRow.activations as { base_rate?: number | null; payment_per_action?: number | null } | null;
        const paymentFromPayload =
          data.paymentAmount != null
            ? Number(data.paymentAmount) / 100
            : data.amount != null
              ? Number(data.amount)
              : null;
        const paymentAmount =
          paymentFromPayload ??
          (activation?.base_rate != null ? Number(activation.base_rate) : null) ??
          (activation?.payment_per_action != null ? Number(activation.payment_per_action) : 0);

        if (paymentAmount > 0) {
          await supabase
            .from("activation_submissions")
            .update({ payment_amount: paymentAmount })
            .eq("id", resolvedSubmissionId);

          const { error: releaseError } = await supabase.rpc("release_sm_panel_payment", {
            p_submission_id: resolvedSubmissionId,
            p_payment_amount: paymentAmount,
          });
          if (releaseError) {
            console.error(
              "dobbletap-webhook-verification-completed: release_sm_panel_payment error",
              releaseError,
            );
          } else {
            // Update activation progress: spent_amount
            const { data: act } = await supabase
              .from("activations")
              .select("spent_amount")
              .eq("id", submissionRow.activation_id)
              .single();
            if (act) {
              const newSpent = (Number(act.spent_amount) || 0) + paymentAmount;
              await supabase
                .from("activations")
                .update({
                  spent_amount: newSpent,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", submissionRow.activation_id);
            }
          }
        }
      }
    }

    console.log(
      "dobbletap-webhook-verification-completed: Successfully processed",
      {
        lookupId,
        resolvedSubmissionId,
        resolvedVia,
        verificationType: data.verificationType,
        status: verificationStatusRaw,
        normalizedStatus: verificationStatusNormalized,
      },
    );

    return new Response(
      JSON.stringify({
        id: verification.id,
        status: "recorded",
        event_id: webhookEvent?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("dobbletap-webhook-verification-completed error:", err);
    return new Response(
      JSON.stringify({
        error: (err as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
