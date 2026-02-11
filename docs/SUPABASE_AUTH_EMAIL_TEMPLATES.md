# Supabase Auth Email Templates

Use these custom HTML templates in **Supabase Dashboard → Authentication → Email Templates** to match the DTTracker brand design.

**Design spec:** Logo at `https://dttracker.app/logo.png`, brand color `#E8153A`, background `#0A0A0A`, card `#1A1A1A`, borders `rgba(255,255,255,0.08)`.

---

## Confirm sign up

**Subject line (optional):** `Verify your email address`

**HTML content:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0A0A0A;">
    <div style="padding: 32px 30px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
      <a href="https://dttracker.app" style="text-decoration: none; display: inline-block;">
        <img src="https://dttracker.app/logo.png" alt="DTTracker" width="140" height="40" border="0" style="display: block; margin: 0 auto; max-width: 140px; height: auto;">
      </a>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="color: #FFFFFF; margin: 0 0 8px 0; font-size: 24px; font-weight: 700; text-align: center;">Verify your email address</h1>
      <p style="color: #94A3B8; margin: 0; font-size: 15px; line-height: 1.6; text-align: center;">Click the button below to confirm your signup and start using DTTracker.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #E8153A; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Confirm email</a>
      </div>
      <p style="color: #64748B; font-size: 12px; margin-top: 16px; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div style="padding: 24px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08);">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748B;">© 2025 DTTracker</p>
      <a href="https://dttracker.app" style="font-size: 12px; color: #64748B; text-decoration: none;">dttracker.app</a>
    </div>
  </div>
</body>
</html>
```

---

## Reset password

**Subject line (optional):** `Reset your password`

**HTML content:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0A0A0A;">
    <div style="padding: 32px 30px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
      <a href="https://dttracker.app" style="text-decoration: none; display: inline-block;">
        <img src="https://dttracker.app/logo.png" alt="DTTracker" width="140" height="40" border="0" style="display: block; margin: 0 auto; max-width: 140px; height: auto;">
      </a>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="color: #FFFFFF; margin: 0 0 8px 0; font-size: 24px; font-weight: 700; text-align: center;">Reset your password</h1>
      <p style="color: #94A3B8; margin: 0; font-size: 15px; line-height: 1.6; text-align: center;">Click the button below to choose a new password for your DTTracker account.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #E8153A; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset password</a>
      </div>
      <p style="color: #64748B; font-size: 12px; margin-top: 16px; text-align: center;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div style="padding: 24px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08);">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748B;">© 2025 DTTracker</p>
      <a href="https://dttracker.app" style="font-size: 12px; color: #64748B; text-decoration: none;">dttracker.app</a>
    </div>
  </div>
</body>
</html>
```

---

## How to apply

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **Email Templates**
3. Select **Confirm signup** or **Reset password**
4. Paste the HTML into the template body
5. Save changes

**Note:** Ensure `https://dttracker.app/logo.png` is deployed and accessible. The logo is copied from `public/logo.png` when the app is built.

---

## Deploy send-email Edge Function

To deploy the send-email function (used for verification, welcome, trial, payment, campaign-update, creator-request, weekly-summary, security-alert):

```bash
# 1. Log in to Supabase (if not already)
supabase login

# 2. Link project (if not already)
supabase link --project-ref YOUR_PROJECT_REF

# 3. Deploy
supabase functions deploy send-email
```

Ensure `RESEND_API_KEY` is set as a secret:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key --project-ref YOUR_PROJECT_REF
```
