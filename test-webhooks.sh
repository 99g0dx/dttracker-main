#!/bin/bash

# Test script for Dobbletap webhook endpoints
# Usage: ./test-webhooks.sh

BASE_URL="https://ucbueapoexnxhttynfzy.supabase.co/functions/v1"
AUTH_TOKEN="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"

echo "========================================"
echo "Testing Dobbletap Webhook Endpoints"
echo "========================================"
echo ""

# Test 1: Submission Webhook
echo "1. Testing dobbletap-webhook-submission..."
curl -s -X POST \
  "${BASE_URL}/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Source: dobble-tap" \
  -d '{
    "eventType": "submission_created",
    "timestamp": "2026-02-07T16:00:00Z",
    "data": {
      "creatorCampaignId": "550e8400-e29b-41d4-a716-446655440001",
      "assetId": "550e8400-e29b-41d4-a716-446655440002",
      "version": 1,
      "assetUrl": "https://example.com/test-video.mp4",
      "note": "Test submission from webhook test script",
      "submittedAt": "2026-02-07T16:00:00Z",
      "submittedBy": "550e8400-e29b-41d4-a716-446655440003"
    }
  }' | jq '.' || echo "FAILED"
echo ""
echo ""

# Test 2: Status Change Webhook
echo "2. Testing dobbletap-webhook-status-change..."
curl -s -X POST \
  "${BASE_URL}/dobbletap-webhook-status-change" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Source: dobble-tap" \
  -d '{
    "eventType": "status_changed",
    "timestamp": "2026-02-07T16:01:00Z",
    "data": {
      "creatorCampaignId": "550e8400-e29b-41d4-a716-446655440001",
      "oldStatus": "pending",
      "newStatus": "accepted",
      "changedBy": "550e8400-e29b-41d4-a716-446655440003"
    }
  }' | jq '.' || echo "FAILED"
echo ""
echo ""

# Test 3: Review Decision Webhook
echo "3. Testing dobbletap-webhook-review-decision..."
curl -s -X POST \
  "${BASE_URL}/dobbletap-webhook-review-decision" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Source: dobble-tap" \
  -d '{
    "eventType": "review_decision",
    "timestamp": "2026-02-07T16:02:00Z",
    "data": {
      "creatorCampaignId": "550e8400-e29b-41d4-a716-446655440001",
      "assetId": "550e8400-e29b-41d4-a716-446655440002",
      "decision": "approved",
      "feedback": "Great work! Content approved.",
      "reviewerType": "agency",
      "reviewedBy": "550e8400-e29b-41d4-a716-446655440004"
    }
  }' | jq '.' || echo "FAILED"
echo ""
echo ""

# Test 4: Post Submitted Webhook
echo "4. Testing dobbletap-webhook-post-submitted..."
curl -s -X POST \
  "${BASE_URL}/dobbletap-webhook-post-submitted" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Source: dobble-tap" \
  -d '{
    "eventType": "post_submitted",
    "timestamp": "2026-02-07T16:03:00Z",
    "data": {
      "creatorCampaignId": "550e8400-e29b-41d4-a716-446655440001",
      "postUrl": "https://www.tiktok.com/@testuser/video/7123456789",
      "platform": "tiktok",
      "submittedAt": "2026-02-07T16:03:00Z",
      "submittedBy": "550e8400-e29b-41d4-a716-446655440003"
    }
  }' | jq '.' || echo "FAILED"
echo ""
echo ""

# Test 5: Campaign Completed Webhook
echo "5. Testing dobbletap-webhook-campaign-completed..."
curl -s -X POST \
  "${BASE_URL}/dobbletap-webhook-campaign-completed" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Source: dobble-tap" \
  -d '{
    "eventType": "campaign_completed",
    "timestamp": "2026-02-07T16:04:00Z",
    "data": {
      "creatorCampaignId": "550e8400-e29b-41d4-a716-446655440001",
      "status": "completed",
      "completedAt": "2026-02-07T16:04:00Z",
      "paymentAmount": 50000,
      "paymentCurrency": "NGN",
      "paymentReference": "PYSK_test_123456789"
    }
  }' | jq '.' || echo "FAILED"
echo ""
echo ""

# Test 6: Verification Completed Webhook
echo "6. Testing dobbletap-webhook-verification-completed..."
curl -s -X POST \
  "${BASE_URL}/dobbletap-webhook-verification-completed" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Source: dobble-tap" \
  -d '{
    "eventType": "verification_completed",
    "timestamp": "2026-02-07T16:05:00Z",
    "data": {
      "entryId": "550e8400-e29b-41d4-a716-446655440005",
      "campaignId": "550e8400-e29b-41d4-a716-446655440001",
      "verificationType": "contest_entry",
      "verificationStatus": "verified",
      "verificationResults": {
        "soundVerified": true,
        "briefCompliance": true,
        "engagementVerified": true,
        "metrics": {
          "views": 15000,
          "likes": 1200,
          "comments": 45,
          "shares": 30
        }
      },
      "verifiedAt": "2026-02-07T16:05:00Z"
    }
  }' | jq '.' || echo "FAILED"
echo ""
echo ""

echo "========================================"
echo "Tests Complete!"
echo "========================================"
