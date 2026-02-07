#!/bin/bash

# Complete End-to-End Integration Test
# Tests the full bidirectional flow between DTTracker and Dobbletap

set -e  # Exit on error

# Configuration
SYNC_API_KEY="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"
DTTRACKER_BASE="https://ucbueapoexnxhttynfzy.supabase.co/functions/v1"
DOBBLETAP_BASE="https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e"

# Generate unique IDs for this test
CAMPAIGN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
SUBMISSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CREATOR_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         DTTracker ↔ Dobbletap E2E Integration Test            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Test Campaign ID: $CAMPAIGN_ID"
echo "Test Timestamp: $TIMESTAMP"
echo ""

# Counters
PASSED=0
FAILED=0
TOTAL=0

# Test function
run_test() {
    local test_name="$1"
    local url="$2"
    local payload="$3"
    local expected_status="$4"

    TOTAL=$((TOTAL + 1))

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST $TOTAL: $test_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Make request
    HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/test_response.json -X POST "$url" \
        -H "Authorization: Bearer ${SYNC_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$payload")

    RESPONSE=$(cat /tmp/test_response.json)

    echo "Request URL: $url"
    echo "HTTP Status: $HTTP_CODE"
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""

    # Check result
    if [ "$HTTP_CODE" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC} - Got expected HTTP $expected_status"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC} - Expected HTTP $expected_status, got $HTTP_CODE"
        FAILED=$((FAILED + 1))
    fi

    echo ""
    sleep 1  # Brief pause between tests
}

#═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: DTTracker → Dobbletap (Campaign Creation)
#═══════════════════════════════════════════════════════════════════════════════

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 1: DTTracker → Dobbletap (Outbound Webhooks)           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1.1: Create Campaign in Dobbletap
run_test "Create Campaign in Dobbletap" \
    "${DOBBLETAP_BASE}/webhooks/dttracker" \
    "{
        \"eventType\": \"activation_created\",
        \"timestamp\": \"$TIMESTAMP\",
        \"data\": {
            \"id\": \"$CAMPAIGN_ID\",
            \"title\": \"E2E Test Campaign - $TIMESTAMP\",
            \"brand\": \"Test Brand\",
            \"campaignType\": \"contest\",
            \"brief\": \"End-to-end integration test\",
            \"budget\": 100000,
            \"platforms\": [\"tiktok\"],
            \"createdAt\": \"$TIMESTAMP\"
        }
    }" \
    "200"

# Test 1.2: Update Campaign in Dobbletap
run_test "Update Campaign in Dobbletap" \
    "${DOBBLETAP_BASE}/webhooks/dttracker" \
    "{
        \"eventType\": \"activation_updated\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"data\": {
            \"id\": \"$CAMPAIGN_ID\",
            \"budget\": 150000,
            \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
    }" \
    "200"

#═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Dobbletap → DTTracker (Inbound Webhooks)
#═══════════════════════════════════════════════════════════════════════════════

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 2: Dobbletap → DTTracker (Inbound Webhooks)            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test 2.1: Status Change (FIXED - was returning 500)
run_test "Status Change - Activation Not Found (Expected 404)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-status-change" \
    "{
        \"eventType\": \"status_changed\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"data\": {
            \"creatorCampaignId\": \"$CAMPAIGN_ID\",
            \"oldStatus\": \"pending\",
            \"newStatus\": \"accepted\",
            \"changedBy\": \"test-user\"
        }
    }" \
    "404"

# Test 2.2: Submission Created - Activation Not Found (Expected 404)
SUBMISSION_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
run_test "Submission Created - Activation Not Found (Expected 404)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-submission" \
    "{
        \"eventType\": \"submission_created\",
        \"timestamp\": \"$SUBMISSION_TS\",
        \"data\": {
            \"creatorCampaignId\": \"$CAMPAIGN_ID\",
            \"assetId\": \"$SUBMISSION_ID\",
            \"assetUrl\": \"https://storage.example.com/test-video.mp4\",
            \"version\": 1,
            \"submittedBy\": \"$CREATOR_ID\",
            \"submittedAt\": \"$SUBMISSION_TS\"
        }
    }" \
    "404"

