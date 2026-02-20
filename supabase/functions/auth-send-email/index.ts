/**
 * Supabase Auth "Send Email" hook.
 * Replaces Supabase's built-in auth emails so reset password, confirm signup, etc.
 * are sent via Resend using the DTTracker email template.
 *
 * Configure in: Supabase Dashboard → Authentication → Hooks → Send Email hook.
 * Deploy with: supabase functions deploy auth-send-email --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@2.0.0";
import {
  emailHeader,
  emailFooter,
  emailHeading,
  emailSubtext,
  emailButton,
  emailStyles,
} from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // Supabase Auth may call the hook with POST or PUT
  if (req.method !== "POST" && req.method !== "PUT") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  if (!resendApiKey) {
    console.error("auth-send-email: RESEND_API_KEY not set");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!hookSecretRaw) {
    console.error("auth-send-email: SEND_EMAIL_HOOK_SECRET not set");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const resend = new Resend(resendApiKey);
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let user: { email?: string };
  let email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };

  // 1) Try Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature)
  const hookSecretForStd = hookSecretRaw.replace(/^v1,/, "").trim();
  const wh = new Webhook(hookSecretForStd);
  try {
    const parsed = wh.verify(payload, headers) as {
      user: { email?: string };
      email_data: typeof email_data;
    };
    user = parsed.user;
    email_data = parsed.email_data;
  } catch (stdErr) {
    const stdMsg = stdErr instanceof Error ? stdErr.message : String(stdErr);
    console.error("auth-send-email: Webhook verification failed:", stdMsg);
    // 2) Fallback: Supabase may send Authorization: Bearer <secret> instead of Standard Webhooks headers
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerMatch ? bearerMatch[1].trim() : "";
    const bearerOk =
      bearerToken &&
      (bearerToken === hookSecretRaw || bearerToken === hookSecretRaw.replace(/^v1,/, "").trim());
    if (bearerOk) {
      try {
        const body = JSON.parse(payload);
        user = body.user;
        email_data = body.email_data;
        if (!user?.email || !email_data) throw new Error("Invalid payload shape");
      } catch (parseErr) {
        console.error("auth-send-email: Bearer ok but payload parse failed:", parseErr);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const to = user?.email;
  if (!to) {
    return new Response(
      JSON.stringify({ error: "Missing user email" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { token_hash, redirect_to, email_action_type } = email_data;
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(redirect_to)}`;

  let subject: string;
  let heading: string;
  let bodyText: string;
  let buttonText: string;

  switch (email_action_type) {
    case "recovery":
      subject = "Reset your password";
      heading = "Reset your password";
      bodyText =
        "We received a request to reset the password for your DTTracker account. Click the button below to choose a new password.";
      buttonText = "Reset password";
      break;
    case "signup":
      subject = "Verify your email address";
      heading = "Verify your email address";
      bodyText =
        "Click the button below to confirm your signup and start using DTTracker.";
      buttonText = "Confirm email";
      break;
    case "magiclink":
      subject = "Your login link";
      heading = "Log in to DTTracker";
      bodyText = "Click the button below to log in to your account.";
      buttonText = "Log in";
      break;
    case "email_change":
      subject = "Confirm your new email";
      heading = "Confirm your new email address";
      bodyText = "Click the button below to confirm your new email address.";
      buttonText = "Confirm email";
      break;
    default:
      subject = "Confirm your request";
      heading = "Confirm your request";
      bodyText = "Click the button below to continue.";
      buttonText = "Continue";
  }

  const html = `${emailHeader()}
        ${emailHeading(heading)}
        ${emailSubtext(bodyText)}
        ${emailButton(buttonText, verifyUrl)}
        <p style="color: ${emailStyles.TEXT_MUTED}; font-size: 13px; text-align: center; margin-top: 24px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
${emailFooter()}`;

  const { data, error } = await resend.emails.send({
    from: Deno.env.get("RESEND_FROM_EMAIL") ?? "DTTracker <no-reply@dttracker.app>",
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("auth-send-email: Resend error", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
