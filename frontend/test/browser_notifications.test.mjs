import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const harnessPath = path.resolve(__dirname, 'fixtures/browser_harness.tsx');
const mockAuthPath = path.resolve(__dirname, 'fixtures/mock_auth.tsx');
const mockMessagingPath = path.resolve(__dirname, 'fixtures/mock_messaging.ts');
const mockPushPath = path.resolve(__dirname, 'fixtures/mock_push_notifications.ts');

let bundledJs = '';

test.before(async () => {
  const result = await esbuild.build({
    entryPoints: [harnessPath],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: {
      'import.meta.env.VITE_API_URL': '"http://localhost:8000"',
      'import.meta.env.VITE_FIREBASE_VAPID_KEY': '"TEST_VAPID_KEY_PUBLIC_123"',
      'import.meta.env.MODE': '"development"',
      'process.env.NODE_ENV': '"development"',
    },
    plugins: [
      {
        name: 'mock-auth-resolver',
        setup(build) {
          build.onResolve({ filter: /AuthContext/ }, () => ({
            path: mockAuthPath,
          }));
          build.onResolve({ filter: /^firebase\/messaging$/ }, () => ({
            path: mockMessagingPath,
          }));
          build.onResolve({ filter: /^@capacitor\/push-notifications$/ }, () => ({
            path: mockPushPath,
          }));
        },
      },
    ],
  });

  bundledJs = result.outputFiles[0].text;
});

test('Browser Lifecycle: two Navbar bells share ONE feed, no permission on startup', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();

    let feedRequestCount = 0;
    await page.route('**/notifications/feed*', async (route) => {
      feedRequestCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 42,
            title: 'Episódio 10 HuaPlay',
            message: 'Novo episódio lançado com legendas em PT-BR!',
            action_url: '/series/42',
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.setContent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body style="margin:0; background:#000;">
  <div id="root"></div>
  <script>
    window.__permCalls = 0;
    window.Notification = {
      permission: 'default',
      requestPermission: async function() {
        window.__permCalls++;
        return 'granted';
      }
    };
  </script>
  <script>${bundledJs}</script>
</body>
</html>`);

    await page.waitForSelector('#desktop-bar');

    // Verify exactly ONE feed request occurred for both bells
    await page.waitForTimeout(500);
    assert.equal(feedRequestCount, 1, 'Two Navbar bells must share ONE single feed request');

    // Verify Notification.requestPermission was NOT called on startup
    const permCalls = await page.evaluate(() => window.__permCalls);
    assert.equal(permCalls, 0, 'No permission prompts allowed on app startup');

    // Verify badge displays '1' on both bells
    const badges = await page.locator('span:has-text("1")').count();
    assert.ok(badges >= 1, 'Unread badge should display for notices');
  } finally {
    await browser.close();
  }
});

test('Browser Lifecycle: viewport 320 panel strictly inside bounds without overflow & Escape close', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Test narrow 320px mobile viewport
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();

    await page.route('**/notifications/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 42,
            title: 'Episódio 10 HuaPlay',
            message: 'Novo episódio lançado com legendas em PT-BR!',
            action_url: '/series/42',
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.setContent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Test</title></head>
<body style="margin:0; background:#000; overflow-x:hidden;">
  <div id="root"></div>
  <script>${bundledJs}</script>
</body>
</html>`);

    await page.waitForSelector('.bell-mobile');

    // Open mobile bell panel
    await page.locator('.bell-mobile').click();

    const dialog = page.locator('div[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });

    const box = await dialog.boundingBox();
    assert.ok(box, 'Notification panel dialog must be visible');

    // Assert panel is strictly inside 320px viewport without horizontal overflow
    assert.ok(box.x >= 0, `Panel left bound (${box.x}) must be >= 0`);
    assert.ok(
      box.x + box.width <= 320,
      `Panel right bound (${box.x + box.width}) must not exceed 320px viewport`,
    );

    // Assert escape key closes panel
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    const isVisible = await dialog.isVisible();
    assert.equal(isVisible, false, 'Escape key must close the dialog panel');
  } finally {
    await browser.close();
  }
});