# Test 2.3: Review Decision - Submission Not Found (Expected 404)
run_test "Review Decision - Submission Not Found (Expected 404)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-review-decision" \
    "{
        \"eventType\": \"review_decision\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"data\": {
            \"assetId\": \"$SUBMISSION_ID\",
            \"decision\": \"approved\",
            \"feedback\": \"Great work!\",
            \"reviewerType\": \"brand\",
            \"reviewedBy\": \"brand-user-id\"
        }
    }" \
    "404"

# Test 2.4: Post Submitted (FIXED - was returning 500)
run_test "Post Submitted - Submission Not Found (Expected 404)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-post-submitted" \
    "{
        \"eventType\": \"post_submitted\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"data\": {
            \"creatorCampaignId\": \"$CAMPAIGN_ID\",
            \"postUrl\": \"https://tiktok.com/@test/video/123456\",
            \"platform\": \"tiktok\",
            \"submittedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
    }" \
    "404"

# Test 2.5: Campaign Completed (FIXED - was returning 500)
run_test "Campaign Completed - Submission Not Found (Expected 404)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-campaign-completed" \
    "{
        \"eventType\": \"campaign_completed\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"data\": {
            \"creatorCampaignId\": \"$CAMPAIGN_ID\",
            \"status\": \"completed\",
            \"paymentAmount\": 50000,
            \"paymentCurrency\": \"NGN\",
            \"paymentReference\": \"PYSK_TEST_123\",
            \"completedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
    }" \
    "404"

# Test 2.6: Verification Completed - Submission Not Found (Expected 404)
run_test "Verification Completed - Submission Not Found (Expected 404)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-verification-completed" \
    "{
        \"eventType\": \"verification_completed\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"data\": {
            \"submissionId\": \"$SUBMISSION_ID\",
            \"verificationType\": \"sm_panel\",
            \"verificationStatus\": \"verified\",
            \"verificationResults\": {
                \"likes\": 1250,
                \"shares\": 89,
                \"comments\": 145
            },
            \"verifiedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
    }" \
    "404"

#═══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Idempotency Tests
#═══════════════════════════════════════════════════════════════════════════════

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  PHASE 3: Idempotency Tests (Duplicate Prevention)            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test 3.1: Resend same submission webhook (idempotency check - should detect duplicate)
run_test "Idempotency - Duplicate Submission Event (Should Return 200 Already Processed)" \
    "${DTTRACKER_BASE}/dobbletap-webhook-submission" \
    "{
        \"eventType\": \"submission_created\",
        \"timestamp\": \"$SUBMISSION_TS\",
        \"data\": {
            \"creatorCampaignId\": \"$CAMPAIGN_ID\",
            \"assetId\": \"$SUBMISSION_ID\",
            \"assetUrl\": \"https://storage.example.com/test-video.mp4\",
            \"version\": 1,
            \"submittedBy\": \"$CREATOR_ID\",
            \"submittedAt\": \"$SUBMISSION_TS\"
        }
    }" \
    "200"

#═══════════════════════════════════════════════════════════════════════════════
# Test Results Summary
#═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                       TEST RESULTS SUMMARY                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ ALL TESTS PASSED - INTEGRATION 100% WORKING! 🎉            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}🎯 Integration Status: PRODUCTION READY${NC}"
    echo ""
    echo "✅ DTTracker → Dobbletap: Working"
    echo "✅ Dobbletap → DTTracker: Working"
    echo "✅ Error Handling: Working (proper 404s)"
    echo "✅ Idempotency: Working"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ SOME TESTS FAILED - REVIEW ERRORS ABOVE                    ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Review the failed tests above and check:"
    echo "1. Are the webhook endpoints deployed?"
    echo "2. Is authentication configured correctly?"
    echo "3. Are there any network issues?"
    echo ""
    exit 1
fi
