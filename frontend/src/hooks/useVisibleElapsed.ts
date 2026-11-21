import { useCallback, useEffect, useRef } from 'react';

export interface UseVisibleElapsedOptions {
    /** Hard upper bound (in seconds) so a forgotten tab never stores absurd values. */
    maxSeconds?: number;
    /** Fired right as the tab is hidden or unloaded (pagehide) while running. */
    onPauseFlush?: (seconds: number) => void;
}

/**
 * Accumulates wall-clock playback time while the tab is visible and watching
 * has started — the fallback for iframe providers (Drive, Pixeldrain embed,
 * Mega) that expose no player time API.
 *
 * Key safeguards:
 * - Explicit start/pause/reset so Episode 1 starts cleanly on interaction
 *   and doesn't tick while the viewer is still reading the synopsis.
 * - Single-tick delta is capped at 120s so waking a sleeping laptop/phone
 *   cannot add hours of fake progress.
 * - Immediately flushes via `onPauseFlush` on `visibilitychange` (hidden) and
 *   `pagehide` so closing a mobile PWA or switching apps never drops progress.
 */
export function useVisibleElapsed(options: number | UseVisibleElapsedOptions = {}) {
    const resolvedOptions: UseVisibleElapsedOptions =
        typeof options === 'number' ? { maxSeconds: options } : options;
    const maxSeconds = resolvedOptions.maxSeconds ?? 3 * 60 * 60;

    const accumulatedRef = useRef(0);
    const lastTickRef = useRef<number | null>(null);
    const runningRef = useRef(false);
    const onPauseFlushRef = useRef(resolvedOptions.onPauseFlush);

    useEffect(() => {
        onPauseFlushRef.current = resolvedOptions.onPauseFlush;
    }, [resolvedOptions.onPauseFlush]);

    const clamp = useCallback(
        (value: number) => Math.min(maxSeconds, Math.max(0, value)),
        [maxSeconds],
    );

    const settle = useCallback(() => {
        if (!runningRef.current || lastTickRef.current === null) {
            return Math.floor(accumulatedRef.current);
        }
        const now = Date.now();
        const rawDelta = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        if (rawDelta > 0) {
            // Cap a single jump to 2 minutes to guard against OS sleep/suspend.
            const safeDelta = Math.min(rawDelta, 120);
            accumulatedRef.current = clamp(accumulatedRef.current + safeDelta);
        }
        return Math.floor(accumulatedRef.current);
    }, [clamp]);

    /** Current accumulated seconds, in whole seconds. */
    const elapsed = useCallback(() => settle(), [settle]);

    /** Begin or resume counting, optionally seeding from a saved timestamp. */
    const start = useCallback(
        (startAt?: number) => {
            if (typeof startAt === 'number' && Number.isFinite(startAt)) {
                accumulatedRef.current = clamp(startAt);
            }
            runningRef.current = true;
            lastTickRef.current =
                typeof document === 'undefined' || document.visibilityState === 'visible'
                    ? Date.now()
                    : null;
        },
        [clamp],
    );

    /** Pause counting and return the latest accumulated seconds. */
    const pause = useCallback(() => {
        const total = settle();
        runningRef.current = false;
        lastTickRef.current = null;
        return total;
    }, [settle]);

    /** Reset counter to `startAt` (default 0) and optionally start immediately. */
    const reset = useCallback(
        (startAt = 0, autoStart = false) => {
            accumulatedRef.current = clamp(startAt);
            runningRef.current = autoStart;
            lastTickRef.current =
                autoStart &&
                (typeof document === 'undefined' || document.visibilityState === 'visible')
                    ? Date.now()
                    : null;
        },
        [clamp],
    );

    /**
     * Raise the counter if Firestore finishes loading a higher saved position
     * after the episode already mounted (prevents Ep. 1 async race overwrites).
     */
    const syncFloor = useCallback(
        (savedSeconds: number) => {
            settle();
            if (Number.isFinite(savedSeconds) && savedSeconds > accumulatedRef.current) {
                accumulatedRef.current = clamp(savedSeconds);
            }
        },
        [clamp, settle],
    );

    const isRunning = useCallback(() => runningRef.current, []);

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                if (runningRef.current) {
                    lastTickRef.current = Date.now();
                }
            } else {
                const total = settle();
                lastTickRef.current = null;
                if (runningRef.current) {
                    onPauseFlushRef.current?.(total);
                }
            }
        };

        const onPageHide = () => {
            const total = settle();
            lastTickRef.current = null;
            if (runningRef.current) {
                onPauseFlushRef.current?.(total);
            }
        };

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onPageHide);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', onPageHide);
        };
    }, [settle]);

    return { elapsed, start, pause, reset, syncFloor, isRunning };
}
