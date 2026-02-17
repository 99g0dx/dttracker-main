# Dobbletap: Replicate Resend + Supabase Auth Hook (full pack)

This document gives the Dobbletap team everything needed to send **all Supabase Auth emails** (reset password, signup verification, magic link, email change) through **Resend** with a single branded template, using the same pattern as DTTracker.

---

## What you get

- Auth emails (reset password, verify email, magic link, email change) sent via **Resend** instead of Supabase’s default SMTP/templates.
- One **shared email template** (logo, dark theme, branded button) used for all auth emails.
- **Send Email hook** in Supabase: when a user triggers an auth email, Supabase calls your Edge Function; your function builds HTML and sends via Resend.

---

## Prerequisites

- **Resend account** and API key (`re_...`).
- **Sending domain** verified in Resend (e.g. `dobbletap.com` → use `Dobbletap <no-reply@dobbletap.com>` or similar).
- **Supabase project** for Dobbletap (with Edge Functions enabled).
- **Supabase CLI** linked to that project (`supabase link`).

---

## 1. Create the shared email template

Create this file in your Supabase functions repo:

**Path:** `supabase/functions/_shared/email-template.ts`

Replace the placeholders:

- `DOBBLETAP_LOGO_URL` → your logo URL (e.g. `https://dobbletap.com/logo.png`). Must be a **public absolute URL**; avoid `/static/...` or data URIs.
- `DOBBLETAP_DOMAIN` → your app domain (e.g. `https://dobbletap.com`).
- `DOBBLETAP_NAME` → product name in alt text and footer (e.g. `Dobbletap`).
- `DOBBLETAP_BRAND_COLOR` → primary button/link color (e.g. `#E8153A` or your brand hex).

```ts
// Single source of truth for Dobbletap transactional emails (Edge Functions).
// Use LOGO_URL only; avoid relative paths or data URIs (many email clients block them).

export const LOGO_URL = 'DOBBLETAP_LOGO_URL';
const BRAND_COLOR = 'DOBBLETAP_BRAND_COLOR';
const BG_COLOR = '#0A0A0A';
const CARD_COLOR = '#111111';
const INFO_BOX_COLOR = '#1A1A1A';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';
const TEXT_MUTED = '#64748B';
const BORDER_COLOR = 'rgba(255,255,255,0.08)';
const SITE_URL = 'DOBBLETAP_DOMAIN';
const PRODUCT_NAME = 'DOBBLETAP_NAME';

export const emailStyles = {
  BRAND_COLOR,
  BG_COLOR,
  CARD_COLOR,
  INFO_BOX_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER_COLOR,
};

export function emailHeader(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BG_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: ${BG_COLOR};">
      <div style="padding: 32px 30px 24px; text-align: center; border-bottom: 1px solid ${BORDER_COLOR};">
        <a href="${SITE_URL}" style="text-decoration: none; display: inline-block;">
          <img src="${LOGO_URL}" alt="${PRODUCT_NAME}" width="140" height="40" border="0" style="display: block; margin: 0 auto; max-width: 140px; height: auto;" />
        </a>
      </div>
      <div style="padding: 40px 30px;">`;
}

export function emailFooter(): string {
  return `      </div>
      <div style="padding: 24px 30px; text-align: center; border-top: 1px solid ${BORDER_COLOR};">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: ${TEXT_MUTED};">&copy; ${new Date().getFullYear()} ${PRODUCT_NAME}</p>
        <a href="${SITE_URL}" style="font-size: 12px; color: ${TEXT_MUTED}; text-decoration: none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </body>
</html>`;
}

export function emailButton(text: string, url: string): string {
  return `<div style="text-align: center; margin: 32px 0;">
  <a href="${url}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">${text}</a>
</div>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="color: ${TEXT_PRIMARY}; margin: 0 0 8px 0; font-size: 24px; font-weight: 700; text-align: center;">${text}</h1>`;
}

export function emailSubtext(text: string): string {
  return `<p style="color: ${TEXT_SECONDARY}; margin: 0; font-size: 15px; line-height: 1.6; text-align: center;">${text}</p>`;
}

