/**
 * Notification Service for HuaPlay.
 *
 * Implements:
 * - Public in-app feed fetching with AbortController support.
 * - Account-scoped read state and per-UID opt-in state.
 * - Authenticated token subscription and unsubscription.
 * - VAPID key reading from VITE_FIREBASE_VAPID_KEY.
 * - Native push registration with Promise timeout and proper listener lifecycle.
 */

import { Capacitor } from '@capacitor/core';
import api from './api';
import { app } from './firebase';
import {
  setStoredDeviceToken,
  setStoredOptIn,
} from './notificationStorage';

export * from './notificationStorage';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  image_url?: string | null;
  action_url?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export function getPlatformName(): 'android' | 'web' {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return 'android';
  }
  return 'web';
}

export function getVapidKey(): string | undefined {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
}

export async function fetchNotificationFeed(signal?: AbortSignal): Promise<AppNotification[]> {
  const platform = getPlatformName();
  const resp = await api.get<AppNotification[]>('/notifications/feed', {
    params: { platform, limit: 50 },
    signal,
  });
  return resp.data || [];
}

// ─── Subscription Dedup Cache ───────────────────────────────────────────────
const inFlightSubscriptions = new Map<string, Promise<void>>();
let lastSubscribedKey: string | null = null;

export function resetSubscriptionDedupCache(): void {
  inFlightSubscriptions.clear();
  lastSubscribedKey = null;
}

export async function subscribeDeviceToken(
  token: string,
  platform: 'web' | 'android',
  uid?: string | null,
  signal?: AbortSignal,
): Promise<void> {
  const effectiveUid = uid || 'current';
  const key = `${effectiveUid}:${platform}:${token}`;

  // If already subscribed this exact token for this user in this session, skip redundant HTTP call
  if (lastSubscribedKey === key) {
    setStoredDeviceToken(token);
    return;
  }

  // Deduplicate concurrent in-flight requests for same key (e.g. persistent listener + temporary callback)
  const existing = inFlightSubscriptions.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      await api.post('/notifications/subscribe', { token, platform }, { signal });
      setStoredDeviceToken(token);
      lastSubscribedKey = key;
    } finally {
      inFlightSubscriptions.delete(key);
    }
  })();

  inFlightSubscriptions.set(key, promise);
  return promise;
}

export async function unsubscribeDeviceToken(token: string): Promise<void> {
  resetSubscriptionDedupCache();
  await api.post('/notifications/unsubscribe', { token });
  setStoredDeviceToken(null);
}

export async function unregisterNativePush(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.unregister();
    } catch {
      // Non-blocking
    }
  }
}

export async function deleteWebPushToken(): Promise<void> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const { getMessaging, deleteToken } = await import('firebase/messaging');
      const messaging = getMessaging(app);
      await deleteToken(messaging);
    } catch {
      // Non-blocking
    }
  }
}

// ─── Native Registration (Capacitor 8) with Timeout ─────────────────────────

export async function registerNativePushWithTimeout(
  uid?: string | null,
  timeoutMs = 12000,
  callerSignal?: AbortSignal,
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'Dispositivo nativo não detectado' };
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permResult = await PushNotifications.requestPermissions();

    if (permResult.receive !== 'granted') {
      return { success: false, error: 'Permissão de notificação negada nas configurações do Android.' };
    }

    return await new Promise<{ success: boolean; token?: string; error?: string }>((resolve) => {
      let settled = false;
      let regHandle: { remove: () => Promise<void> } | null = null;
      let errHandle: { remove: () => Promise<void> } | null = null;
      const internalAbort = new AbortController();

      const cleanupHandles = async () => {
        const toRemove: Promise<void>[] = [];
        if (regHandle) {
          toRemove.push(regHandle.remove().catch(() => {
            // Non-blocking
          }));
          regHandle = null;
        }
        if (errHandle) {
          toRemove.push(errHandle.remove().catch(() => {
            // Non-blocking
          }));
          errHandle = null;
        }
        if (toRemove.length > 0) {
          await Promise.allSettled(toRemove);
        }
      };

      const finish = async (res: { success: boolean; token?: string; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        internalAbort.abort();
        await cleanupHandles();
        resolve(res);
      };

      const timer = setTimeout(() => {
        void finish({ success: false, error: 'Tempo limite ao aguardar registro do token FCM nativo.' });
      }, timeoutMs);

      // Handle external caller abort signal (e.g. unmount during registration)
      if (callerSignal) {
        if (callerSignal.aborted) {
          void finish({ success: false, error: 'Inscrição cancelada antes do registro.' });
          return;
        }
        callerSignal.addEventListener('abort', () => {
          void finish({ success: false, error: 'Inscrição cancelada pelo chamador.' });
        }, { once: true });
      }

      // Await addListener handle registration BEFORE calling register
      void (async () => {
        try {
          const h1 = await PushNotifications.addListener('registration', async (token) => {
            if (settled) return; // Late callback cannot subscribe after timeout
            try {
              await subscribeDeviceToken(token.value, 'android', uid, internalAbort.signal);
              if (settled) return;
              setStoredOptIn(true, uid);
              await finish({ success: true, token: token.value });
            } catch (err) {
              if (settled) return;
              await finish({ success: false, error: (err as Error).message });
            }
          });

          // Immediately after EACH awaited handle, if settled remove handle and return
          if (settled) {
            try {
              await h1.remove();
            } catch {
              // Non-blocking
            }
            return;
          }
          regHandle = h1;

          const h2 = await PushNotifications.addListener('registrationError', async (err) => {
            if (settled) return;
            await finish({ success: false, error: JSON.stringify(err) });
          });

          // Immediately after EACH awaited handle, if settled remove handle and return
          if (settled) {
            try {
              await h2.remove();
            } catch {
              // Non-blocking
            }
            await cleanupHandles();
            return;
          }
          errHandle = h2;

          if (settled) {
            await cleanupHandles();
            return;
          }

          // Handle register promise rejection
          await PushNotifications.register();
        } catch (err) {
          await finish({ success: false, error: (err as Error).message });
        }
      })();
    });
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Web Registration (Firebase Messaging) ──────────────────────────────────

export async function registerWebPushWithVapid(
  vapidKey?: string,
  uid?: string | null,
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, error: 'Navegador não suporta notificações Web Push' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Permissão de notificação negada no navegador.' };
  }

  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) {
      return { success: false, error: 'FCM não suportado neste navegador' };
    }

    const messaging = getMessaging(app);
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });

    const tokenOptions: { serviceWorkerRegistration: ServiceWorkerRegistration; vapidKey?: string } = {
      serviceWorkerRegistration: swRegistration,
    };
    if (vapidKey) {
      tokenOptions.vapidKey = vapidKey;
    }

    const token = await getToken(messaging, tokenOptions);
    if (!token) {
      return { success: false, error: 'Não foi possível gerar token de registro FCM.' };
    }

    await subscribeDeviceToken(token, 'web', uid);
    setStoredOptIn(true, uid);
    return { success: true, token };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
