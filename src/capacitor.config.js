/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.tradelog.app',
  appName: 'TradeLog',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    allowNavigation: ['*.supabase.co', 'query1.finance.yahoo.com', '*.vercel.app'],
  },
  plugins: {
    SplashScreen: { launchShowDuration: 2000, backgroundColor: '#0b0b14', showSpinner: false },
    StatusBar:    { style: 'dark', backgroundColor: '#0b0b14' },
    Keyboard:     { resize: 'body', style: 'dark' },
  },
  android: { allowMixedContent: false, captureInput: true, webContentsDebuggingEnabled: false },
  ios:     { contentInset: 'automatic', limitsNavigationsToAppBoundDomains: true },
};
module.exports = config;
