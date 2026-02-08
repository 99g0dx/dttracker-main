#!/bin/bash

# Manually sync an activation to Dobbletap
# Usage: ./sync-activation-to-dobbletap.sh [activation-id]

ACTIVATION_ID="${1:-be6502a1-9161-4eee-9f5c-9f422517df1e}"
DOBBLETAP_BASE="https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e"
SYNC_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c"

echo "🔄 Syncing Activation to Dobbletap"
echo "==================================="
echo "Activation ID: $ACTIVATION_ID"
echo ""

# Create sync payload (simplified version - customize as needed)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${DOBBLETAP_BASE}/webhooks/dttracker" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -d '{
    "eventType": "campaign_created",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "activation_id": "'"$ACTIVATION_ID"'",
      "dttracker_workspace_id": "test-workspace",
      "type": "contest",
      "title": "Test Campaign",
      "brief": "Test campaign for integration",
      "deadline": "2026-03-01T00:00:00Z",
      "total_budget": 100000,
      "prize_structure": {},
      "winner_count": 20,
      "max_posts_per_creator": 5,
      "platforms": ["tiktok"],
      "requirements": {},
      "instructions": "Test instructions"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📡 Response: HTTP $HTTP_CODE"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  CAMPAIGN_ID=$(echo "$BODY" | jq -r '.id // .campaign_id // empty' 2>/dev/null)
  echo "✅ Campaign synced successfully!"
  [ ! -z "$CAMPAIGN_ID" ] && echo "   Dobbletap Campaign ID: $CAMPAIGN_ID"
  echo ""
  echo "🎯 Next Step: Send an offer to a creator"
  echo "   The activation now exists in Dobbletap, so offers will work!"
else
  echo "❌ Sync failed: HTTP $HTTP_CODE"
  echo ""
  echo "Error: $(echo "$BODY" | jq -r '.error // .message // .' 2>/dev/null)"
fi
