import { useCallback, useEffect, useRef } from 'react';

/**
 * Accumulates wall-clock time while the tab is actually in front.
 *
 * This is the fallback for providers whose players expose no API (Pixeldrain,
 * Drive, Mega): we cannot know the real playback position, so we approximate it
 * by how long the viewer sat on the page with an episode selected. Counting
 * pauses when the tab is hidden, and the total is capped, but a viewer who
 * walks away with the tab open will still overshoot — which is exactly why the
 * value is stored as is_estimated and shown with a "~" in the UI.
 */
export function useVisibleElapsed(maxSeconds = 4 * 60 * 60) {
    const accumulatedRef = useRef(0);
    const lastTickRef = useRef<number | null>(null);

    const settle = useCallback(() => {
        if (lastTickRef.current === null) return;
        const delta = (Date.now() - lastTickRef.current) / 1000;
        lastTickRef.current = Date.now();
        if (delta > 0) {
            accumulatedRef.current = Math.min(maxSeconds, accumulatedRef.current + delta);
        }
    }, [maxSeconds]);

    /** Current accumulated seconds, in whole seconds. */
    const elapsed = useCallback(() => {
        settle();
        return Math.floor(accumulatedRef.current);
    }, [settle]);

    /** Restart counting, optionally carrying a previously saved position forward. */
    const reset = useCallback((startAt = 0) => {
        accumulatedRef.current = Math.min(maxSeconds, Math.max(0, startAt));
        lastTickRef.current = document.visibilityState === 'visible' ? Date.now() : null;
    }, [maxSeconds]);

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                lastTickRef.current = Date.now();
            } else {
                settle();
                lastTickRef.current = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [settle]);

    return { elapsed, reset };
}
