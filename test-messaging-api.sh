#!/bin/bash

# Messaging API Test Script
BASE_URL="http://localhost:3001"

echo "🚀 Testing Messaging API Endpoints"
echo "=================================="

# Test data - Real user IDs from database
USER1="cmejdn2970001uxuqslu4eu5k"
USER2="cmejdlf140000uxuqtfu1eg17"

echo
echo "1️⃣ Creating a conversation..."
CONVERSATION_RESPONSE=$(curl -s -X POST "$BASE_URL/messaging/conversations" \
  -H "Content-Type: application/json" \
  -d "{
    \"userIds\": [\"$USER1\", \"$USER2\"],
    \"title\": \"Test Conversation\"
  }")

echo "Response: $CONVERSATION_RESPONSE"

# Extract conversation ID (basic extraction)
CONVERSATION_ID=$(echo $CONVERSATION_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Conversation ID: $CONVERSATION_ID"

echo
echo "2️⃣ Sending a message..."
MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/messaging/messages" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Hello! This is a test message.\",
    \"fromId\": \"$USER1\",
    \"toId\": \"$USER2\",
    \"conversationId\": \"$CONVERSATION_ID\"
  }")

echo "Response: $MESSAGE_RESPONSE"

# Extract message ID
MESSAGE_ID=$(echo $MESSAGE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Message ID: $MESSAGE_ID"

echo
echo "3️⃣ Getting conversations for user1..."
curl -s -X GET "$BASE_URL/messaging/conversations?userId=$USER1&page=1&limit=10" | jq '.'

echo
echo "4️⃣ Getting messages in conversation..."
curl -s -X GET "$BASE_URL/messaging/messages?conversationId=$CONVERSATION_ID&page=1&limit=20" | jq '.'

echo
echo "5️⃣ Getting unread count for user2..."
curl -s -X GET "$BASE_URL/messaging/users/$USER2/unread-count" | jq '.'

echo
echo "6️⃣ Marking message as read..."
curl -s -X PATCH "$BASE_URL/messaging/messages/$MESSAGE_ID/mark-read?userId=$USER2" | jq '.'

echo
echo "7️⃣ Getting unread count again (should be 0)..."
curl -s -X GET "$BASE_URL/messaging/users/$USER2/unread-count" | jq '.'

echo
echo "8️⃣ Getting conversations with last message..."
curl -s -X GET "$BASE_URL/messaging/conversations/enhanced?userId=$USER1&page=1&limit=10" | jq '.'

echo
echo "✅ API Testing Complete!"
