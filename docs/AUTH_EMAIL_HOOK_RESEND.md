# Auth emails via Resend (Send Email hook)

Reset password, confirm signup, and other **Supabase Auth** emails are sent through **Resend** using the DTTracker template, instead of Supabase’s built-in SMTP/templates.

## How it works

1. User triggers an auth email (e.g. “Forgot password” on the sign-in page).
2. Supabase Auth calls the **Send Email** hook (this Edge Function) with the user and token/link data.
3. The function builds the branded HTML with the shared email template and sends it via Resend.
4. Supabase does **not** send its own email when the hook is enabled.

## 1. Deploy the function

```bash
supabase functions deploy auth-send-email --no-verify-jwt
```

Note the function URL (e.g. `https://<project-ref>.supabase.co/functions/v1/auth-send-email`).

## 2. Set secrets

```bash
# Required: Resend API key (you likely have this already)
# Required: Secret from Supabase Dashboard (generate in step 3 first)
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxx"
```

Optional sender override:

```bash
supabase secrets set RESEND_FROM_EMAIL="DTTracker <no-reply@dttracker.app>"
```

## 3. Configure the hook in Supabase Dashboard

**Where to find Hooks**

- In the **left sidebar**, click **Authentication** (person icon).
- In the **top tabs** (or sub-menu under Authentication), look for **Hooks**.  
  You may see: **Users** | **Policies** | **Providers** | **Email Templates** | **Hooks**.
- **Direct link** (replace `YOUR_PROJECT_REF` with your project reference):  
  **https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/hooks**

If you don’t see **Hooks** at all, your plan or region might use a different layout; try **Project Settings** → **Authentication** and look for “Hooks” or “Auth Hooks” there.

**Configure the Send Email hook**

1. On the Hooks page, find **Send Email** and click **Create** or **Enable** (or the **+** to add an HTTP hook).
2. **URL:** your function URL, e.g.  
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email`
3. Click **Generate secret** and copy the value (e.g. `v1,whsec_...`).
4. Set it as the Supabase secret:  
   `supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."`
5. Save the hook.

After this, **Email provider** can stay enabled; the hook will handle sending and Supabase will not use SMTP for auth emails.

## 4. Verify

- On the sign-in page, use “Forgot password” and submit an email.
- You should receive **one** email: the DTTracker-branded reset email (dark theme, logo, red button) from Resend.
- If you still get a different (e.g. Supabase default) email, the hook is not yet configured or not being called; re-check URL and secret.

---

## Troubleshooting: "Link sent" but no function invoked and no email

If the app shows **"Password reset link sent to your email"** but there is **no invocation** of `auth-send-email` in Edge Functions and **no email** in the inbox, Supabase Auth is not calling your hook. The success message is returned as soon as Auth accepts the request; the email is only sent when the hook runs.

**Checklist**

1. **Email provider must be ON**  
   Go to **Authentication** → **Providers**. In the list (Email, Google, GitHub, etc.), click **Email**. Ensure the Email provider is **enabled** (e.g. "Enable Email provider" or similar toggle). The Send Email hook only runs when email auth is enabled.  
   **Direct link:** `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/providers` (then click **Email** in the list).

2. **Hook enabled and type**  
   Go to **Authentication** → **Hooks** (`https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/hooks`). Find **Send Email**. It must be **enabled** (toggle ON / "Use this hook") and set to **HTTP** (not Postgres). If it says "Postgres function", switch to HTTP and set the URL.

3. **URL exactly right**  
   Use: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email` (replace `YOUR_PROJECT_REF` with your project ref from the dashboard URL). No trailing slash. Test:  
   `curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email`  
   You should get **401** (Unauthorized), not 404. If 404, the function is not deployed or the URL is wrong.

4. **Save the hook**  
   After setting the URL and secret, click **Save** / **Create**. Unsaved changes mean the hook is not active.

5. **Confirm invocations**  
   Trigger "Forgot password" again, then check **Edge Functions** → **auth-send-email** → **Invocations**. You should see a new invocation. If it stays 0, the hook is still not in use.

**Security:** Do not paste the hook secret in chat or commit it. If it was exposed, rotate it: Hooks → Send Email → **Generate secret**, then `supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_NEW_VALUE"`.

**401 "No matching signature found":** The secret in your Edge Function must **exactly** match the secret shown in Dashboard → Hooks → Send Email. Regenerate the secret in the Dashboard, copy it in one go (no leading/trailing spaces), set it with `supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."`, then redeploy the function. If the secret contains `+` (base64), keep it inside double quotes so the shell doesn’t change it.

## Supported email types

| `email_action_type` | Subject / content |
|---------------------|-------------------|
| `recovery`          | Reset your password |
| `signup`            | Verify your email address |
| `magiclink`         | Your login link |
| `email_change`      | Confirm your new email |

All use the same DTTracker template (`_shared/email-template.ts`) and logo `https://dttracker.app/logo.png`.
