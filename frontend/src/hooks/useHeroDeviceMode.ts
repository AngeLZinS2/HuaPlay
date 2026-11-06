import { useSyncExternalStore } from 'react';

export type HeroDeviceMode = 'phone' | 'tablet-fold' | 'desktop';

/**
 * Hook dedicado que classifica o dispositivo em 3 modos de exibição do Hero:
 * - 'phone': smartphone convencional ou tela externa/fechada do Fold (menor dimensão < 550 em touch/coarse, inclusive landscape).
 * - 'tablet-fold': Fold aberto (ex: 744x860, 860x744) e tablets Android / iPads (retrato e paisagem).
 * - 'desktop': desktop ou notebook tradicional com ponteiro fino e hover, inclusive janela redimensionada ou touchscreen com primary fine.
 */
export function getHeroDeviceMode(): HeroDeviceMode {
    if (typeof window === 'undefined') {
        return 'desktop';
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const minDim = Math.min(width, height);

    // Detecção suplementar de iPad (iPadOS 13+ mascara como MacIntel com touch points > 1)
    const isIPad =
        (navigator.platform === 'MacIntel' || navigator.userAgent?.includes('iPad')) &&
        (navigator.maxTouchPoints || 0) > 1;

    const hasCoarse = window.matchMedia('(pointer: coarse)').matches;
    const hasFine = window.matchMedia('(pointer: fine)').matches;
    const canHover = window.matchMedia('(hover: hover)').matches;

    // Regra 1: Menor dimensão < 550 força phone em dispositivos touch/coarse, inclusive landscape 844x390.
    if (minDim < 550 && (hasCoarse || isIPad || !canHover)) {
        return 'phone';
    }

    // Regra 2: iPad com menor dimensão >= 550 é sempre tablet-fold (mesmo quando conectado ao Magic Keyboard/trackpad onde canHover ou fine podem ser reportados).
    if (isIPad && minDim >= 550) {
        return 'tablet-fold';
    }

    // Regra 3: Ponteiro fino + hover desktop permanece desktop, inclusive janela 744x860 e notebook 1366x768 touchscreen com primary fine.
    if (hasFine && canHover && !isIPad) {
        return 'desktop';
    }

    // Regra 4: Touch principal coarse / hover none com menor dimensão >= 550 => tablet-fold (744x860, 860x744, 600x960, 768x1024, etc.).
    if ((hasCoarse || !canHover) && minDim >= 550) {
        return 'tablet-fold';
    }

    // Fallback por dimensões caso a API de ponteiro não retorne dados precisos
    if (minDim < 550) {
        return 'phone';
    }

    return 'desktop';
}

const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((callback) => callback());
}

let cleanupListeners: (() => void) | null = null;

function subscribe(callback: () => void): () => void {
    listeners.add(callback);

    if (listeners.size === 1 && typeof window !== 'undefined') {
        const handleResize = () => notify();
        const handleOrientationChange = () => notify();

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('orientationchange', handleOrientationChange, { passive: true });

        const mqlCoarse = window.matchMedia('(pointer: coarse)');
        const mqlHover = window.matchMedia('(hover: hover)');
        const handleMediaChange = () => notify();

        if (typeof mqlCoarse.addEventListener === 'function') {
            mqlCoarse.addEventListener('change', handleMediaChange);
            mqlHover.addEventListener('change', handleMediaChange);
        } else {
            const legacyCoarse = mqlCoarse as unknown as { addListener?: (cb: () => void) => void };
            const legacyHover = mqlHover as unknown as { addListener?: (cb: () => void) => void };
            legacyCoarse.addListener?.(handleMediaChange);
            legacyHover.addListener?.(handleMediaChange);
        }

        cleanupListeners = () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleOrientationChange);

            if (typeof mqlCoarse.removeEventListener === 'function') {
                mqlCoarse.removeEventListener('change', handleMediaChange);
                mqlHover.removeEventListener('change', handleMediaChange);
            } else {
                const legacyCoarse = mqlCoarse as unknown as { removeListener?: (cb: () => void) => void };
                const legacyHover = mqlHover as unknown as { removeListener?: (cb: () => void) => void };
                legacyCoarse.removeListener?.(handleMediaChange);
                legacyHover.removeListener?.(handleMediaChange);
            }
        };
    }

    return () => {
        listeners.delete(callback);
        if (listeners.size === 0 && cleanupListeners) {
            cleanupListeners();
            cleanupListeners = null;
        }
    };
}

function getServerSnapshot(): HeroDeviceMode {
    return 'desktop';
}

export function useHeroDeviceMode(): HeroDeviceMode {
    return useSyncExternalStore(subscribe, getHeroDeviceMode, getServerSnapshot);
}

export default useHeroDeviceMode;
