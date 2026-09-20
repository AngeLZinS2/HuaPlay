package com.huaplay.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.WindowManager;
import android.view.Window;
import android.graphics.Color;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── Status & Navigation bar: pure black (MIUI, ColorOS, OxygenOS) ──
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);

        // ── Keep screen on during video playback ──
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // ── WebView performance tuning for all custom ROMs ──
        tuneWebView();
    }

    private void tuneWebView() {
        // Access the Capacitor WebView after bridge is initialized
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();

            // Hardware acceleration (critical for OPPO ColorOS and Xiaomi MIUI)
            webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

            // Rendering optimizations
            settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);

            // Enable DOM storage (prevents crashes on Xiaomi devices)
            settings.setDomStorageEnabled(true);

            // Database storage (needed for some app features)
            settings.setDatabaseEnabled(true);

            // Media playback without user gesture (inline video)
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Allow mixed content (HTTP + HTTPS) for local backend on custom ROMs
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }

            // Enable zoom controls
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);

            // Viewport fitting (prevents layout issues on MIUI notch/punch-hole displays)
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);

            // Text encoding
            settings.setDefaultTextEncodingName("UTF-8");

            // Reduce memory pressure on low-end devices
            settings.setLoadsImagesAutomatically(true);
            settings.setBlockNetworkImage(false);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply flags when app comes back from background
        // (MIUI aggressively clears these on resume)
        Window window = getWindow();
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);
    }
}
