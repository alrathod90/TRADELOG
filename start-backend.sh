#!/bin/bash

# TradeLog Backend Quick Start Script
# This script helps you set up and run the backend server locally

set -e

echo "🚀 TradeLog Backend Quick Start"
echo "================================"
echo ""

# Check if .env.backend exists
if [ ! -f ".env.backend" ]; then
  echo "⚠️  .env.backend not found. Creating template..."
  cat > .env.backend << 'EOF'
# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project","private_key_id":"key-id","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"service-account@project.iam.gserviceaccount.com","client_id":"123456","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}'
SPREADSHEET_ID='your-spreadsheet-id-here'

# API Security
API_KEY='your-random-secret-key-here'

# Server
PORT=4000
EOF
  echo "✅ Created .env.backend template"
  echo "📝 Please edit .env.backend with your credentials:"
  echo "   1. Get Google Service Account JSON from Google Cloud Console"
  echo "   2. Get Spreadsheet ID from your Google Sheet URL"
  echo "   3. Generate random API_KEY (use: openssl rand -hex 16)"
  echo ""
  exit 1
fi

# Load environment
export $(cat .env.backend | grep -v '^#' | xargs)

# Check required variables
if [ -z "$GOOGLE_SERVICE_ACCOUNT_JSON" ] || [ -z "$SPREADSHEET_ID" ] || [ -z "$API_KEY" ]; then
  echo "❌ Missing required environment variables in .env.backend"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo ""
echo "✅ Configuration loaded"
echo "🔌 Starting server on http://localhost:$PORT"
echo ""
echo "📌 Test commands:"
echo "   # Test LTP endpoint"
echo "   curl 'http://localhost:4000/api/ltp?syms=RELIANCE' -H 'x-api-key: $API_KEY'"
echo ""
echo "   # Test NSE database"
echo "   curl 'http://localhost:4000/api/nse' -H 'x-api-key: $API_KEY'"
echo ""
echo "   # Test trades endpoint"
echo "   curl 'http://localhost:4000/api/trades' -H 'x-api-key: $API_KEY'"
echo ""

# Start server
node server/index.js
