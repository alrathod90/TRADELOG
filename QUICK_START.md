# Quick Setup - Choose Your Path

## 🚀 Fastest Setup (Railway - 5 minutes)

### 1. Create Service Account (Google Cloud)
```
1. Go: console.cloud.google.com
2. Create Project → "TradeLog"
3. Enable APIs → Search "Sheets" → Enable
4. Credentials → Service Account → Create Key → JSON
5. Copy the JSON content
```

### 2. Create Google Sheet
```
1. Go: sheets.google.com
2. Create new sheet: "TradeLog Data"
3. Share with email from JSON file
4. Get ID from URL: https://docs.google.com/spreadsheets/d/[ID]/
```

### 3. Deploy to Railway
```bash
# Copy files to a separate folder (or fork on GitHub)
git clone https://github.com/yourusername/tradelog.git
cd tradelog

# Login to Railway
npx railway login

# Initialize Railway project
npx railway init

# Set environment in Railway CLI
npx railway variable set GOOGLE_SERVICE_ACCOUNT_JSON='<paste-json-here>'
npx railway variable set SPREADSHEET_ID='<paste-id-here>'
npx railway variable set API_KEY='sk_live_'$(date +%s | sha256sum | cut -c1-32)

# Deploy
npx railway up
```

### 4. Get Backend URL
```
# In Railway dashboard, you'll see a domain like:
# https://tradelog-api-xyz.railway.app

# Copy this URL
```

### 5. Configure Vercel
```
1. Go: vercel.com → Dashboard → tradelog
2. Settings → Environment Variables
3. Add:
   VITE_BACKEND_URL = https://tradelog-api-xyz.railway.app
   VITE_BACKEND_KEY = sk_live_<same-key-as-above>
4. Redeploy (git push or manual trigger)
```

### ✅ Done! 
Visit https://tradelog-gray.vercel.app and test:
- Search for stocks
- Create new trade
- Check live prices update

---

## 📋 Comparison Table

| Platform | Setup Time | Cost | Difficulty | Free Tier |
|----------|-----------|------|------------|-----------|
| **Railway** | 5 min | $5/mo | ⭐ Easy | $5 credit/mo |
| **Render** | 5 min | Free | ⭐ Easy | Yes (spins down) |
| **Heroku** | 5 min | $7/mo | ⭐ Easy | No (discontinued) |

### Railway (Recommended)
- ✅ Generous free credits
- ✅ One-click GitHub deploy
- ✅ Easy environment variables
- ✅ Good uptime

### Render
- ✅ Completely free
- ⚠️ Spins down after 15 min inactivity (slow to wake)
- ✅ Simple setup

---

## 🔑 Getting Google Credentials (Detailed)

### Step 1: Create Google Cloud Project
```
1. Open: https://console.cloud.google.com
2. Create new project:
   - Click "Select a Project" (top left)
   - Click "NEW PROJECT"
   - Name: "TradeLog API"
   - Click "CREATE"
   - Wait for notification (top right)
```

### Step 2: Enable Sheets API
```
1. In Google Cloud Console
2. Search: "Sheets API"
3. Click "Google Sheets API"
4. Click "ENABLE"
5. Wait for notification
```

### Step 3: Create Service Account
```
1. Go to: APIs & Services → Credentials
2. Click "Create Credentials" (top)
3. Choose: "Service Account"
4. Fill:
   - Service account name: "tradelog-api"
   - Description: "TradeLog backend API"
5. Click "CREATE AND CONTINUE"
6. Skip optional steps, click "DONE"
```

### Step 4: Get JSON Key
```
1. Go to: APIs & Services → Service Accounts
2. Click on "tradelog-api" service account
3. Go to "KEYS" tab
4. Click "Add Key" → "Create new key"
5. Choose "JSON"
6. Click "CREATE"
7. A JSON file downloads automatically
8. Open it and copy the entire content
```

### Step 5: Get Email for Sharing
```
In the JSON file, find the line:
"client_email": "service-account-xyz@project-id.iam.gserviceaccount.com"

Copy this email address
```

---

## 📊 Configure Google Sheet

