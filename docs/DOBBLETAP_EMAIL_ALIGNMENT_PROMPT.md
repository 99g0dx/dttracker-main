# Prompt for Dobbletap team: align email setup with DTTracker

Copy the text below and send it to the Dobbletap team so they can apply the same email improvements on their side.

---

## Email alignment request (for Dobbletap team)

We’ve standardized how transactional emails work on DTTracker and would like Dobbletap to follow the same approach so branding and deliverability are consistent across both products (especially for creator request, quote, recall, and review flows).

Please apply the following on the Dobbletap side.

---

### 1. Single canonical logo URL

- **Use one logo URL** for all transactional emails (e.g. `https://dobbletap.com/logo.png` or your chosen path).
- **Requirements:**
  - Absolute, public URL (same origin as your app or a CDN).
  - No relative paths (e.g. `/static/logo.png` often 404 in email clients).
  - No invalid or non-standard data URIs (e.g. `data:https://...` is invalid; many clients block or strip it).
- **Action:** Pick one URL, document it as the only logo source for emails, and replace any other logo references (different paths, data URIs, or per-template URLs) with this single URL.

---

### 2. Single shared email template / layout

- **Use one template (or shared layout)** for all transactional emails: creator request notifications, quote received, request recalled, review feedback, auth (reset password, verification), etc.
- **Include:**
  - Header with the logo (using the canonical URL above).
  - Consistent typography, spacing, and container width (e.g. max-width 600px).
  - Footer with product name and year.
- **Action:** Centralise layout in one module or template; every email type should use it so look-and-feel is consistent and future changes (e.g. logo or colours) are done in one place.

---

### 3. Logo and styling checklist

- **Logo:** One URL only; ensure the image is deployed and reachable (no 404 in emails).
- **Avoid:**
  - `/static/logo-black.png` or other relative paths.
  - `data:https://...` or other invalid data URIs for the logo.
  - Different logo URLs in different emails (causes inconsistent branding and harder maintenance).
- **Optional:** If you document your brand colours and background (e.g. hex for primary, background, card, borders), we can keep DTTracker and Dobbletap emails visually aligned where we share flows (e.g. creator request, quote, recall).

---

### 4. Auth emails (if applicable)

- If Dobbletap sends its own auth emails (e.g. reset password, email verification):
  - Prefer sending them through the **same** provider and **same** template/layout as other transactional emails (e.g. Resend + your shared template).
  - Avoid default provider templates that don’t use your logo URL and shared layout; that way all user-facing emails look like one product.

---

### 5. Cross-product consistency (creator request / campaign flow)

- Emails that touch the **campaign creator request** flow (e.g. new request, quote received, request recalled, review feedback) may be sent by either side or both. Using a single logo URL and a single template on your side will help:
  - Logos and layout stay consistent when users receive both DTTracker and Dobbletap emails in the same thread or flow.
  - Fewer broken images and better deliverability.

---

**Summary:** One logo URL, one shared email template/layout, no relative or invalid logo sources. Same approach we use on DTTracker; applying it on Dobbletap will align both products and reduce email issues.

If you need the exact patterns we use on DTTracker (e.g. logo URL, header/footer structure, Resend usage), we can share a short spec or code snippets.