export function emailLinkText(text: string, url: string): string {
  return `<p style="color: ${TEXT_MUTED}; font-size: 13px; margin-top: 16px; text-align: center; word-break: break-all;">
  ${text}: <a href="${url}" style="color: ${BRAND_COLOR}; text-decoration: none;">${url}</a>
</p>`;
}
```

---

## 2. Create the Auth Send Email Edge Function

**Path:** `supabase/functions/auth-send-email/index.ts`

This is the **Send Email hook** Supabase Auth will call. It verifies the request (Standard Webhooks or Bearer secret), builds the email with your template, and sends via Resend.

```ts
/**
 * Supabase Auth "Send Email" hook.
 * Sends reset password, confirm signup, magic link, email change via Resend using Dobbletap template.
 *
 * Configure: Supabase Dashboard → Authentication → Hooks → Send Email hook.
 * Deploy: supabase functions deploy auth-send-email --no-verify-jwt
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
  emailLinkText,
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

  // 1) Standard Webhooks verification (Supabase may send webhook-id, webhook-timestamp, webhook-signature)
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
    // 2) Fallback: Bearer token (some setups send Authorization: Bearer <secret>)
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
      bodyText = "We received a request to reset the password for your account. Click the button below to choose a new password.";
      buttonText = "Reset password";
      break;
    case "signup":
      subject = "Verify your email address";
      heading = "Verify your email address";
      bodyText = "Click the button below to confirm your signup and start using Dobbletap.";
      buttonText = "Confirm email";
      break;
    case "magiclink":
      subject = "Your login link";
      heading = "Log in to Dobbletap";
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
        ${emailLinkText("Or copy this link", verifyUrl)}
        <p style="color: ${emailStyles.TEXT_MUTED}; font-size: 13px; text-align: center; margin-top: 24px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
${emailFooter()}`;

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Dobbletap <no-reply@dobbletap.com>";
  const { data, error } = await resend.emails.send({
    from: fromEmail,
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
```

(Replace "Dobbletap" in the copy strings and default `fromEmail` if your product name or sender differs.)

---

## 3. Function config

**Path:** `supabase/functions/auth-send-email/config.toml`

```toml
# Auth hook: Supabase calls this without a user JWT
verify_jwt = false
```

---

## 4. Deploy the function

From your project root (where `supabase/` lives):

```bash
supabase functions deploy auth-send-email --no-verify-jwt
```

Note the function URL, e.g.:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email`

---

## 5. Generate the hook secret and set Supabase secrets

**5.1 Generate the secret in the Dashboard**

1. Open **Supabase Dashboard** → your project.
2. Go to **Authentication** → **Hooks**  
   Direct: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/hooks`
3. Find **Send Email** and add an HTTP hook (or edit existing).
4. Set **URL** to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email`
5. Click **Generate secret** and copy the full value (e.g. `v1,whsec_...`). Do not close the page before saving the secret in the next step.

**5.2 Set secrets via CLI**

```bash
# Required: Resend API key from https://resend.com/api-keys
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx

# Required: exact value from Dashboard → Hooks → Send Email → Generate secret
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxxxxxxxxxx"

# Optional: override sender (must be a verified domain in Resend)
supabase secrets set RESEND_FROM_EMAIL="Dobbletap <no-reply@dobbletap.com>"
```

Important:

- `SEND_EMAIL_HOOK_SECRET` must match the Dashboard value **exactly** (including `v1,` if present).
- If the secret contains `+`, keep it in double quotes so the shell does not change it.
- `SUPABASE_URL` is set automatically for Edge Functions; no need to set it yourself.

**5.3 Save the hook**

Back in **Authentication** → **Hooks** → **Send Email**, click **Save** (or **Create**). The hook is active only after saving.

---

## 6. Ensure Email provider is enabled

- Go to **Authentication** → **Providers**: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/providers  
- Open **Email** and ensure the Email provider is **enabled**.  
The Send Email hook runs only when Email auth is on.

---

## 7. Verify

1. On your app’s sign-in page, use **Forgot password** and submit an email address.
2. You should receive **one** email: your Dobbletap-branded reset email (logo, dark theme, button) from Resend.
3. Check **Edge Functions** → **auth-send-email** → **Invocations** in the Dashboard; there should be a new invocation.

If the app says “Link sent” but no email arrives and there are no invocations, the hook is not being called — re-check URL, secret, and that the hook is saved and Email provider is enabled.

---

## 8. Troubleshooting

| Issue | What to check |
|-------|----------------|
| **401 Unauthorized** | Secret in Dashboard must exactly match `SEND_EMAIL_HOOK_SECRET`. Regenerate in Dashboard, copy once, set with `supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."`, redeploy the function. |
| **“Link sent” but no email / no invocation** | Email provider ON; Send Email hook enabled and type = HTTP; URL correct; hook **Saved**. |
| **Logo not showing** | Use a single public absolute URL (e.g. `https://dobbletap.com/logo.png`). No relative paths, no `data:https://...`. |
| **Resend errors in logs** | Verify domain in Resend; use that domain in `RESEND_FROM_EMAIL`. |

---

## 9. Summary checklist

- [ ] `_shared/email-template.ts` created and placeholders replaced (logo URL, domain, product name, brand color).
- [ ] `auth-send-email/index.ts` and `auth-send-email/config.toml` created.
- [ ] `supabase functions deploy auth-send-email --no-verify-jwt` run.
- [ ] Hook secret generated in Dashboard (Authentication → Hooks → Send Email).
- [ ] `RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET` set via `supabase secrets set`; optionally `RESEND_FROM_EMAIL`.
- [ ] Send Email hook URL set and **Saved** in Dashboard.
- [ ] Email provider **enabled** under Authentication → Providers.
- [ ] Test: Forgot password → one branded email from Resend and one function invocation.

After this, all Supabase Auth emails (recovery, signup, magic link, email change) go through Resend with your single template. For other transactional emails (e.g. creator request, quote, recall), use the same `_shared/email-template.ts` and Resend in your other Edge Functions so everything stays consistent.

---

## Quick reference: secrets and Dashboard links

| Secret / config | Example / note |
|-----------------|----------------|
| `RESEND_API_KEY` | `re_xxxx` from Resend dashboard |
| `SEND_EMAIL_HOOK_SECRET` | From Supabase Dashboard → Auth → Hooks → Send Email → **Generate secret** (copy exactly, e.g. `v1,whsec_...`) |
| `RESEND_FROM_EMAIL` | Optional, e.g. `Dobbletap <no-reply@dobbletap.com>` (domain must be verified in Resend) |

**Dashboard links (replace `YOUR_PROJECT_REF` with your Supabase project reference):**

- **Hooks (create Send Email hook, generate secret):**  
  `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/hooks`
- **Providers (enable Email):**  
  `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/providers`
- **Edge Functions (check invocations):**  
  `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/functions/auth-send-email/invocations`

**Hook URL to paste in Dashboard:**  
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email`
