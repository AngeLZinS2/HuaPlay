import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';
import {
  type AppNotification,
  fetchNotificationFeed,
  getReadIds,
  saveReadIds,
  getStoredOptIn,
  setStoredOptIn,
  getStoredDeviceToken,
  setStoredDeviceToken,
  subscribeDeviceToken,
  unsubscribeDeviceToken,
  unregisterNativePush,
  deleteWebPushToken,
  registerNativePushWithTimeout,
  registerWebPushWithVapid,
  getVapidKey,
} from '../services/notifications';
import { sanitizeAppRoute } from '../utils/safeRoute';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  readIds: Set<number>;
  isLoading: boolean;
  isOptingIn: boolean;
  isSubscribed: boolean;
  hasPermission: boolean;
  isVapidConfigured: boolean;
  pushStatusMessage: string | null;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  refresh: () => Promise<void>;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 45000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, uid, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(() => getReadIds(uid));
  const [isLoading, setIsLoading] = useState(false);
  const [isOptingIn, setIsOptingIn] = useState(false);

  // Per-UID opt-in state confirmed from storage
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => getStoredOptIn(uid));
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  const vapidKey = getVapidKey();
  const isVapidConfigured = Boolean(
    vapidKey || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'),
  );

  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  const uidRef = useRef(uid);
  const isSubscribedRef = useRef(isSubscribed);
  const hasPermissionRef = useRef(hasPermission);

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    isSubscribedRef.current = isSubscribed;
  }, [isSubscribed]);

  useEffect(() => {
    hasPermissionRef.current = hasPermission;
  }, [hasPermission]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);

  const callbacksRef = useRef({
    onNotificationReceived: (notice: AppNotification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notice.id)) return prev;
        return [notice, ...prev].slice(0, 50);
      });
    },
    onNavigate: (route: string) => {
      const safe = sanitizeAppRoute(route);
      if (safe) {
        navigate(safe);
      }
    },
  });

  useEffect(() => {
    callbacksRef.current = {
      onNotificationReceived: (notice: AppNotification) => {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notice.id)) return prev;
          return [notice, ...prev].slice(0, 50);
        });
      },
      onNavigate: (route: string) => {
        const safe = sanitizeAppRoute(route);
        if (safe) {
          navigate(safe);
        }
      },
    };
  }, [navigate]);

  // Sync read state and subscription state when authenticated account changes
  useEffect(() => {
    setReadIds(getReadIds(uid));
    setIsSubscribed(getStoredOptIn(uid));
    setPushStatusMessage(null);
  }, [uid]);

  const loadFeed = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentGen = ++generationRef.current;

    try {
      setIsLoading(true);
      const items = await fetchNotificationFeed(controller.signal);
      if (currentGen === generationRef.current) {
        setNotifications(items.slice(0, 50));
      }
    } catch {
      // Ignore abort or network failure
    } finally {
      if (currentGen === generationRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Single visibility-aware polling lifecycle across entire app
  useEffect(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void loadFeed();
    }

    const startTimer = () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
      pollTimerRef.current = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void loadFeed();
        }
      }, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadFeed();
        startTimer();
      } else if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadFeed]);

  // 1. Persistent listeners attached ONCE on mount independent of opt-in/permission
  useEffect(() => {
    let disposed = false;
    const cleanups: (() => void)[] = [];

    // Native Android persistent listeners
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      void (async () => {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          if (disposed) return;

          // 1. Push notification received
          const hReceived = await PushNotifications.addListener('pushNotificationReceived', (push) => {
            const data = push.data || {};
            const notice: AppNotification = {
              id: Number(data.id || data.notification_id) || Date.now(),
              title: push.title || 'HuaPlay',
              message: push.body || '',
              image_url: (data.image_url || data.image) || null,
              action_url: data.action_url || null,
              created_at: new Date().toISOString(),
            };
            callbacksRef.current.onNotificationReceived(notice);
          });
          if (disposed) {
            void hReceived.remove();
            return;
          }
          cleanups.push(() => {
            void hReceived.remove();
          });

          // 2. Push notification clicked / action performed
          const hAction = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = action.notification?.data || {};
            callbacksRef.current.onNavigate(data.action_url);
          });
          if (disposed) {
            void hAction.remove();
            return;
          }
          cleanups.push(() => {
            void hAction.remove();
          });

          // 3. Persistent registration listener for token refresh
          const hReg = await PushNotifications.addListener('registration', (tokenData) => {
            const token = tokenData.value;
            setStoredDeviceToken(token);
            const currentUid = uidRef.current;
            const isOptedIn = isSubscribedRef.current;
            const hasPerm = hasPermissionRef.current;
            if (token && currentUid && isOptedIn && hasPerm) {
              void subscribeDeviceToken(token, 'android', currentUid);
            }
          });
          if (disposed) {
            void hReg.remove();
            return;
          }
          cleanups.push(() => {
            void hReg.remove();
          });
        } catch {
          // Non-blocking
        }
      })();
    }

    // Web SW postMessage foreground bridge listener
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'HUAPLAY_FOREGROUND_PUSH' && event.data.payload) {
          callbacksRef.current.onNotificationReceived(event.data.payload);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      cleanups.push(() => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      });
    }

    return () => {
      disposed = true;
      for (const fn of cleanups) fn();
    };
  }, []);

  // 2. Permission and subscription restore (separate effect on uid + isSubscribed)
  useEffect(() => {
    let disposed = false;

    async function restoreSubscription() {
      // Native Android restoration
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          if (disposed) return;

          // Check permissions WITHOUT prompt
          const perm = await PushNotifications.checkPermissions();
          if (disposed) return;

          const granted = perm.receive === 'granted';
          setHasPermission(granted);

          if (granted && uid && isSubscribed) {
            // Re-confirm token with backend if device token is stored
            const token = getStoredDeviceToken();
            if (token) {
              void subscribeDeviceToken(token, 'android', uid);
            }

            // Startup when already opted in: checkPermissions + register (no requestPermissions)
            await PushNotifications.register();
          } else if (!granted && uid && isSubscribed) {
            setStoredOptIn(false, uid);
            setIsSubscribed(false);
          }
        } catch {
          // Non-blocking
        }
      } else {
        // Web restoration
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const granted = Notification.permission === 'granted';
          setHasPermission(granted);

          if (granted && uid && isSubscribed) {
            const token = getStoredDeviceToken();
            if (token) {
              void subscribeDeviceToken(token, 'web', uid);
            }
          } else if (!granted && uid && isSubscribed) {
            setStoredOptIn(false, uid);
            setIsSubscribed(false);
          }
        }
      }
    }

    void restoreSubscription();

    return () => {
      disposed = true;
    };
  }, [uid, isSubscribed]);

  const markAsRead = useCallback(
    (id: number) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveReadIds(next, uid);
        return next;
      });
    },
    [uid],
  );

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) {
        next.add(n.id);
      }
      saveReadIds(next, uid);
      return next;
    });
  }, [notifications, uid]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  const enablePush = useCallback(async () => {
    if (!isAuthenticated || !user || !uid) {
      setPushStatusMessage('É necessário fazer login para ativar o push.');
      return;
    }

    setIsOptingIn(true);
    setPushStatusMessage(null);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await registerNativePushWithTimeout(uid);
        if (result.success) {
          setHasPermission(true);
          setIsSubscribed(true);
          setPushStatusMessage('Notificações push ativadas com sucesso!');
        } else {
          setPushStatusMessage(result.error || 'Permissão não concedida');
        }
      } else {
        if (!vapidKey) {
          setPushStatusMessage('Web push requer configuração da chave VAPID no servidor.');
          setIsOptingIn(false);
          return;
        }

        const result = await registerWebPushWithVapid(vapidKey, uid);
        if (result.success) {
          setHasPermission(true);
          setIsSubscribed(true);
          setPushStatusMessage('Notificações push ativadas no navegador!');
        } else {
          setPushStatusMessage(result.error || 'Permissão não concedida');
        }
      }
    } catch (err) {
      setPushStatusMessage((err as Error).message || 'Falha ao ativar notificações');
    } finally {
      setIsOptingIn(false);
    }
  }, [isAuthenticated, user, uid, vapidKey]);

  const disablePush = useCallback(async () => {
    const token = getStoredDeviceToken();
    if (token) {
      try {
        await unsubscribeDeviceToken(token);
      } catch {
        setPushStatusMessage('Falha ao desativar notificações no servidor. Tente novamente.');
        return;
      }
    }

    if (Capacitor.isNativePlatform()) {
      await unregisterNativePush();
    } else {
      await deleteWebPushToken();
    }

    setStoredDeviceToken(null);
    setStoredOptIn(false, uid);
    setIsSubscribed(false);
    setPushStatusMessage('Notificações push desativadas.');
  }, [uid]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        readIds,
        isLoading,
        isOptingIn,
        isSubscribed,
        hasPermission,
        isVapidConfigured,
        pushStatusMessage,
        markAsRead,
        markAllAsRead,
        refresh: loadFeed,
        enablePush,
        disablePush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
