package com.huaplay.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // ── Status & Navigation bar: pure black (MIUI, ColorOS, OxygenOS) ──
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);
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
