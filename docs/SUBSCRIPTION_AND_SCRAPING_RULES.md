# Subscription and Scraping Rules

Rules to prevent recurring issues with admin subscriptions, scraping permissions, and enforcement. Follow these when adding or changing code that touches subscriptions or scraping.

---

## Rules

### Admin subscription changes

All changes to a user's plan (especially to agency) must go through the RPC `company_admin_set_user_subscription`. Do not update `subscriptions`, `profiles.agency_role`, or `workspace_subscriptions` directly from other code paths.

### Scraping permission

Any code path that triggers scraping (Edge Functions, future crons, etc.) must call `can_trigger_scrape` with `request_user_id` set to the requesting user's id when the request is on behalf of a user. Otherwise agency bypass will not run (service role has no `auth.uid()`).

### workspace_subscriptions.plan_slug

This column is a foreign key to `billing_plans(slug)`. Only values `starter`, `pro`, `agency` are valid. Do not write `plan_catalog` slugs (e.g. `agency_monthly`, `agency_yearly`) here. Map tier to billing slug (e.g. in `company_admin_set_user_subscription`) when writing.

### RPC variable naming

In PL/pgSQL functions that update tables, use a distinct prefix for local variables (e.g. `v_`) so names do not match table columns and cause "ambiguous column reference" errors.

### External scraper responses

For any scraper that consumes an external API (e.g. Apify), detect error response shapes first (e.g. `item.error` or empty metrics with error-like keys) and return a clear error; do not assume every item has metrics.

---

## Checklists

### When adding or editing migrations that touch subscriptions/scraping

1. If writing to `workspace_subscriptions.plan_slug`, use only `billing_plans` slugs (`starter`, `pro`, `agency`).
2. If changing `can_trigger_scrape`, preserve the agency bypass and the `request_user_id` parameter.

### When adding a new scraper entry point

1. Call `can_trigger_scrape` with `request_user_id`.
2. For external APIs, check for error response shape before parsing metrics.
