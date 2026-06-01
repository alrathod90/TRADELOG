# TradeLog Backend Setup Checklist

Use this checklist to track your backend deployment progress.

## ✅ Pre-Deployment Setup

- [ ] Read [QUICK_START.md](./QUICK_START.md)
- [ ] Choose deployment platform (Railway recommended)
- [ ] Created Google Cloud project
- [ ] Created service account and downloaded JSON key
- [ ] Have service account email from JSON file
- [ ] Created Google Sheet "TradeLog Data"
- [ ] Shared Google Sheet with service account email
- [ ] Got Spreadsheet ID from sheet URL
- [ ] Generated API_KEY (e.g., using `openssl rand -hex 32`)

## 🚀 Deployment

### Railway Setup
- [ ] Created Railway account (railway.app)
- [ ] Connected GitHub account to Railway
- [ ] Created new Railway project
- [ ] Set environment variables:
  - [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` = JSON content
  - [ ] `SPREADSHEET_ID` = your sheet ID
  - [ ] `API_KEY` = your random key
  - [ ] `PORT` = 4000 (optional, defaults to 4000)
- [ ] Deployed project
- [ ] Got backend URL from Railway dashboard
- [ ] Backend URL format: `https://tradelog-api-xxx.railway.app`

### Alternative: Render Setup
- [ ] Created Render account (render.com)
- [ ] Forked/pushed code to GitHub
- [ ] Created new Web Service on Render
- [ ] Configured:
  - [ ] Build Command: `npm install`
  - [ ] Start Command: `node server/index.js`
- [ ] Set environment variables (same as above)
- [ ] Deployed
- [ ] Got backend URL: `https://tradelog-api.onrender.com`

### Alternative: Heroku Setup
- [ ] Installed Heroku CLI
- [ ] Created Heroku app: `heroku create tradelog-api`
- [ ] Set config vars using CLI
- [ ] Pushed code: `git push heroku main`
- [ ] Got backend URL: `https://tradelog-api.herokuapp.com`

## 🧪 Backend Testing

- [ ] Backend deployed and accessible
- [ ] Tested LTP endpoint:
  ```bash
  curl "https://your-backend/api/ltp?syms=RELIANCE" \
    -H "x-api-key: your-key"
  ```
  Result: `{"prices":{"RELIANCE":2750.5}}`

- [ ] Tested NSE endpoint:
  ```bash
  curl "https://your-backend/api/nse" \
    -H "x-api-key: your-key"
  ```
  Result: Array of stocks or `[]`

- [ ] Tested trades endpoint:
  ```bash
  curl "https://your-backend/api/trades" \
    -H "x-api-key: your-key"
  ```
  Result: Empty array `[]` initially

## 🔧 Vercel Configuration

- [ ] Logged into Vercel dashboard
- [ ] Selected "tradelog" project
- [ ] Went to Settings → Environment Variables
- [ ] Added environment variables:
  - [ ] `VITE_BACKEND_URL` = `https://your-backend.com` (no trailing slash)
  - [ ] `VITE_BACKEND_KEY` = your API key (same as backend's API_KEY)
- [ ] Saved variables
- [ ] Triggered redeploy (git push or manual)
- [ ] Waited for deployment to complete

## 🧪 Frontend Testing

Visit: https://tradelog-gray.vercel.app

- [ ] Page loads without errors
- [ ] Can sign in with `tradelog` / `$duWav92`
- [ ] Dashboard displays
- [ ] Clicked "New Trade"
- [ ] Stock search works:
  - [ ] Type "INFY" in search
  - [ ] See search results (not error)
  - [ ] Click on result
  - [ ] Shows "Fetching LTP..."
  - [ ] Price updates after 2-3 seconds
- [ ] Trade details form fills correctly
- [ ] Saved a test trade
- [ ] Trade appears in Trade Journal
- [ ] Logged out and back in
- [ ] Test trade still appears (persisted)

## 📊 Google Sheets Verification

- [ ] Opened Google Sheet "TradeLog Data"
- [ ] Sheet1 has headers: `sym`, `name`, `sector`
- [ ] Trades sheet has headers: `id`, `sym`, `entryPrice`, etc.
- [ ] Test trade appears in Trades sheet after saving
- [ ] Columns populated correctly

## 🎯 Final Checklist

- [ ] Frontend: https://tradelog-gray.vercel.app working
- [ ] Backend: Responding to API calls
- [ ] Google Sheets: Receiving trade data
- [ ] Search: Working with results
- [ ] Live prices: Updating correctly
- [ ] Data persistence: Trades saved across sessions
- [ ] Error handling: No console errors

## 📝 Important URLs/Keys to Save

```
Frontend URL: https://tradelog-gray.vercel.app
Backend URL: https://your-backend-url.com
API Key: sk_live_xxxxxxxxxxxx
Spreadsheet ID: 1abc2def3ghi...
Service Account Email: service-account@project.iam.gserviceaccount.com
```

Keep these somewhere safe (password manager recommended).

## 🆘 If Something Fails

### Search not working
- [ ] Check backend `/api/nse` endpoint
- [ ] Verify Google Sheet has data in Sheet1
- [ ] Check API_KEY matches

### Live prices not fetching
- [ ] Verify `/api/ltp` endpoint works
- [ ] Check VITE_BACKEND_URL set in Vercel
- [ ] Check VITE_BACKEND_KEY matches API_KEY
- [ ] Check backend logs for errors

### Trades not saving
- [ ] Verify `/api/trades` endpoint works
- [ ] Check Google Sheet "Trades" tab exists
- [ ] Check service account email has editor permissions
- [ ] Check GOOGLE_SERVICE_ACCOUNT_JSON is correct

### Backend won't start
- [ ] Verify all env variables set
- [ ] Check JSON is valid (no quotes around value)
- [ ] Check SPREADSHEET_ID format
- [ ] Check backend logs

## 💡 Optimization Tips

After everything works:

- [ ] Set up uptime monitoring (Uptime Robot free)
- [ ] Add more stocks to Google Sheet
- [ ] Set monthly API key rotation reminder
- [ ] Monitor Railway/Render dashboard costs
- [ ] Keep API keys secure (never share)
- [ ] Document any customizations made

## 🎉 Success!

When this entire checklist is complete, you have:
- ✅ Deployed frontend to Vercel
- ✅ Deployed backend to Railway/Render/Heroku
- ✅ Connected Google Sheets for data storage
- ✅ Integrated live price fetching
- ✅ Full working TradeLog with cloud persistence

**Total setup time**: ~15-20 minutes

---

**Need help?** Check [QUICK_START.md](./QUICK_START.md) or [BACKEND_SETUP.md](./BACKEND_SETUP.md)
