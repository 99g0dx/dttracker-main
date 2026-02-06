# Deploy Wallet Functions (Fix "Bundle generation timed out")

If you see `unexpected deploy status 400: {"message":"Bundle generation timed out"}`, try these steps.

## Script (recommended)

Deploy one function at a time with a 60s pause between them:

```bash
./scripts/deploy-wallet-functions.sh
```

If it still times out, use Management API bundling:

```bash
./scripts/deploy-wallet-functions.sh --use-api
```

With project ref: `./scripts/deploy-wallet-functions.sh --use-api --project-ref YOUR_PROJECT_REF`

## 1. Deploy one function at a time (manual)

Do **not** run both in one go. Deploy separately with a short pause between:

```bash
supabase functions deploy wallet-fund-initialize --no-verify-jwt
# Wait 1–2 minutes, then:
supabase functions deploy paystack-webhook --no-verify-jwt
```

## 2. Use Management API for bundling

If the default bundler times out, use the Management API:

```bash
supabase functions deploy wallet-fund-initialize --no-verify-jwt --use-api
# Wait, then:
supabase functions deploy paystack-webhook --no-verify-jwt --use-api
```

## 3. If linked to a project, pass project ref

```bash
supabase functions deploy wallet-fund-initialize --no-verify-jwt --project-ref YOUR_PROJECT_REF
supabase functions deploy paystack-webhook --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your Supabase project ref (e.g. from the dashboard URL).

## 4. Debug to see where it fails

```bash
supabase functions deploy wallet-fund-initialize --no-verify-jwt --debug
```

Check the output for the step that times out (e.g. upload, bundle, network).

## 5. Docker (optional)

The message "Docker is not running" is a warning. Supabase can bundle remotely without Docker. If you want to try local bundling:

1. Start Docker Desktop.
2. Deploy with: `supabase functions deploy wallet-fund-initialize --no-verify-jwt --use-docker`

## 6. Retry later

Bundle generation runs on Supabase’s side. If their bundler is slow or overloaded, retry after 10–30 minutes.

## Quick reference

| Goal                         | Command |
|-----------------------------|--------|
| Deploy wallet init          | `supabase functions deploy wallet-fund-initialize --no-verify-jwt` |
| Deploy paystack webhook     | `supabase functions deploy paystack-webhook --no-verify-jwt` |
| Use API bundling            | Add `--use-api` |
| With project ref            | Add `--project-ref YOUR_PROJECT_REF` |
| See detailed errors         | Add `--debug` |
