/**
 * Bounded Local Storage Management for HuaPlay Notifications.
 *
 * Scopes read state and opt-in by authenticated account UID and bounds storage to max 150 IDs.
 */

const MAX_STORED_READ_IDS = 150;
const TOKEN_STORAGE_KEY = 'huaplay_device_token';

function getStorageKey(uid?: string | null): string {
  return `huaplay_read_notifications_${uid || 'guest'}`;
}

function getOptInStorageKey(uid?: string | null): string {
  return `huaplay_push_opted_in_${uid || 'guest'}`;
}

export function getReadIds(uid?: string | null): Set<number> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sanitized = parsed
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
      return new Set(sanitized.slice(-MAX_STORED_READ_IDS));
    }
  } catch {
    // Non-blocking
  }
  return new Set();
}

export function saveReadIds(ids: Set<number>, uid?: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const sanitized = Array.from(ids)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(-MAX_STORED_READ_IDS);
    localStorage.setItem(getStorageKey(uid), JSON.stringify(sanitized));
  } catch {
    // Non-blocking
  }
}

export function getStoredDeviceToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredDeviceToken(token: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Non-blocking
  }
}

export function getStoredOptIn(uid?: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined' || !uid) return false;
    return localStorage.getItem(getOptInStorageKey(uid)) === 'true';
  } catch {
    return false;
  }
}

export function setStoredOptIn(enabled: boolean, uid?: string | null): void {
  try {
    if (typeof localStorage === 'undefined' || !uid) return;
    const key = getOptInStorageKey(uid);
    if (enabled) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Non-blocking
  }
}

const AUTO_PROMPT_KEY = 'huaplay_push_auto_prompted_once';
const EXPLICIT_DISABLED_KEY = 'huaplay_push_explicitly_disabled';

export function isAutoPromptDone(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(AUTO_PROMPT_KEY) === 'true';
  } catch {
    return true;
  }
}

export function setAutoPromptDone(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AUTO_PROMPT_KEY, 'true');
  } catch {
    // Non-blocking
  }
}

export function isExplicitlyDisabled(uid?: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(EXPLICIT_DISABLED_KEY) === 'true') return true;
    if (uid && localStorage.getItem(`${EXPLICIT_DISABLED_KEY}_${uid}`) === 'true') return true;
    return false;
  } catch {
    return false;
  }
}

export function setExplicitlyDisabled(disabled: boolean, uid?: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (disabled) {
      localStorage.setItem(EXPLICIT_DISABLED_KEY, 'true');
      if (uid) localStorage.setItem(`${EXPLICIT_DISABLED_KEY}_${uid}`, 'true');
    } else {
      localStorage.removeItem(EXPLICIT_DISABLED_KEY);
      if (uid) localStorage.removeItem(`${EXPLICIT_DISABLED_KEY}_${uid}`);
    }
  } catch {
    // Non-blocking
  }
}
