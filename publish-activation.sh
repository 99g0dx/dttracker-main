#!/bin/bash

# Publish activation (triggers sync to Dobbletap)
# Usage: ./publish-activation.sh <activation-id> <your-jwt-token>

ACTIVATION_ID="${1:-be6502a1-9161-4eee-9f5c-9f422517df1e}"
JWT_TOKEN="$2"

if [ -z "$JWT_TOKEN" ]; then
  echo "❌ Error: JWT token required"
  echo ""
  echo "Usage: ./publish-activation.sh <activation-id> <jwt-token>"
  echo ""
  echo "To get your JWT token:"
  echo "1. Open browser DevTools (F12)"
  echo "2. Go to Application → Local Storage → http://localhost:5173"
  echo "3. Copy the value of 'sb-ucbueapoexnxhttynfzy-auth-token'"
  echo "4. Look for 'access_token' in the JSON"
  exit 1
fi

echo "📤 Publishing Activation to Dobbletap"
echo "====================================="
echo "Activation ID: $ACTIVATION_ID"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/activation-publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYnVlYXBvZXhueGh0dHluZnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDM2OTIsImV4cCI6MjA4MjQxOTY5Mn0.VR2M6BJmhuQt7fATB7BbSphyie21WnyREqgBkOwP_wM" \
  -d '{
    "activationId": "'"$ACTIVATION_ID"'"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📡 Response: HTTP $HTTP_CODE"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Activation published and synced to Dobbletap!"
  echo ""
  echo "🎯 Next: Send an offer to @wickhed7"
  echo "   The campaign is now in Dobbletap, so invitations will work!"
else
  echo "❌ Failed: HTTP $HTTP_CODE"
fi
