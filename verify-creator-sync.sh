#!/bin/bash

# Verify Creator Sync - Test with the exact payload Dobbletap sent

SYNC_API_KEY="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"
DTTRACKER_BASE="https://ucbueapoexnxhttynfzy.supabase.co/functions/v1"

echo "🧪 Testing Creator Sync with @wickhed7..."
echo ""

# Test the exact payload from Dobbletap
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${DTTRACKER_BASE}/creator-sync-from-dobbletap" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "creator_sync",
    "timestamp": "2026-02-08T00:10:47.762Z",
    "creators": [
      {
        "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
        "handle": "@wickhed7",
        "platform": "tiktok",
        "followerCount": 5,
        "email": "bukolafaduagba@gmail.com",
        "phone": "+2348100029055",
        "verificationStatus": "pending"
      }
    ]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📡 Response Status: $HTTP_CODE"
echo "📦 Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS - Creator sync endpoint is working!"

  # Parse the response
  SYNCED=$(echo "$BODY" | jq -r '.synced' 2>/dev/null)
  FAILED=$(echo "$BODY" | jq -r '.failed' 2>/dev/null)

  echo ""
  echo "📊 Sync Results:"
  echo "   Synced: $SYNCED creator(s)"
  echo "   Failed: $FAILED creator(s)"

  # Show creator details
  echo ""
  echo "👤 Creator Details:"
  echo "$BODY" | jq -r '.results[]' 2>/dev/null

  echo ""
  echo "🎉 INTEGRATION CONFIRMED: DTTracker ↔ Dobbletap creator sync is operational!"
else
  echo "❌ FAILED - HTTP $HTTP_CODE"
  echo ""
  echo "Error details:"
  echo "$BODY"
fi
