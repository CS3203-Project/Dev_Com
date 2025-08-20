#!/bin/bash

# Test Email Service API
# Make sure the communication service is running on port 3001

BASE_URL="http://localhost:3001"

echo "🧪 Testing Email Service..."
echo "================================"

# Test 1: Send a test email
echo "📧 Test 1: Sending test email..."
curl -X POST "$BASE_URL/email" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "to": "test@example.com",
    "subject": "Test Email from API",
    "html": "<h1>Hello!</h1><p>This is a test email sent via API.</p>",
    "emailType": "OTHER",
    "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
  }' | jq .

echo -e "\n"

# Test 2: Get all sent emails
echo "📨 Test 2: Retrieving all sent emails..."
curl -X GET "$BASE_URL/email/all" | jq .

echo -e "\n✅ Email service tests completed!"
