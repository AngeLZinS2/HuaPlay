import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const activityEvents: Array<keyof WindowEventMap> = [
    'pointerdown',
    'pointermove',
    'keydown',
    'scroll',
    'touchstart',
    'wheel',
];

export function useHomeInactivityRedirect(enabled: boolean) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!enabled) return;

        let lastActivityAt = Date.now();
        let timeoutId: number | undefined;

        const redirectToProfiles = () => {
            navigate('/profiles', {
                replace: true,
                state: { returnedByInactivity: true },
            });
        };

        const scheduleRedirect = () => {
            window.clearTimeout(timeoutId);
            const elapsed = Date.now() - lastActivityAt;
            const remaining = Math.max(0, DEFAULT_IDLE_TIMEOUT_MS - elapsed);
            timeoutId = window.setTimeout(redirectToProfiles, remaining);
        };

        const registerActivity = () => {
            lastActivityAt = Date.now();
            scheduleRedirect();
        };

        const checkWhenVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastActivityAt >= DEFAULT_IDLE_TIMEOUT_MS) {
                redirectToProfiles();
                return;
            }
            scheduleRedirect();
        };

        activityEvents.forEach(eventName => {
            window.addEventListener(eventName, registerActivity, { passive: true });
        });
        document.addEventListener('visibilitychange', checkWhenVisible);
        scheduleRedirect();

        return () => {
            window.clearTimeout(timeoutId);
            activityEvents.forEach(eventName => {
                window.removeEventListener(eventName, registerActivity);
            });
            document.removeEventListener('visibilitychange', checkWhenVisible);
        };
    }, [enabled, navigate]);
}
