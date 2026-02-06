#!/bin/bash
# Deploy wallet Edge Functions one at a time to avoid "Bundle generation timed out".
# Use --use-api if the default bundler times out.
# Usage: ./scripts/deploy-wallet-functions.sh [--use-api] [--project-ref REF]

set -e
USE_API=""
PROJECT_REF=""

for arg in "$@"; do
  case $arg in
    --use-api) USE_API="--use-api" ;;
    --project-ref=*) PROJECT_REF="${arg#*=}" ;;
    --project-ref) shift; PROJECT_REF="$1" ;;
  esac
done

EXTRA=""
[ -n "$PROJECT_REF" ] && EXTRA="--project-ref $PROJECT_REF"

echo "Deploying wallet-fund-initialize..."
supabase functions deploy wallet-fund-initialize --no-verify-jwt $USE_API $EXTRA
echo "Done. Waiting 60s before next deploy..."
sleep 60

echo "Deploying paystack-webhook..."
supabase functions deploy paystack-webhook --no-verify-jwt $USE_API $EXTRA
echo "Done."
