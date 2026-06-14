import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradelog.app',
  appName: 'TradeLog',
  webDir: 'dist',           // Vite build output folder
  bundledWebRuntime: false,

  server: {
    // During development, point to your local Vite dev server:
    // uncomment the line below and run: npx cap run android --livereload
    // url: 'http://192.168.x.x:5173',  // use your machine's LAN IP, not localhost
    // cleartext: true,                  // needed for http:// on Android
    allowNavigation: [
      '*.supabase.co',
      'query1.finance.yahoo.com',
      '*.vercel.app',
    ],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0b0b14',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',               // dark text on light status bar
      backgroundColor: '#0b0b14',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },

  android: {
    allowMixedContent: false,       // only HTTPS in production
    captureInput: true,
    webContentsDebuggingEnabled: true,  // set false before publishing
  },

  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