### Create Sheet
```
1. Go: https://sheets.google.com
2. Create new spreadsheet
3. Name: "TradeLog Data"
4. Share:
   - Click "Share" (top right)
   - Add email from Step 5 above
   - Give "Editor" permission
   - Uncheck "Notify people"
   - Click "Share"
```

### Get Spreadsheet ID
```
URL: https://docs.google.com/spreadsheets/d/1abc2def3ghi4jkl5mno6pqr7stu8vwx/edit
                                          ^------ THIS IS THE ID ------^

Copy: 1abc2def3ghi4jkl5mno6pqr7stu8vwx
```

### Add Headers
```
In Sheet1, add headers in row 1:
  A1: sym
  B1: name
  C1: sector

In "Trades" sheet, add headers:
  A1: id
  B1: sym
  C1: entryPrice
  D1: exitPrice
  E1: qty
  F1: status
  G1: entryDate
  (more columns as needed)
```

---

## 🧪 Test Everything Works

### Test 1: Backend Running
```bash
curl -X GET "https://your-backend-url/api/ltp?syms=RELIANCE" \
  -H "x-api-key: your-api-key"
```
Should return something like:
```json
{"prices":{"RELIANCE":2750.5}}
```

### Test 2: Frontend Connected
```
1. Open: https://tradelog-gray.vercel.app
2. Click "New Trade"
3. Type "INFY" in search box
4. Should show results (not an error)
5. Click a result
6. Should show "Fetching LTP..." then price updates
```

### Test 3: Trade Saved to Sheets
```
1. Save a test trade
2. Check your Google Sheet
3. New row should appear in "Trades" sheet
4. Log out and log back in
5. Trade should still be there
```

---

## 🆘 Debugging

If search doesn't work:
```bash
# Check backend NSE endpoint
curl "https://your-backend-url/api/nse" -H "x-api-key: your-key"
# Should return list of stocks or []
```

If live prices don't update:
```bash
# Check LTP endpoint
curl "https://your-backend-url/api/ltp?syms=INFY" -H "x-api-key: your-key"
# Should return prices or {"prices":{}}
```

If trades don't persist:
```bash
# Check trades endpoint
curl "https://your-backend-url/api/trades" -H "x-api-key: your-key"
# Should return array of trades
```

Check backend logs:
```bash
# Railway: Dashboard → Logs
# Heroku: heroku logs --tail
# Render: Dashboard → Logs
```

---

## 💡 Pro Tips

**Tip 1: Generate Secure API Key**
```bash
# Use this command to generate a random key:
openssl rand -hex 32
# Copy the output (64 characters)
```

**Tip 2: Test Locally First**
```bash
# Before deploying to Vercel:
export GOOGLE_SERVICE_ACCOUNT_JSON='<your-json>'
export SPREADSHEET_ID='<your-id>'
export API_KEY='<your-key>'
npm run dev
# Open http://localhost:5179
# Manually set backend in localStorage
```

**Tip 3: Monitor Costs**
```
Railway: $5/month = enough for personal use
Google Sheets: Free (15 GB)
Vercel: Free
Total: $5/month
```

**Tip 4: Add More Stocks to NSE DB**
If you want more than the 15 hardcoded stocks:
1. Open Google Sheet
2. Add rows with: sym, name, sector
3. They'll auto-sync when users search

---

## 📞 Need Help?

- **Vercel Issues**: https://vercel.com/support
- **Railway Issues**: https://railway.app/support
- **Google Sheets API**: https://developers.google.com/sheets/api
- **TradeLog Bug**: Check GitHub issues or open new one

---

## 🎯 Next: Full Deployment Checklist

- [ ] Google Cloud project created
- [ ] Sheets API enabled
- [ ] Service account created
- [ ] JSON key downloaded
- [ ] Google Sheet created and shared
- [ ] Sheet has headers configured
- [ ] Backend deployed to Railway/Render/Heroku
- [ ] Backend URL obtained
- [ ] Vercel environment variables set
- [ ] Frontend redeployed
- [ ] Tested search functionality
- [ ] Tested live price fetch
- [ ] Tested trade persistence
- [ ] Checked Google Sheet for saved trades

✅ All done! You now have a fully functional TradeLog with cloud persistence and live prices.
