// @ts-nocheck
// This file runs in Deno runtime (Supabase Edge Functions), not Node.js
// TypeScript errors here are false positives - the code works correctly at runtime
// @ts-ignore - Deno runtime provides these modules
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - ESM module
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Declare Deno global for TypeScript (provided by Deno runtime)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

const GRACE_PERIOD_DAYS = 3;

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

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify Paystack signature
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
    }

    // Compute expected signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(paystackSecretKey),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignature) {
      console.error("Invalid Paystack signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    console.log("Paystack webhook received:", event);

    // Use service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate event (idempotency) - only skip if we already processed this event
    const eventId =
      data.id?.toString() || `${event}_${data.reference}_${Date.now()}`;
    const { data: existingEvent } = await supabaseAdmin
      .from("billing_events")
      .select("id")
      .eq("paystack_event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log("Duplicate event, skipping:", eventId);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract workspace_id from metadata (Paystack returns key-value; may also use custom_fields array)
    const meta = data.metadata ?? {};
    let rawWorkspaceId =
      meta.workspace_id ??
      meta.workspace_Id ??
      (Array.isArray(meta.custom_fields)
        ? meta.custom_fields.find(
            (f: { variable_name?: string }) =>
              f?.variable_name === "workspace_id" ||
              f?.variable_name === "Workspace Id"
          )?.value
        : undefined);
    const workspaceId =
      rawWorkspaceId != null ? String(rawWorkspaceId).trim() || null : null;
    const reference = data.reference;

    const now = new Date();

    // Process first; only log to billing_events after success so Paystack retries can credit the wallet if processing failed

    // Handle different event types
    switch (event) {
      case "charge.success": {
        if (!workspaceId) {
          console.error(
            "No workspace_id in metadata for charge.success. metadata:",
            JSON.stringify(data.metadata)
          );
          break;
        }

        const rawPurpose =
          meta.purpose ??
          (Array.isArray(meta.custom_fields)
            ? meta.custom_fields.find(
                (f: { variable_name?: string }) =>
                  f?.variable_name === "purpose" || f?.variable_name === "Purpose"
              )?.value
            : undefined);
        const purpose =
          rawPurpose != null ? String(rawPurpose).trim() || null : null;

        if (purpose === "wallet_fund") {
          const amountKobo = data.amount;
          const amountNgn = amountKobo / 100;

          const { data: existingTxs } = await supabaseAdmin
            .from("wallet_transactions")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("type", "fund")
            .eq("reference_type", "payment_provider")
            .contains("metadata", { paystack_reference: reference })
            .limit(1);
          const existingTx = existingTxs?.[0];

          if (existingTx) {
            console.log(
              "Wallet fund already processed for reference:",
              reference
            );
            break;
          }

          let { data: wallet, error: walletError } = await supabaseAdmin
            .from("workspace_wallets")
            .select("*")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

          if (walletError) {
            console.error("Failed to fetch wallet:", walletError);
            throw walletError;
          }

          if (!wallet) {
            const { data: newWallet, error: insertErr } = await supabaseAdmin
              .from("workspace_wallets")
              .insert({
                workspace_id: workspaceId,
                balance: 0,
                locked_balance: 0,
                pending_balance: 0,
                lifetime_spent: 0,
                currency: "NGN",
              })
              .select()
              .single();
            if (insertErr || !newWallet) {
              console.error("Failed to create wallet:", insertErr);
              throw insertErr || new Error("Failed to create wallet");
            }
            wallet = newWallet;
          }

          const currentBalance = Number(wallet.balance) || 0;
          const newBalance = currentBalance + amountNgn;
          const lockedAfter = Number(wallet.locked_balance) || 0;

          try {
            const { error: updateWalletError } = await supabaseAdmin
              .from("workspace_wallets")
              .update({
                balance: newBalance,
                updated_at: now.toISOString(),
              })
              .eq("id", wallet.id);

            if (updateWalletError) {
              console.error("Failed to update wallet:", updateWalletError);
              throw updateWalletError;
            }

            await supabaseAdmin.from("wallet_transactions").insert({
              workspace_id: workspaceId,
              type: "fund",
              amount: amountNgn,
              balance_after: newBalance,
              locked_balance_after: lockedAfter,
              reference_type: "payment_provider",
              reference_id: null,
              description: "Wallet funding via Paystack",
              status: "completed",
              processed_at: now.toISOString(),
              metadata: {
                paystack_reference: reference,
                amount_kobo: amountKobo,
              },
            });

            // Store event in billing_events for audit trail
            await supabaseAdmin.from("billing_events").insert({
              workspace_id: workspaceId,
              event_source: "paystack",
              event_type: "charge.success",
              paystack_event_id: eventId,
              reference: reference,
              payload: {
                purpose: "wallet_fund",
                amount_kobo: amountKobo,
                amount_ngn: amountNgn,
                workspace_id: workspaceId,
                reference: reference,
                customer_email: data.customer?.email,
                currency: data.currency || "NGN",
                data: data,
              },
              processed_at: now.toISOString(),
            }).catch((err) => {
              // Log but don't fail if billing_events insert fails
              console.error("Failed to insert billing event (non-critical):", err);
            });

            console.log(
              `Wallet funded for workspace ${workspaceId}, amount ₦${amountNgn}`
            );
          } catch (err) {
            await supabaseAdmin.from("wallet_transactions").insert({
              workspace_id: workspaceId,
              type: "fund",
              amount: amountNgn,
              balance_after: currentBalance,
              locked_balance_after: lockedAfter,
              reference_type: "payment_provider",
              reference_id: null,
              description: "Wallet fund failed (Paystack)",
              status: "failed",
              metadata: {
                paystack_reference: reference,
                error: (err as Error).message,
              },
            });
            throw err;
          }
          break;
        }

        const planSlug = data.metadata?.plan_slug || "pro";
        const amount = data.amount; // In kobo/cents
        const customerCode = data.customer?.customer_code;
        const authorizationCode = data.authorization?.authorization_code;

        // Calculate billing period (1 month from now)
        const periodStart = now;
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Update subscription
        const { error: updateError } = await supabaseAdmin
          .from("workspace_subscriptions")
          .upsert(
            {
              workspace_id: workspaceId,
              plan_slug: planSlug,
              status: "active",
              current_period_start_at: periodStart.toISOString(),
              current_period_end_at: periodEnd.toISOString(),
              paystack_customer_code: customerCode,
              paystack_authorization_code: authorizationCode,
              last_payment_reference: reference,
              last_payment_at: now.toISOString(),
              last_payment_amount: amount,
              // Clear any past_due state
              past_due_since: null,
              grace_ends_at: null,
              cancel_at_period_end: false,
              canceled_at: null,
            },
            {
              onConflict: "workspace_id",
            }
          );

        if (updateError) {
          console.error("Failed to update subscription:", updateError);
          throw updateError;
        }

        console.log(`Subscription activated for workspace ${workspaceId}`);
        break;
      }

      case "charge.failed":
      case "invoice.payment_failed": {
        if (!workspaceId) {
          console.error("No workspace_id in metadata for charge.failed");
          break;
        }

        const graceEnd = new Date(
          now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
        );

        // Set subscription to past_due with grace period
        const { error: updateError } = await supabaseAdmin
          .from("workspace_subscriptions")
          .update({
            status: "past_due",
            past_due_since: now.toISOString(),
            grace_ends_at: graceEnd.toISOString(),
          })
          .eq("workspace_id", workspaceId);

        if (updateError) {
          console.error(
            "Failed to update subscription to past_due:",
            updateError
          );
        }

        console.log(
          `Subscription set to past_due for workspace ${workspaceId}`
        );
        break;
      }

      case "subscription.create": {
        if (!workspaceId) break;

        const subscriptionCode = data.subscription_code;
        const planCode = data.plan?.plan_code;

        await supabaseAdmin
          .from("workspace_subscriptions")
          .update({
            paystack_subscription_code: subscriptionCode,
            paystack_plan_code: planCode,
          })
          .eq("workspace_id", workspaceId);

        console.log(`Subscription code stored for workspace ${workspaceId}`);
        break;
      }

      case "subscription.disable":
      case "subscription.not_renew": {
        if (!workspaceId) break;

        // Subscription has been canceled or won't renew
        await supabaseAdmin
          .from("workspace_subscriptions")
          .update({
            status: "canceled",
            canceled_at: now.toISOString(),
          })
          .eq("workspace_id", workspaceId);

        console.log(`Subscription disabled for workspace ${workspaceId}`);
        break;
      }

      default:
        console.log("Unhandled event type:", event);
    }

    // Log event only after successful processing so Paystack retries can credit wallet if processing failed earlier
    const { data: billingEvent, error: eventError } = await supabaseAdmin
      .from("billing_events")
      .insert({
        workspace_id: workspaceId,
        event_source: "paystack",
        event_type: event,
        paystack_event_id: eventId,
        reference: reference,
        payload: payload,
        processed_at: now.toISOString(),
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to log billing event:", eventError);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("paystack-webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
