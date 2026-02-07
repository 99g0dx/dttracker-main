#!/bin/bash

# Test DTTracker → Dobbletap outbound webhooks
# This tests sending campaign data FROM DTTracker TO Dobbletap

DOBBLETAP_URL="https://qetwrowpllnkucyxoojp.supabase.co/functions/v1"
SYNC_API_KEY="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"

echo "========================================"
echo "Testing DTTracker → Dobbletap Webhooks"
echo "========================================"
echo ""

# Test 1: Campaign Created
echo "1. Testing campaign_created webhook..."
curl -s -X POST \
  "${DOBBLETAP_URL}/api/webhooks/dttracker/campaign-created" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "campaign_created",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "id": "dttracker-campaign-'$(uuidgen)'",
      "workspaceId": "'$(uuidgen)'",
      "brand": "Test Brand",
      "title": "Test Campaign from DTTracker",
      "campaignType": "request",
      "brief": "Test campaign brief",
      "budget": 100000,
      "deadline": "'$(date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)'",
      "platforms": ["tiktok", "instagram"],
      "requirements": {
        "minFollowers": 1000,
        "engagementRate": 2.5
      },
      "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' || echo "FAILED or endpoint not found"
echo ""
echo ""

# Test 2: Campaign Updated
echo "2. Testing campaign_updated webhook..."
curl -s -X POST \
  "${DOBBLETAP_URL}/api/webhooks/dttracker/campaign-updated" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "campaign_updated",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "id": "dttracker-campaign-123",
      "changes": {
        "budget": 150000,
        "deadline": "'$(date -u -d '+10 days' +%Y-%m-%dT%H:%M:%SZ)'"
      },
      "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' || echo "FAILED or endpoint not found"
echo ""
echo ""

# Test 3: Creator Invitation Sent
echo "3. Testing creator_invitation webhook..."
curl -s -X POST \
  "${DOBBLETAP_URL}/api/webhooks/dttracker/creator-invitation" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "creator_invitation_sent",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "campaignId": "dttracker-campaign-123",
      "creatorId": "'$(uuidgen)'",
      "creatorHandle": "test_creator",
      "platform": "tiktok",
      "offerAmount": 50000,
      "sentAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' || echo "FAILED or endpoint not found"
echo ""
echo ""

# Test 4: Content Approved
echo "4. Testing content_approved webhook..."
curl -s -X POST \
  "${DOBBLETAP_URL}/api/webhooks/dttracker/content-approved" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "content_approved",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "submissionId": "'$(uuidgen)'",
      "campaignId": "dttracker-campaign-123",
      "creatorId": "'$(uuidgen)'",
      "approvedBy": "'$(uuidgen)'",
      "feedback": "Looks great!",
      "approvedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' || echo "FAILED or endpoint not found"
echo ""
echo ""

echo "========================================"
echo "Outbound Tests Complete!"
echo "========================================"
echo ""
echo "Note: These endpoints need to be implemented on Dobbletap side."
echo "If you see 404 errors, Dobbletap hasn't created these endpoints yet."
