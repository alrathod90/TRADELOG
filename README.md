# TradeLog - NSE Trading Journal

A modern, self-hosted trading journal for NSE (National Stock Exchange) traders. Track your trades, analyze performance, and get live stock prices.

**Live Demo**: https://tradelog-gray.vercel.app  
**Features**: ✅ Live Prices | ✅ Cloud Sync | ✅ Trade Analytics | ✅ Emotion Tracking

---

## 🚀 Quick Start (5 Minutes)

### Option 1: Deployed Demo (No Backend)
Simply visit: https://tradelog-gray.vercel.app
- Sign in with: `tradelog` / `$duWav92`
- ✅ Search & trade logging works
- ⚠️ Live prices unavailable (no backend)

### Option 2: With Live Prices (Recommended)
Follow [QUICK_START.md](./QUICK_START.md) for step-by-step setup:
1. Deploy backend to Railway/Render (5 min)
2. Configure Google Sheets for data persistence
3. Connect to Vercel
4. ✅ Everything fully functional

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](./QUICK_START.md) | **Start here** - Step-by-step setup (5 min) |
| [BACKEND_SETUP.md](./BACKEND_SETUP.md) | Detailed backend deployment guide |
| [.env.example](./.env.example) | Configuration templates |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         TradeLog Frontend (Vercel)          │
│  React + Vite + localStorage persistence   │
└────────────────┬────────────────────────────┘
                 │ API calls
┌────────────────▼────────────────────────────┐
│    TradeLog Backend (Railway/Render)        │
│    Node.js + Express                        │
├─────────────────────────────────────────────┤
│ ✓ Live Price Fetch (Yahoo Finance)         │
│ ✓ Trade Persistence (Google Sheets)        │
│ ✓ NSE Symbol Database Management           │
└────────────────┬────────────────────────────┘
                 │ API calls
┌────────────────▼────────────────────────────┐
│   External Services                         │
├─────────────────────────────────────────────┤
│ • Google Sheets (data storage)              │
│ • Yahoo Finance API (live prices)           │
└─────────────────────────────────────────────┘
```

---

## 🎯 Features

### Core Trading
- **Trade Entry**: Buy/Sell, entry/exit prices, quantity
- **Live Prices**: Real-time NSE stock quotes
- **Stock Search**: 500+ NSE symbols with autocomplete
- **Trade Persistence**: Cloud-synced to Google Sheets

### Analytics
- **Dashboard**: P&L metrics, win rate, monthly stats
- **Trade Journal**: Detailed trade history with notes
- **Ratings**: Trade quality rating system
- **Emotions**: Track decision-making psychology

### Data Management
- **Export**: Backup trades as JSON
- **Import**: Restore from backup
- **Cloud Sync**: Google Sheets integration
- **Offline**: Works without internet (limited)

---

## 🔧 Development

### Prerequisites
- Node.js 16+
- npm or yarn
- Git

### Local Setup
```bash
# Clone repository
git clone https://github.com/yourusername/tradelog.git
cd tradelog

# Install dependencies
npm install

# Run frontend dev server
npm run dev

# Open http://localhost:5179
```

### Local Backend (Optional)
```bash
# Create .env.backend file (see .env.example)
# Add Google credentials

# Start backend
bash start-backend.sh
```

### Build for Production
```bash
npm run build
npm run preview
```

---

## 📦 Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Connect to Vercel
3. Auto-deploys on every push
4. **Cost**: Free

### Backend (Railway/Render)
1. Follow [QUICK_START.md](./QUICK_START.md)
2. Set environment variables
3. Deploy backend
4. **Cost**: $5-7/month or free

---

## 💰 Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| Frontend (Vercel) | Free | Unlimited deployments |
| Backend (Railway) | $5/mo | Generous free credits |
| Google Sheets | Free | 15 GB storage included |
| Total | **$5/mo** | ✅ Affordable for personal use |

---

## 🔐 Security

- **Credentials**: Google credentials stored in backend only
- **API Keys**: Required for all backend endpoints
- **localStorage**: Used for offline data only
- **HTTPS**: All connections encrypted
- **Data**: Synced to your own Google Sheets account

---

## 📝 API Reference

### Backend Endpoints

```bash
# Get live prices
GET /api/ltp?syms=RELIANCE,INFY
-H "x-api-key: your-key"

# Get NSE symbols
GET /api/nse
-H "x-api-key: your-key"

# Get trades
GET /api/trades
-H "x-api-key: your-key"

# Save trade
POST /api/trades/append
-H "x-api-key: your-key"
-d '{"sym":"INFY","entryPrice":1680,...}'

# Update trade
POST /api/trades/update
-H "x-api-key: your-key"
-d '{"id":123,"status":"closed",...}'
```

---

## 🐛 Troubleshooting

### Search not working
- Check if backend is deployed (needed for full database)
- Fallback hardcoded symbols: RELIANCE, INFY, TCS, etc.

### Live prices not showing
- Verify backend is running
- Check VITE_BACKEND_URL in Vercel settings
- Test endpoint: `curl https://backend/api/ltp?syms=INFY`

### Trades not saving
- Without backend: Only saved locally
- With backend: Check Google Sheet permissions
- Verify API_KEY matches in both places

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

---

## 📄 License

MIT License - Feel free to use and modify

---

## 🎓 Learning Resources

- [React Hooks](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Google Sheets API](https://developers.google.com/sheets)
- [Express.js](https://expressjs.com)

---

## 💬 Support

- **Issues**: GitHub Issues
- **Questions**: Discussions tab
- **Feedback**: Pull requests welcome

---

## 🌟 Roadmap

- [ ] Mobile app (React Native)
- [ ] Multi-user support
- [ ] Advanced charting
- [ ] ML-based trade recommendations
- [ ] Discord notifications
- [ ] Telegram bot integration

---

**Made with ❤️ for NSE traders**

