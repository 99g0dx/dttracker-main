import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { triggerAutoScrape } from "../_shared/auto-scrape.ts";
import { resolveCreator } from "../_shared/resolve-creator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      activation_id,
      creator_id,
      creator_handle,
      creator_platform,
      content_url,
      proof_url,
      proof_comment_text,
      submitted_at,
      payment_amount: payload_payment_amount,
      tier,
      creator_followers,
      verification_method,
    } = body;

    if (!activation_id) {
      return new Response(JSON.stringify({ error: "activation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select(
        "id, type, auto_approve, payment_per_action, base_rate, max_posts_per_creator",
      )
      .eq("id", activation_id)
      .single();

    if (actError || !activation) {
      return new Response(JSON.stringify({ error: "Activation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (activation.type === "contest") {
      const maxPosts = activation.max_posts_per_creator ?? 5;

      let existingQuery = supabase
        .from("activation_submissions")
        .select("id")
        .eq("activation_id", activation_id);

      if (creator_id) {
        existingQuery = existingQuery.eq("creator_id", creator_id);
      } else if (creator_handle && creator_platform) {
        existingQuery = existingQuery
          .eq("creator_handle", creator_handle)
          .eq("creator_platform", creator_platform);
      } else {
        return new Response(
          JSON.stringify({
            error:
              "creator_id or (creator_handle + creator_platform) required for contest submissions",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: existingSubs, error: countError } = await existingQuery;

      if (countError) {
        return new Response(JSON.stringify({ error: countError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ((existingSubs?.length ?? 0) >= maxPosts) {
        return new Response(
          JSON.stringify({
            error: `Maximum ${maxPosts} posts per creator`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Resolve creator identity if handle is missing but we have an ID
    let resolvedCreatorId = creator_id ?? null;
    let resolvedHandle = creator_handle ?? null;
    let resolvedPlatform = creator_platform ?? null;

    if (creator_id && !creator_handle) {
      const resolved = await resolveCreator(
        supabase,
        creator_id,
        null,
        creator_platform,
      );
      if (resolved) {
        resolvedCreatorId = resolved.creator_id;
        resolvedHandle = resolved.creator_handle;
        resolvedPlatform =
          resolved.creator_platform ?? creator_platform ?? null;
      }
    }

    const { data: submission, error: insertError } = await supabase
      .from("activation_submissions")
      .insert({
        activation_id,
        creator_id: resolvedCreatorId,
        creator_handle: resolvedHandle,
        creator_platform: resolvedPlatform,
        content_url: content_url ?? null,
        proof_url: proof_url ?? null,
        proof_comment_text: proof_comment_text ?? null,
        tier: tier ?? null,
        creator_followers: creator_followers ?? null,
        verification_method: verification_method ?? null,
        submitted_at: submitted_at ?? new Date().toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smPanelPayment =
      payload_payment_amount != null
        ? Number(payload_payment_amount)
        : activation.payment_per_action != null
          ? Number(activation.payment_per_action)
          : activation.base_rate != null
            ? Number(activation.base_rate)
            : null;

    if (
      activation.type === "sm_panel" &&
      smPanelPayment != null &&
      smPanelPayment > 0
    ) {
      const { error: joinError } = await supabase.rpc("join_sm_panel_atomic", {
        p_submission_id: submission.id,
        p_payment_amount: smPanelPayment,
      });
      if (joinError) {
        console.error("join_sm_panel_atomic error:", joinError);
      }
    }

    if (
      activation.type === "sm_panel" &&
      activation.auto_approve &&
      smPanelPayment != null &&
      smPanelPayment > 0
    ) {
      await supabase
        .from("activation_submissions")
        .update({
          status: "approved",
          payment_amount: smPanelPayment,
        })
        .eq("id", submission.id);

      const { error: releaseError } = await supabase.rpc(
        "release_sm_panel_payment",
        {
          p_submission_id: submission.id,
          p_payment_amount: smPanelPayment,
        },
      );
      if (releaseError) {
        console.error("release_sm_panel_payment error:", releaseError);
      }
    }

    // Auto-scrape if the submission has a content URL
    if (submission.content_url) {
      triggerAutoScrape(
        supabaseUrl,
        supabaseServiceKey,
        submission.id,
        "activation-submission-webhook",
      );
    }

    return new Response(JSON.stringify({ success: true, submission }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("activation-submission-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