test('Browser Lifecycle: successful subscription requires opt-in & disable push unregisters', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    page.on('console', (msg) => console.log('PAGE LOG 3:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR 3:', err));

    await page.route('**/notifications/feed*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    let subscribeCalls = 0;
    await page.route('**/notifications/subscribe', async (route) => {
      subscribeCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, registered: true }),
      });
    });

    let unsubscribeCalls = 0;
    await page.route('**/notifications/unsubscribe', async (route) => {
      unsubscribeCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, unsubscribed: true }),
      });
    });

    await page.setContent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body style="margin:0; background:#000;">
  <div id="root"></div>
  <script>
    try {
      window.localStorage.getItem('test');
    } catch (e) {
      const _store = new Map();
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: function(k) { return _store.has(k) ? _store.get(k) : null; },
          setItem: function(k, v) { _store.set(k, String(v)); },
          removeItem: function(k) { _store.delete(k); },
          clear: function() { _store.clear(); },
          key: function(i) { return Array.from(_store.keys())[i] || null; },
          get length() { return _store.size; }
        },
        configurable: true
      });
    }
    window.__permRequested = false;
    window.Notification = {
      permission: 'default',
      requestPermission: async function() {
        window.__permRequested = true;
        window.Notification.permission = 'granted';
        return 'granted';
      }
    };
    if (!('serviceWorker' in navigator)) {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: async () => ({
            scope: '/firebase-cloud-messaging-push-scope',
            active: true
          }),
          addEventListener: () => {},
          removeEventListener: () => {}
        },
        configurable: true
      });
    }
  </script>
  <script>${bundledJs}</script>
</body>
</html>`);

    await page.waitForSelector('.bell-desktop');
    await page.locator('.bell-desktop').click();

    const dialog = page.locator('div[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });

    // Initial state: opt-in button "Ativar" is visible
    const activateBtn = dialog.locator('button:has-text("Ativar")');
    await activateBtn.waitFor({ state: 'visible' });

    // Click opt-in
    await activateBtn.click();

    // Verify permission requested on click
    await page.waitForTimeout(300);
    const permRequested = await page.evaluate(() => window.__permRequested);
    assert.equal(permRequested, true, 'Permission must be requested upon opt-in click');

    // Verify backend subscribe was called with token
    assert.equal(subscribeCalls, 1, 'Backend subscribe endpoint must be called');

    // UI should now reflect active push and display "Desativar" button
    const deactivateBtn = dialog.locator('button:has-text("Desativar")');
    await deactivateBtn.waitFor({ state: 'visible' });
    const activeText = await dialog.locator('text=Push ativado no dispositivo').count();
    assert.ok(activeText >= 1, 'UI must show active push badge');

    // Click "Desativar"
    await deactivateBtn.click();
    await page.waitForTimeout(500);

    // Verify backend unsubscribe was called
    assert.equal(unsubscribeCalls, 1, 'Backend unsubscribe endpoint must be called');

    // UI should switch back to "Ativar" button
    await activateBtn.waitFor({ state: 'visible' });
  } finally {
    await browser.close();
  }
});

test('Native Lifecycle: timeout cancels pending registration, cleans up listeners & blocks late callbacks', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    let subscribeCalls = 0;
    await page.route('**/notifications/subscribe', async (route) => {
      subscribeCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, registered: true }),
      });
    });

    await page.setContent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body style="margin:0; background:#000;">
  <div id="root"></div>
  <script>
    // Simulate Capacitor Android native environment detected via androidBridge
    window.androidBridge = {};
    window.__HuaPlaySkipRender = true;
  </script>
  <script>${bundledJs}</script>
</body>
</html>`);

    await page.waitForFunction(() => window.__HuaPlayTest !== undefined);

    const result = await page.evaluate(async () => {
      const testHarness = window.__HuaPlayTest;
      testHarness.resetMockState();
      // Configure mock to simulate timeout (never trigger registration callback before timeout)
      testHarness.mockState.simulateTimeout = true;

      // Call registerNativePushWithTimeout with a small 60ms timeout for test speed
      const res = await testHarness.registerNativePushWithTimeout('test_uid_timeout', 60);

      // Verify that after timeout, both temporary listeners ('registration' and 'registrationError') are cleaned up
      const removedCount = testHarness.mockState.listenersRemovedCount;

      // Simulate a late registration callback arriving after timeout
      const lateReg = testHarness.mockState.listenersAdded.find((l) => l.event === 'registration');
      if (lateReg) {
        lateReg.callback({ value: 'late_token_after_timeout_123' });
      }

      return { res, removedCount };
    });

    // Verify timeout error was returned
    assert.equal(result.res.success, false);
    assert.ok(result.res.error.includes('Tempo limite'));

    // Verify temporary listeners were removed exactly once
    assert.equal(result.removedCount, 2, 'Both temporary listeners must be removed on timeout');

    // Wait a brief moment to confirm late callback did NOT trigger backend subscribe
    await page.waitForTimeout(200);
    assert.equal(subscribeCalls, 0, 'Late callback after timeout must not subscribe backend');
  } finally {
    await browser.close();
  }
});

