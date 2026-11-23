import { Capacitor } from '@capacitor/core';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type PlatformKind = 'android-apk' | 'android-web' | 'ios' | 'desktop';
export type InstallTab = 'android' | 'apple' | 'desktop';

export interface ApkReleaseInfo {
  versionName: string;
  apkUrl: string;
}

export const FALLBACK_APK_INFO: ApkReleaseInfo = {
  versionName: '1.0.12',
  apkUrl: 'https://huaplay.playdb.info/downloads/huaplay/HuaPlay-1.0.12.apk',
};

const REMOTE_VERSION_URL = 'https://huaplay.playdb.info/mobile/version.json';
const LOCAL_VERSION_URL = '/mobile/version.json';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedInSession = false;
let initialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function initPwaInstallCapture(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedInSession = true;
    notifyListeners();
  });
}

export function subscribePwaInstall(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function isPwaInstalledInSession(): boolean {
  return installedInSession;
}

export async function triggerPwaInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notifyListeners();
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      installedInSession = true;
      notifyListeners();
    }
    return outcome;
  } catch {
    return 'dismissed';
  }
}

export function isNativeCapacitorApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeCapacitorApp()) return false;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

export function detectPlatform(): PlatformKind {
  if (isNativeCapacitorApp()) {
    return 'android-apk';
  }
  if (typeof navigator === 'undefined') return 'desktop';

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  const isIos =
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);

  if (isIos) return 'ios';
  if (/Android/i.test(ua)) return 'android-web';
  return 'desktop';
}

export function getRecommendedInstallTab(platform: PlatformKind): InstallTab {
  if (platform === 'ios') return 'apple';
  if (platform === 'desktop') return 'desktop';
  return 'android';
}

function isSafeApkUrl(urlStr: unknown): urlStr is string {
  if (typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.origin !== 'https://huaplay.playdb.info') return false;
    if (!parsed.pathname.startsWith('/downloads/huaplay/') || !parsed.pathname.endsWith('.apk')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

let cachedRelease: ApkReleaseInfo | null = null;

export async function fetchLatestApkRelease(signal?: AbortSignal): Promise<ApkReleaseInfo> {
  if (cachedRelease) return cachedRelease;

  const urls = isNativeCapacitorApp()
    ? [REMOTE_VERSION_URL]
    : [LOCAL_VERSION_URL, REMOTE_VERSION_URL];

  for (const url of urls) {
    try {
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (!response.ok) continue;
      const data = (await response.json()) as Record<string, unknown>;
      if (isSafeApkUrl(data.apkUrl)) {
        const versionName =
          typeof data.versionName === 'string' && data.versionName.trim().length > 0
            ? data.versionName.trim()
            : FALLBACK_APK_INFO.versionName;
        cachedRelease = {
          versionName,
          apkUrl: data.apkUrl,
        };
        return cachedRelease;
      }
    } catch {
      if (signal?.aborted) break;
    }
  }

  return FALLBACK_APK_INFO;
}
