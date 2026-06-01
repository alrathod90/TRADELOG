# Backend Server Setup Guide

This guide covers deploying the Node.js backend to enable live price fetching and cloud trade persistence.

## Option A1: Deploy to Railway (Recommended - Free Tier)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Create a new project

### Step 2: Configure Environment Variables
In Railway dashboard, set these variables:

```
GOOGLE_SERVICE_ACCOUNT_JSON=<your-service-account-json>
SPREADSHEET_ID=<your-spreadsheet-id>
API_KEY=<generate-random-key>
PORT=4000
```

### Step 3: Connect GitHub Repository
1. Click "Deploy from GitHub"
2. Select your tradelog repository
3. Railway auto-detects Node.js project
4. Select `server/index.js` as start file (if needed, use `npm install && node server/index.js`)

### Step 4: Get Your Backend URL
After deploy, Railway provides a public URL like:
```
https://tradelog-api-xyz.railway.app
```

---

## Option A2: Deploy to Heroku (Free Tier Available)

### Step 1: Install Heroku CLI
```bash
brew tap heroku/brew && brew install heroku
heroku login
```

### Step 2: Create Heroku App
```bash
heroku create tradelog-api
```

### Step 3: Set Environment Variables
```bash
heroku config:set GOOGLE_SERVICE_ACCOUNT_JSON='<json-string>'
heroku config:set SPREADSHEET_ID='your-spreadsheet-id'
heroku config:set API_KEY='your-random-api-key'
```

### Step 4: Deploy
```bash
git push heroku main
```

Your backend will be at: `https://tradelog-api.herokuapp.com`

---

## Option A3: Deploy to Render.com (Free Tier)

### Step 1: Sign Up
1. Go to https://render.com
2. Connect your GitHub account
3. Create new Web Service

### Step 2: Configure
- **Name**: `tradelog-api`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server/index.js`
- **Region**: Choose closest to you

### Step 3: Environment Variables
In Render dashboard, add:
```
GOOGLE_SERVICE_ACCOUNT_JSON = <json>
SPREADSHEET_ID = <id>
API_KEY = <key>
```

Your backend will be at: `https://tradelog-api.onrender.com`

---

## Google Sheets Setup (Required for All Options)

### Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "TradeLog API"
3. Enable **Google Sheets API**
4. Create **Service Account**:
   - Go to Credentials
   - Create Service Account
   - Name: `tradelog-api`
5. Create Key:
   - Open Service Account
   - Keys tab → Add Key → JSON
   - Download JSON file

### Create Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create new spreadsheet: "TradeLog Data"
3. Share with service account email (from JSON file)
4. Get Spreadsheet ID from URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/`

### Set Up Sheets
Create two sheet tabs:
- **Sheet1**: For NSE symbols (columns: `sym`, `name`, `sector`)
- **Trades**: For trade data (columns: `id`, `sym`, `entryPrice`, `qty`, `status`, etc.)

---

## Vercel Configuration

### Connect Backend to Vercel Frontend

1. **Add Environment Variable to Vercel**:
   - Go to Vercel dashboard
   - Select your tradelog project
   - Settings → Environment Variables
   - Add:
     ```
     VITE_BACKEND_URL = https://your-backend-url.com
     VITE_BACKEND_KEY = your-api-key
     ```

2. **Redeploy Vercel**:
   - Any git push to main triggers redeploy
   - Or manually trigger in Vercel dashboard

---

## Testing Backend

### Test LTP Endpoint
```bash
curl "https://your-backend-url.com/api/ltp?syms=RELIANCE,INFY" \
  -H "x-api-key: your-api-key"
```

Expected response:
```json
{
  "prices": {
    "RELIANCE": 2750.50,
    "INFY": 1680.25
  }
}
```

### Test NSE DB Endpoint
```bash
curl "https://your-backend-url.com/api/nse" \
  -H "x-api-key: your-api-key"
```

### Test Trades Endpoint
```bash
curl "https://your-backend-url.com/api/trades" \
  -H "x-api-key: your-api-key"
```

---

## Local Testing (Before Deploy)

### Setup Local Backend
```bash
# Install dependencies
npm install

# Set environment variables
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
export SPREADSHEET_ID='1abc2def3ghi...'
export API_KEY='your-secret-key'
export PORT=4000

# Start server
node server/index.js
```

### Test Locally
```bash
curl "http://localhost:4000/api/ltp?syms=RELIANCE" \
  -H "x-api-key: your-secret-key"
```

### Configure Vercel for Local Dev
Create `.env.local` in your frontend root:
```
VITE_BACKEND_URL=http://localhost:4000
VITE_BACKEND_KEY=your-secret-key
```

---

## Troubleshooting

### "401 Unauthorized"
- Check API_KEY matches VITE_BACKEND_KEY
- Check x-api-key header is sent

### "429 Too Many Requests"
- Yahoo Finance rate limit hit
- Server has automatic 60s backoff
- Wait or implement caching proxy

### "Failed to load NSE database"
- Check Google Sheets share permissions
- Verify SPREADSHEET_ID is correct
- Check service account has Sheets API enabled

### "Cannot read property 'values'"
- Sheets might be empty
- Create headers first in Sheet1: `sym`, `name`, `sector`

---

## Cost Breakdown (Monthly)

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Railway | $5 | Generous free credit monthly |
| Render | Free | Spins down after 15min inactivity |
| Heroku | $7 | Eco dyno (was free, now paid) |
| Railway + Google Sheets | ~$5 | Recommended option |

**Cheapest: Railway ($5/month) or Render (free with spindown)**

---

## Production Checklist

- [ ] Backend deployed and URL confirmed
- [ ] Environment variables set in backend host
- [ ] Google Sheets shared with service account
- [ ] API_KEY generated and set in both places
- [ ] VITE_BACKEND_URL set in Vercel
- [ ] Tested `/api/ltp` endpoint
- [ ] Tested `/api/nse` endpoint
- [ ] Frontend redeployed to Vercel
- [ ] Live prices working in deployed app
- [ ] Trade persistence working to Google Sheets

---

## API Endpoints Reference

### GET /api/ltp
Fetch live prices for symbols
- **Query**: `syms=RELIANCE,INFY,TCS`
- **Header**: `x-api-key: <key>`
- **Response**: `{ prices: { RELIANCE: 2750.5, ... } }`

### GET /api/nse
Fetch NSE symbol database
- **Header**: `x-api-key: <key>`
- **Response**: `[ { sym: "RELIANCE", name: "...", sector: "..." }, ... ]`

### GET /api/trades
Fetch all trades
- **Header**: `x-api-key: <key>`
- **Response**: Array of trade objects

### POST /api/trades/append
Add new trade
- **Header**: `x-api-key: <key>`, `Content-Type: application/json`
- **Body**: `{ sym: "INFY", entryPrice: 1680, qty: 10, ... }`
- **Response**: `{ ok: true }`

### POST /api/trades/update
Update existing trade
- **Header**: `x-api-key: <key>`
- **Body**: `{ id: 123, status: "closed", exitPrice: 1700, ... }`
- **Response**: `{ ok: true }`

---

## Next Steps

1. Choose deployment platform (Railway recommended)
2. Set up Google Sheets
3. Deploy backend
4. Get backend URL
5. Add environment variables to Vercel
6. Redeploy frontend
7. Test live prices in production app
