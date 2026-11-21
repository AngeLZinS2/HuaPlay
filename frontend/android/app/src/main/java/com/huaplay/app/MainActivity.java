package com.huaplay.app;

import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    private FrameLayout fullscreenContainer;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private OnBackPressedCallback fullscreenBackCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        applySystemBarColors();
        installFullscreenWebChromeClient();

        fullscreenBackCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                exitCustomViewFullscreen();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, fullscreenBackCallback);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply flags when app comes back from background
        // (MIUI/ColorOS aggressively clears these on resume)
        if (customView != null) {
            setImmersiveSystemBars(true);
        } else {
            applySystemBarColors();
        }
    }

    @Override
    public void onDestroy() {
        exitCustomViewFullscreen();
        super.onDestroy();
    }

    private void applySystemBarColors() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);
    }

    private void setImmersiveSystemBars(boolean hidden) {
        Window window = getWindow();
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller == null) return;
        if (hidden) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }

    private void enterCustomViewFullscreen(View view, WebChromeClient.CustomViewCallback callback) {
        if (customView != null) {
            if (callback != null) {
                callback.onCustomViewHidden();
            }
            return;
        }

        customView = view;
        customViewCallback = callback;

        ViewGroup decorView = (ViewGroup) getWindow().getDecorView();
        fullscreenContainer = new FrameLayout(this);
        fullscreenContainer.setBackgroundColor(Color.BLACK);
        fullscreenContainer.addView(
            view,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        decorView.addView(
            fullscreenContainer,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        setImmersiveSystemBars(true);

        if (fullscreenBackCallback != null) {
            fullscreenBackCallback.setEnabled(true);
        }
    }

    private void exitCustomViewFullscreen() {
        if (customView == null) {
            return;
        }

        if (fullscreenBackCallback != null) {
            fullscreenBackCallback.setEnabled(false);
        }

        ViewGroup decorView = (ViewGroup) getWindow().getDecorView();
        if (fullscreenContainer != null) {
            fullscreenContainer.removeAllViews();
            decorView.removeView(fullscreenContainer);
            fullscreenContainer = null;
        }

        customView = null;
        if (customViewCallback != null) {
            WebChromeClient.CustomViewCallback cb = customViewCallback;
            customViewCallback = null;
            cb.onCustomViewHidden();
        }

        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setImmersiveSystemBars(false);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
        applySystemBarColors();
    }

    private void installFullscreenWebChromeClient() {
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;

        // Capacitor's default BridgeWebChromeClient immediately dismisses HTML5/iframe
        // fullscreen via callback.onCustomViewHidden(). Subclassing keeps all Capacitor
        // file-picker/permission handlers intact while enabling real landscape fullscreen.
        webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                runOnUiThread(() -> enterCustomViewFullscreen(view, callback));
            }

            @Override
            public void onHideCustomView() {
                runOnUiThread(MainActivity.this::exitCustomViewFullscreen);
            }
        });
    }
}
