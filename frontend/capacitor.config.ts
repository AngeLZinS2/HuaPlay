import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.huaplay.app',
  appName: 'HuaPlay',
  webDir: 'dist',
  server: {
    // For local network development (PC and phone on same Wi-Fi)
    // Change to your production URL before distributing
    // url: 'https://your-production-server.com',
    androidScheme: 'https',
    cleartext: true, // Allow HTTP for local dev backend
    // Hostname override helps MIUI/ColorOS avoid treating the app as a browser
    hostname: 'huaplay.app',
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,       // Allow HTTP + HTTPS (needed for local dev)
    captureInput: true,
    webContentsDebuggingEnabled: false, // Disable in production for security
    // Prevent MIUI/ColorOS battery saver from throttling the WebView
    initialFocus: true,
    // Use hardware-accelerated renderer
    useLegacyBridge: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      // Prevent white flash during splash (MIUI/ColorOS issue)
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
