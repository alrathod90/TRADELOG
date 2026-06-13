# TradeLog — Capacitor Mobile App Setup
Complete guide to run TradeLog on Android and iOS.

---

## Prerequisites
- Node.js 18+
- For Android: Android Studio (free) — https://developer.android.com/studio
- For iOS: Xcode (free, Mac only) — from Mac App Store
- A deployed Vercel URL for the API proxies (live prices, alerts, WhatsApp)

---

## Step 1 — Install dependencies

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
```

---

## Step 2 — Deploy to Vercel (required for mobile API calls)

The mobile app can't use Vite's dev proxy — it needs a real server for Yahoo Finance,
StockInsights, and CallMeBot. Deploy your app to Vercel first.

```bash
npm install -g vercel
vercel          # follow prompts — links to your GitHub repo or deploys directly
```

After deploying, copy your URL (e.g. https://tradelog-xyz.vercel.app).

---

## Step 3 — Update your .env

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_BASE=https://your-tradelog.vercel.app    ← add this line
```

---

## Step 4 — Build the web app

```bash
npm run build
```

This creates the `dist/` folder that Capacitor wraps into the native app.

---

## Step 5 — Initialize Capacitor

Copy `capacitor.config.ts` to your project root, then run:

```bash
npx cap init TradeLog com.tradelog.app --web-dir dist
```

---

## Step 6 — Add platforms

```bash
# Android
npx cap add android

# iOS (Mac only)
npx cap add ios
```

---

## Step 7 — Sync web assets to native projects

Run this every time you change your web code:

```bash
npm run build && npx cap sync
```

---

## Step 8 — Run on Android

1. Open Android Studio:
   ```bash
   npx cap open android
   ```
2. In Android Studio: wait for Gradle sync to finish (~2 min first time)
3. Connect your Android phone via USB (enable USB debugging in Developer Options)
   OR use the built-in emulator (AVD Manager → create a device)
4. Click the green ▶ Run button

### Android USB Debugging
Settings → About phone → tap "Build number" 7 times → Developer Options → USB Debugging: ON

---

## Step 9 — Run on iOS (Mac only)

1. Open Xcode:
   ```bash
   npx cap open ios
   ```
2. In Xcode: select your device or simulator from the top toolbar
3. Go to Signing & Capabilities → select your Apple Developer account
   (Free account works for testing on your own device; $99/year needed for App Store)
4. Click the ▶ Run button

---

## Step 10 — Live reload during development (optional but very useful)

Instead of rebuilding every time, point the app at your local Vite server:

1. Find your machine's local IP:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127
   # Windows
   ipconfig
   ```
   e.g. your IP is `192.168.1.42`

2. In `capacitor.config.ts`, uncomment the server section:
   ```ts
   server: {
     url: 'http://192.168.1.42:5173',
     cleartext: true,
   }
   ```

3. Run Vite dev server:
   ```bash
   npm run dev -- --host
   ```

4. Sync and run:
   ```bash
   npx cap sync && npx cap run android
   ```

Changes in your React code now reflect instantly on the device without rebuilding.
Remember to comment out the `server.url` again before doing a production build.

---

## Step 11 — App icons and splash screen

Put your icon files in the right places:

```
android/app/src/main/res/
  mipmap-hdpi/ic_launcher.png      (72×72)
  mipmap-xhdpi/ic_launcher.png     (96×96)
  mipmap-xxhdpi/ic_launcher.png    (144×144)
  mipmap-xxxhdpi/ic_launcher.png   (192×192)

ios/App/App/Assets.xcassets/AppIcon.appiconset/
  (Xcode will show you which sizes are needed)
```

Or use the Capacitor Assets tool to generate all sizes from one image:
```bash
npm install @capacitor/assets --save-dev
npx capacitor-assets generate --iconBackgroundColor '#0b0b14' --splashBackgroundColor '#0b0b14'
```
(Place a 1024×1024 `icon.png` and 2732×2732 `splash.png` in your project root first.)

---

## Step 12 — Publish to stores

### Google Play Store
1. In Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle
2. Create a keystore file (keep it safe — you need it for all future updates)
3. Go to play.google.com/console → Create app → upload the .aab file
4. One-time fee: $25 USD

### Apple App Store
1. In Xcode: Product → Archive → Distribute App → App Store Connect
2. Requires Apple Developer account: $99 USD/year
3. Review takes 1–3 days

---

## Troubleshooting

**"cleartext traffic not permitted" on Android**
→ Make sure all your API calls use HTTPS. Check `VITE_API_BASE` starts with `https://`.

**White screen on launch**
→ Run `npm run build` again, then `npx cap sync`. Check the browser console via
   Chrome DevTools: open `chrome://inspect` on your computer while the app runs on Android.

**iOS: "Untrusted Developer" error**
→ Settings → General → VPN & Device Management → trust your developer certificate.

**Supabase auth not working on mobile**
→ In Supabase Dashboard → Authentication → URL Configuration → add:
   `capacitor://localhost` and `http://localhost` to Redirect URLs.

**Live prices not loading on mobile**
→ Check that `VITE_API_BASE` is set and your Vercel deployment is live.
   Test: open `https://your-tradelog.vercel.app/api/yf?path=/v8/finance/chart/RELIANCE.NS&interval=1d&range=1d`
   in a browser — it should return JSON.
