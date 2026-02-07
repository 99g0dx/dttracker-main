#!/bin/bash

# Test script for creating a public activation in Dobbletap
# This simulates what happens when DTTracker creates a live/public activation

AUTH_TOKEN="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"
BASE_URL="https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker"

# Generate unique ID for this test
TEST_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "=========================================="
echo "Public Activation Sync Test"
echo "=========================================="
echo ""
echo "Test Activation ID: $TEST_ID"
echo "Timestamp: $TS"
echo ""
echo "Creating public contest activation..."
echo ""

# Send webhook to create activation
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/activation_response.json -X POST "$BASE_URL" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"activation_created\",
    \"timestamp\": \"$TS\",
    \"data\": {
      \"id\": \"$TEST_ID\",
      \"title\": \"Test Public Contest - ${TS}\",
      \"brand\": \"Test Brand\",
      \"campaignType\": \"contest\",
      \"brief\": \"Create engaging content to win prizes!\",
      \"budget\": 500000,
      \"platforms\": [\"tiktok\", \"instagram\"],
      \"requirements\": [
        \"Minimum 1000 followers\",
        \"Original content only\",
        \"Include hashtag #TestContest\"
      ],
      \"prizeStructure\": {
        \"first\": 300000,
        \"second\": 150000,
        \"third\": 50000
      },
      \"winnerCount\": 3,
      \"judgingCriteria\": \"performance\",
      \"createdAt\": \"$TS\"
    }
  }")

# Read response body
BODY=$(cat /tmp/activation_response.json)

echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""
echo "HTTP Status: $HTTP_CODE"
echo ""

# Check if successful
if [ "$HTTP_CODE" = "200" ]; then
  CAMPAIGN_ID=$(echo "$BODY" | jq -r '.campaignId' 2>/dev/null)

  echo "=========================================="
  echo "✅ SUCCESS!"
  echo "=========================================="
  echo ""
  echo "DTTracker Activation ID: $TEST_ID"
  echo "Dobbletap Campaign ID: $CAMPAIGN_ID"
  echo ""
  echo "The activation is now visible in Dobbletap!"
  echo ""
  echo "Verify in database:"
  echo "SELECT id, title, source, source_campaign_id"
  echo "FROM campaigns"
  echo "WHERE id = '$CAMPAIGN_ID';"
  echo ""
else
  echo "=========================================="
  echo "❌ FAILED"
  echo "=========================================="
  echo ""
  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY"
  echo ""
fi
