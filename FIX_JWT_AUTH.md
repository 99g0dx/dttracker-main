# Fix JWT Auth for scrape-post

## Summary
This project’s `scrape-post` Edge Function now verifies user JWTs using the anon key
(`SB_ANON_KEY`) and uses the service role key only for database writes. This is the
recommended Supabase pattern and prevents `401 Invalid JWT` errors caused by
verifying with the wrong key.

## Secrets required
- `SB_URL` (full Supabase URL, e.g. `https://<ref>.supabase.co`)
- `SB_ANON_KEY` (anon key for the same project)
- `SB_SERVICE_ROLE_KEY` (service role key for database updates)

## Deploy steps
1) Set secrets:
```
supabase secrets set \
  SB_URL="https://<ref>.supabase.co" \
  SB_ANON_KEY="<anon key>" \
  SB_SERVICE_ROLE_KEY="<service role key>"
```
2) Deploy the function:
```
supabase functions deploy scrape-post
```

## Local dev checklist
- Frontend env uses the same project:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- After changing frontend code, rebuild/redeploy the UI so requests include
  the `apikey` header.

## Troubleshooting
- `401 Invalid JWT`:
  - Ensure you are logged into the same Supabase project.
  - Confirm the request includes:
    - `Authorization: Bearer <jwt>`
    - `apikey: <anon key>`
  - Verify Edge Function “Verify JWT” is ON.
- `Missing Supabase credentials`:
  - Check `SB_URL`, `SB_ANON_KEY`, and `SB_SERVICE_ROLE_KEY` are set in secrets.