test('Native Lifecycle: initial opt-in receives push & handles click WITHOUT reload', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    let subscribeCalls = 0;
    await page.route('**/notifications/feed*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/notifications/subscribe', async (route) => {
      subscribeCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, registered: true }),
      });
    });

    await page.route('http://localhost:8000/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body style="margin:0; background:#000;">
  <div id="root"></div>
  <script>
    // Simulate Capacitor Android native environment detected via androidBridge
    window.androidBridge = {};
  </script>
  <script>${bundledJs}</script>
</body>
</html>`,
      });
    });

    await page.goto('http://localhost:8000/');

    await page.waitForFunction(() => window.__HuaPlayTest !== undefined);

    // Initial state: bell is present, user opens panel
    await page.waitForSelector('.bell-desktop');
    await page.locator('.bell-desktop').click();

    const dialog = page.locator('div[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });

    // Click "Ativar" for initial opt-in
    const activateBtn = dialog.locator('button:has-text("Ativar")');
    await activateBtn.waitFor({ state: 'visible' });
    await activateBtn.click();

    // Verify push activated badge appears
    await dialog.locator('text=Push ativado no dispositivo').waitFor({ state: 'visible' });

    // Verify deduplicated subscribe call occurred exactly once
    assert.equal(subscribeCalls, 1, 'First opt-in must call backend subscribe exactly once');

    // WITHOUT reloading the page, simulate push notification received
    await page.evaluate(() => {
      window.__HuaPlayTest.triggerPushReceived({
        title: 'Episódio 100 HuaPlay',
        body: 'Episódio recém-lançado com legendas em PT-BR!',
        data: {
          id: 100,
          action_url: '/series/100',
        },
      });
    });

    // Verify notice appears in the panel without reload
    await dialog.locator('text=Episódio 100 HuaPlay').waitFor({ state: 'visible' });

    // WITHOUT reloading the page, simulate notification click action
    await page.evaluate(() => {
      window.__HuaPlayTest.triggerPushAction({
        notification: {
          data: {
            action_url: '/series/100',
          },
        },
      });
    });

    await page.waitForTimeout(200);
    const pathname = await page.evaluate(() => window.location.pathname);
    assert.equal(pathname, '/series/100', 'Clicking push notification must navigate to action_url without reload');
  } finally {
    await browser.close();
  }
});

test('Native Lifecycle: late addListener resolution after mount/timeout is cleaned up without register', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body style="margin:0; background:#000;">
  <div id="root"></div>
  <script>
    window.androidBridge = {};
  </script>
  <script>${bundledJs}</script>
</body>
</html>`);

    await page.waitForFunction(() => window.__HuaPlayTest !== undefined);

    const result = await page.evaluate(async () => {
      const testHarness = window.__HuaPlayTest;
      testHarness.resetMockState();
      // Configure addListener to delay resolution by 80ms, while timeout is set to 20ms
      testHarness.mockState.addListenerDelayMs = 80;

      const res = await testHarness.registerNativePushWithTimeout('user_late_test', 20);

      // Wait 120ms to allow delayed addListener to finish resolving late
      await new Promise((r) => setTimeout(r, 120));

      return {
        res,
        registerCalls: testHarness.mockState.registerCalls,
        removedCount: testHarness.mockState.listenersRemovedCount,
      };
    });

    // Verify registration timed out
    assert.equal(result.res.success, false);
    assert.ok(result.res.error.includes('Tempo limite'));

    // Verify PushNotifications.register was NEVER called after timeout
    assert.equal(result.registerCalls, 0, 'Late addListener must not call register after timeout');

    // Verify late handle was removed immediately upon resolution
    assert.ok(result.removedCount >= 1, 'Late resolving handle must be cleaned up immediately');
  } finally {
    await browser.close();
  }
});
