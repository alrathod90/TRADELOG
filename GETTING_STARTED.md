# TradeLog Backend Configuration Guide - Complete Index

Welcome! This guide helps you set up TradeLog with a backend server for live prices and cloud data persistence.

## 📖 Where to Start?

### 🚀 I want to setup NOW (5-15 minutes)
→ Follow **[QUICK_START.md](./QUICK_START.md)**
- Railway recommended (cheapest & easiest)
- Google Sheets configuration
- Vercel integration
- Testing checklist

### ✅ I want to verify setup step-by-step  
→ Use **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)**
- Pre-deployment checklist
- Deployment steps
- Testing procedures
- Troubleshooting

### 📚 I need detailed information
→ Read **[BACKEND_SETUP.md](./BACKEND_SETUP.md)**
- Deep dive on each platform
- All deployment options
- API reference
- Environment variables
- Cost breakdown

---

## 🎯 Quick Summary

### What You Need
```
1. Google Account (for Google Sheets & Cloud)
2. GitHub Account (for deployment)
3. Credit card (optional - for free tier backups)
```

### What You'll Get
```
✅ TradeLog frontend: https://tradelog-gray.vercel.app
✅ Backend API: Deployed to Railway/Render/Heroku
✅ Data storage: Google Sheets (linked to backend)
✅ Live prices: Real-time NSE stock quotes
✅ Trade persistence: All data synced to cloud
```

### Cost per Month
```
- Vercel frontend: FREE ✅
- Railway backend: $5 (free credit included) 
- Google Sheets: FREE ✅
─────────────────────────────────
TOTAL: $0-5/month
```

---

## 🚀 Three Deployment Paths

### Path 1: Railway (Recommended) ⭐⭐⭐⭐⭐
```
Pros:
✅ Free $5/month credit (covers costs)
✅ Easiest setup (5 minutes)
✅ Best uptime reliability
✅ Great dashboard

Cons:
❌ After free credit, $5/month

Steps: QUICK_START.md → Railway section
```

### Path 2: Render 🎉
```
Pros:
✅ Completely FREE
✅ Easy setup
✅ Good performance

Cons:
⚠️ Spins down after 15 min (slow to wake)
⚠️ Limited uptime SLA

Steps: QUICK_START.md → Render section
```

### Path 3: Heroku ⚠️
```
Pros:
✅ Previously free (now discontinued)
✅ Well-known platform

Cons:
❌ Now costs $7/month minimum
❌ No free tier

Steps: QUICK_START.md → Heroku section (not recommended)
```

**Recommendation: Use Railway for best balance of cost and reliability.**

---

## 📋 Setup Process Overview

```
Step 1: Google Cloud Setup (5 min)
├── Create service account
├── Download JSON credentials
└── Share with your email

Step 2: Google Sheets Setup (2 min)
├── Create spreadsheet
├── Add headers
└── Get ID from URL

Step 3: Backend Deployment (5 min)
├── Connect GitHub
├── Set environment variables
└── Deploy (auto)

Step 4: Vercel Configuration (3 min)
├── Add VITE_BACKEND_URL
├── Add VITE_BACKEND_KEY
└── Redeploy frontend

Step 5: Testing (5 min)
├── Test backend endpoints
├── Test frontend features
└── Verify data persistence

Total Time: 15-20 minutes
```

---

## 🔑 Key Concepts

### What is VITE_BACKEND_URL?
The URL where your backend API is deployed
```
Example: https://tradelog-api-xyz.railway.app
(without trailing slash)
```

### What is VITE_BACKEND_KEY?
Secret API key to authenticate requests to backend
```
Should be 32+ characters
Keep it private (never commit to git)
```

### What is GOOGLE_SERVICE_ACCOUNT_JSON?
Google credentials that backend uses to access Google Sheets
```
Downloaded as JSON file
Contains private key (keep secret!)
Allows backend to read/write to your sheet
```

### What is SPREADSHEET_ID?
Unique ID of your Google Sheet
```
From URL: docs.google.com/spreadsheets/d/[THIS_IS_ID]/
Used by backend to know which sheet to save to
```

---

## 📁 File Structure

```
tradelog/
├── src/                    # Frontend code
│   ├── App.jsx            # Main React component
│   ├── main.jsx           # Entry point
│   └── utils.js           # Utilities
├── server/
│   └── index.js           # Backend Express app
├── public/                # Static files
├── .env.local             # Local dev environment
├── .env.example           # Configuration template
├── vite.config.js         # Vite configuration
├── package.json           # Dependencies
├── QUICK_START.md         # ⭐ Start here
├── SETUP_CHECKLIST.md     # Track progress
├── BACKEND_SETUP.md       # Detailed guide
└── README.md              # Project overview
```

