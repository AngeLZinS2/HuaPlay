/**
 * Scoped Firebase Cloud Messaging Service Worker for HuaPlay.
 *
 * Dedicated to handling background push notifications and bridging foreground
 * push events via postMessage without stealing VitePWA's offline caching scope.
 */

const TRUSTED_ORIGINS = new Set([
  'https://huaplay.playdb.info',
  'https://huaplay.app',
]);

function sanitizeNotificationUrl(rawUrl, baseOrigin) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/';
  const trimmed = rawUrl.trim();
  if (trimmed.includes('\\') || /[\r\n\t\x00-\x1f\x7f]/i.test(trimmed)) {
    return '/';
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, baseOrigin);
    const origin = parsed.origin.toLowerCase();
    if (origin === baseOrigin.toLowerCase() || TRUSTED_ORIGINS.has(origin)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    }
  } catch {
    // Ignore invalid URLs
  }
  return '/';
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      notification: {
        title: 'HuaPlay',
        body: event.data.text(),
      },
    };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'HuaPlay';
  const body = notification.body || data.message || '';
  const icon = notification.image || '/sakura.png';
  const rawAction = data.action_url || notification.click_action || '/';
  const notifId = data.id || data.notification_id || String(Date.now());

  const options = {
    body,
    icon,
    badge: '/sakura.png',
    data: {
      action_url: rawAction,
      id: notifId,
    },
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      let isVisibleClientFound = false;

      // Broadcast to active clients for in-app foreground handling
      for (const client of clientList) {
        client.postMessage({
          type: 'HUAPLAY_FOREGROUND_PUSH',
          payload: {
            id: Number(notifId) || Date.now(),
            title,
            message: body,
            action_url: rawAction,
            created_at: new Date().toISOString(),
          },
        });
        if (client.visibilityState === 'visible') {
          isVisibleClientFound = true;
        }
      }

      // If no visible window client is currently focused, display system notification
      if (!isVisibleClientFound) {
        return self.registration.showNotification(title, options);
      }
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.action_url;
  const safePath = sanitizeNotificationUrl(rawUrl, self.location.origin);
  const destinationUrl = new URL(safePath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(destinationUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }
    }),
  );
});
