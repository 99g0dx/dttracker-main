#!/bin/bash

# DTTracker ↔ Dobble Tap Integration Test Script

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - EDIT THESE
DTTRACKER_API_URL="https://ucbueapoexnxhttynfzy.supabase.co/functions/v1"
SYNC_API_KEY="feae45898d4cd4cd3787b7859258769880d7f15e0a305ddd95f515309e154526"  # Set your SYNC_API_KEY here

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
CREATOR_ID=""

# Check if API key is set
if [ -z "$SYNC_API_KEY" ]; then
    echo -e "${RED}❌ Error: SYNC_API_KEY is not set${NC}"
    echo "Please edit this script and set SYNC_API_KEY variable"
    exit 1
fi

echo -e "${BLUE}🧪 Testing DTTracker ↔ Dobble Tap Integration${NC}"
echo "=============================================="
echo ""

# Test 1: Creator Sync
echo -e "${BLUE}Test 1: Creator Sync${NC}"
TEST_CREATOR_ID="test-$(date +%s)"
FULL_URL="${DTTRACKER_API_URL}/creator-sync-from-dobbletap"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${FULL_URL}" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"creator_id\": \"${TEST_CREATOR_ID}\",
    \"profile_photo\": \"https://example.com/photo.jpg\",
    \"bio\": \"Test creator\",
    \"location\": \"Lagos\",
    \"social_accounts\": [{
      \"platform\": \"tiktok\",
      \"handle\": \"@testcreator\",
      \"followers\": 10000
    }]
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Creator sync successful${NC}"
    CREATOR_ID=$(echo "$BODY" | grep -o '"creator_id":"[^"]*' | cut -d'"' -f4)
    echo "   Creator ID: $CREATOR_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Creator sync failed (HTTP $HTTP_CODE)${NC}"
    echo "   Response: $BODY"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 2: Creator Stats (if creator was created)
if [ ! -z "$CREATOR_ID" ]; then
    echo -e "${BLUE}Test 2: Creator Stats Sync${NC}"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
      "${DTTRACKER_API_URL}/creator-stats-sync-from-dobbletap" \
      -H "Authorization: Bearer ${SYNC_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"creator_id\": \"${CREATOR_ID}\",
        \"views\": 50000,
        \"likes\": 5000,
        \"comments\": 500,
        \"shares\": 200,
        \"engagement_rate\": 0.114
      }")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Creator stats sync successful${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Creator stats sync failed (HTTP $HTTP_CODE)${NC}"
        echo "   Response: $BODY"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
fi

# Summary
echo "=============================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
fi
echo ""
