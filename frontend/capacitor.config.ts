/// <reference types="@capacitor-firebase/authentication" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.huaplay.app',
  appName: 'HuaPlay',
  webDir: 'dist-mobile',
  server: {
    androidScheme: 'https',
    hostname: 'huaplay.app',
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
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
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
