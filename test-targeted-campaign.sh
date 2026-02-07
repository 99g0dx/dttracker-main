#!/bin/bash

# Complete E2E Test: Campaign Creation + Creator Offer
# Tests the full flow from DTTracker to Dobbletap

AUTH_TOKEN="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"
BASE_URL="https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker"

# Campaign details
CAMPAIGN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DEADLINE=$(date -u -v+14d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+14 days' +%Y-%m-%dT%H:%M:%SZ)

# Creator details
CREATOR_EMAIL="bukolafaduagba@example.com"
CREATOR_NAME="Bukola Aduagba"
CREATOR_ID="29f99241-53d1-4f78-b9b0-2169f4a15a49"

# Campaign info
CAMPAIGN_NAME="Spring Beauty Haul Challenge 2026"
BRAND_NAME="GlowUp Beauty"
OFFER_AMOUNT=75000

echo "=========================================="
echo "E2E Campaign Test: Targeted Campaign"
echo "=========================================="
echo ""
echo "Campaign: $CAMPAIGN_NAME"
echo "Brand: $BRAND_NAME"
echo "Target Creator: $CREATOR_NAME ($CREATOR_EMAIL)"
echo "Campaign ID: $CAMPAIGN_ID"
echo "Offer Amount: ₦$(printf "%'d" $OFFER_AMOUNT)"
echo "Deadline: $DEADLINE"
echo ""

# STEP 1: Create Campaign in Dobbletap
echo "=========================================="
echo "STEP 1: Creating Campaign"
echo "=========================================="
echo ""

HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/campaign_response.json -X POST "$BASE_URL" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"activation_created\",
    \"timestamp\": \"$TS\",
    \"data\": {
      \"id\": \"$CAMPAIGN_ID\",
      \"title\": \"$CAMPAIGN_NAME\",
      \"brand\": \"$BRAND_NAME\",
      \"campaignType\": \"contest\",
      \"brief\": \"Show us your favorite beauty products from our Spring 2026 collection! Create an engaging TikTok video featuring at least 3 products from our new GlowUp Spring line. Share your honest review, application tips, and why you love them. Most creative and engaging video wins!\",
      \"budget\": 500000,
      \"deadline\": \"$DEADLINE\",
      \"platforms\": [\"tiktok\"],
      \"requirements\": [
        \"Minimum 1,000 TikTok followers\",
        \"Feature at least 3 products from Spring 2026 collection\",
        \"Video must be 30-60 seconds\",
        \"Include hashtags: #GlowUpSpring #BeautyHaul #SpringBeauty2026\",
        \"Tag @GlowUpBeauty in video description\",
        \"Show before/after or application process\"
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

CAMPAIGN_RESPONSE=$(cat /tmp/campaign_response.json)
DOBBLETAP_CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | jq -r '.campaignId' 2>/dev/null)

echo "Response:"
echo "$CAMPAIGN_RESPONSE" | jq '.' 2>/dev/null || echo "$CAMPAIGN_RESPONSE"
echo ""
echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Campaign creation failed!"
  exit 1
fi

echo "✅ Campaign created successfully!"
echo "   Dobbletap Campaign ID: $DOBBLETAP_CAMPAIGN_ID"
echo ""

# Wait a moment for the campaign to be fully created
sleep 2

# STEP 2: Send Offer to Creator
echo "=========================================="
echo "STEP 2: Sending Offer to Creator"
echo "=========================================="
echo ""
echo "Sending offer to: $CREATOR_NAME"
echo "Offer amount: ₦$(printf "%'d" $OFFER_AMOUNT)"
echo ""

HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/offer_response.json -X POST "$BASE_URL" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"offer_sent\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"dttrackerCampaignId\": \"$CAMPAIGN_ID\",
      \"creatorEmail\": \"$CREATOR_EMAIL\",
      \"creatorName\": \"$CREATOR_NAME\",
      \"amount\": $OFFER_AMOUNT,
      \"message\": \"Hi Bukola! We love your content and think you'd be perfect for our Spring Beauty Haul Challenge. We're offering you ₦75,000 to participate. Create an engaging video featuring our new GlowUp Spring collection. Interested?\",
      \"activation_title\": \"$CAMPAIGN_NAME\"
    }
  }")

OFFER_RESPONSE=$(cat /tmp/offer_response.json)

echo "Response:"
echo "$OFFER_RESPONSE" | jq '.' 2>/dev/null || echo "$OFFER_RESPONSE"
echo ""
echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  CREATOR_CAMPAIGN_ID=$(echo "$OFFER_RESPONSE" | jq -r '.id' 2>/dev/null)
  echo "✅ Offer sent successfully!"
  echo "   Creator Campaign ID: $CREATOR_CAMPAIGN_ID"
else
  echo "⚠️  Offer sending encountered an issue"
  echo "   Note: Creator might need to exist in Dobbletap first"
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "📋 Campaign Details:"
echo "   Campaign Name: $CAMPAIGN_NAME"
echo "   Brand: $BRAND_NAME"
echo "   DTTracker ID: $CAMPAIGN_ID"
echo "   Dobbletap ID: $DOBBLETAP_CAMPAIGN_ID"
echo ""
echo "👤 Creator Details:"
echo "   Name: $CREATOR_NAME"
echo "   Email: $CREATOR_EMAIL"
echo "   Creator ID: $CREATOR_ID"
echo "   Offer Amount: ₦$(printf "%'d" $OFFER_AMOUNT)"
echo ""
echo "🔍 Verification Queries:"
echo ""
echo "-- Check campaign in Dobbletap"
echo "SELECT campaign_id, title, brand, source, source_campaign_id"
echo "FROM campaigns"
echo "WHERE campaign_id = '$DOBBLETAP_CAMPAIGN_ID';"
echo ""
echo "-- Check creator assignment"
echo "SELECT * FROM creator_campaigns"
echo "WHERE campaign_id = '$DOBBLETAP_CAMPAIGN_ID';"
echo ""
echo "=========================================="
echo "✅ Test Complete!"
echo "=========================================="