---

## 🧪 Testing Your Setup

### Quick Test (30 seconds)
```bash
# 1. Check backend is running
curl "https://your-backend/api/ltp?syms=RELIANCE" \
  -H "x-api-key: your-key"

# 2. Should return:
{"prices":{"RELIANCE":2750.5}}
```

### Full Integration Test (2 minutes)
1. Open https://tradelog-gray.vercel.app
2. Click "New Trade"
3. Type "INFY" in search → should show results
4. Select stock → should fetch live price
5. Save trade → should appear in journal
6. Logout and login → trade should persist
7. Check Google Sheet → trade should be there

---

## 🔐 Security Best Practices

```
✅ DO:
- Keep API_KEY secret (not in git)
- Use strong API_KEY (32+ chars, random)
- Store credentials in backend only
- Use HTTPS everywhere
- Rotate API_KEY monthly

❌ DON'T:
- Commit .env files to git
- Use weak/predictable keys
- Share credentials publicly
- Use same key in dev & prod
- Store secrets in frontend code
```

---

## 💰 Cost Tracking

Monitor your spending:

```
Railway:
- Go to dashboard.railway.app
- Projects → Usage
- Check monthly credits remaining

Render:
- Go to render.com/dashboard
- Check resource usage
- Free tier has limits

Google:
- GCP Console → Billing
- Usually free for personal use
```

---

## 🆘 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "401 Unauthorized" | API key mismatch | Match API_KEY in both places |
| "404 Not Found" | Backend not deployed | Check deployment status |
| "Search shows nothing" | NSE database empty | Check Google Sheet has data |
| "Live prices stuck" | Backend not responding | Test `/api/ltp` endpoint |
| "Trades not saving" | Sheet permissions wrong | Verify service account access |
| "Cannot connect to backend" | Wrong URL or CORS | Check VITE_BACKEND_URL format |

Full troubleshooting: See [BACKEND_SETUP.md](./BACKEND_SETUP.md#troubleshooting)

---

## 📞 Getting Help

1. **Check docs first**: [QUICK_START.md](./QUICK_START.md)
2. **Still stuck?** Read [BACKEND_SETUP.md](./BACKEND_SETUP.md#troubleshooting)
3. **Test endpoints**: Verify each API works
4. **Check logs**: Railway/Render dashboard
5. **GitHub Issues**: Report bugs or ask questions

---

## 🎓 Learning Resources

- [Express.js Handbook](https://www.freecodecamp.org/news/rest-api-tutorial-rest-api-concepts-and-examples/)
- [Google Sheets API Docs](https://developers.google.com/sheets/api)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)

---

## ✨ What Happens After Setup

Your app will have:

```
Frontend (Vercel)
├── Live search for 500+ NSE stocks
├── Trade entry with validation
├── Dashboard with analytics
├── Trade journal with history
├── Export/import trades
└── Emotion tracking

Backend (Railway/Render)
├── Live price fetching (Yahoo Finance)
├── Trade persistence (Google Sheets)
├── NSE symbol database
├── API key authentication
└── Rate limiting & backoff

Data Storage (Google Sheets)
├── Trade history
├── Performance analytics
├── Price history (optional)
└── Custom data (optional)
```

---

## 🎯 Next Steps

1. **Right now**: Read [QUICK_START.md](./QUICK_START.md)
2. **In 5 min**: Decide which platform (Railway recommended)
3. **In 10 min**: Set up Google credentials
4. **In 15 min**: Deploy backend
5. **In 20 min**: Configure Vercel
6. **In 25 min**: Test everything works ✅

---

## 📝 Setup Notes Template

Use this to document your setup:

```
Date: _______________
Platform chosen: Railway / Render / Heroku

Backend URL: _____________________________
API Key: _____________________________
Spreadsheet ID: _____________________________
Service Account Email: _____________________________

Completed:
- [ ] Google Cloud setup
- [ ] Google Sheets created
- [ ] Backend deployed
- [ ] Vercel configured
- [ ] Frontend tested
- [ ] Data persistence verified

Notes:
_____________________________________________
_____________________________________________
```

---

## 🚀 You're Ready!

**This guide has everything you need.** Start with [QUICK_START.md](./QUICK_START.md) and you'll have a fully functional TradeLog with backend in 15-20 minutes.

**Questions?** Check the relevant doc or test the endpoints.

**Good luck! Happy trading! 📈**

---

**Last Updated**: June 2026  
**Status**: ✅ Production Ready
