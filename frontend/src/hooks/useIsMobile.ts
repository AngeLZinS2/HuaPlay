import { useSyncExternalStore } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

let mql: MediaQueryList | null = null;
const listeners = new Set<() => void>();

function getMediaQueryList(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }
    if (!mql) {
        mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    }
    return mql;
}

function handleMediaChange() {
    listeners.forEach((callback) => callback());
}

function subscribe(callback: () => void): () => void {
    listeners.add(callback);

    if (listeners.size === 1) {
        const media = getMediaQueryList();
        if (media) {
            if (typeof media.addEventListener === 'function') {
                media.addEventListener('change', handleMediaChange);
            } else {
                const legacyMedia = media as unknown as { addListener?: (cb: () => void) => void };
                legacyMedia.addListener?.(handleMediaChange);
            }
        }
    }

    return () => {
        listeners.delete(callback);
        if (listeners.size === 0) {
            const media = getMediaQueryList();
            if (media) {
                if (typeof media.removeEventListener === 'function') {
                    media.removeEventListener('change', handleMediaChange);
                } else {
                    const legacyMedia = media as unknown as { removeListener?: (cb: () => void) => void };
                    legacyMedia.removeListener?.(handleMediaChange);
                }
            }
        }
    };
}

function getSnapshot(): boolean {
    const media = getMediaQueryList();
    return media ? media.matches : false;
}

function getServerSnapshot(): boolean {
    return false;
}

export function useIsMobile(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useIsMobile;
