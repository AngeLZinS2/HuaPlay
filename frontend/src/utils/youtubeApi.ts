/**
 * Loader for the YouTube IFrame Player API.
 *
 * This is what makes real playback progress possible: a plain <iframe> embed
 * exposes nothing, while a YT.Player wrapped around that same iframe gives
 * getCurrentTime() and an ENDED event. Only YouTube sources support this —
 * Drive, Mega and Pixeldrain embeds have no equivalent API.
 */

export interface YTPlayer {
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
}

export const YT_STATE = {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
} as const;

interface YTNamespace {
    Player: new (
        el: HTMLElement | string,
        opts: { events?: Record<string, (e: { data: number }) => void> },
    ) => YTPlayer;
}

declare global {
    interface Window {
        YT?: YTNamespace;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let loader: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('YouTube API unavailable outside the browser'));
    }
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (loader) return loader;

    loader = new Promise<YTNamespace>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-yt-api]');
        if (!existing) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.dataset.ytApi = 'true';
            script.onerror = () => {
                loader = null;
                reject(new Error('Failed to load the YouTube IFrame API'));
            };
            document.head.appendChild(script);
        }

        // The API calls this global once it is ready. Chain onto any existing
        // handler instead of overwriting it, in case another component set one.
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            if (window.YT?.Player) resolve(window.YT);
            else reject(new Error('YouTube API loaded without a Player constructor'));
        };
    });

    return loader;
}

/** The IFrame API only talks to embeds that opt in via enablejsapi=1. */
export function withJsApi(embedUrl: string): string {
    if (!embedUrl || !embedUrl.includes('youtube.com/embed/')) return embedUrl;
    try {
        const url = new URL(embedUrl);
        url.searchParams.set('enablejsapi', '1');
        if (!url.searchParams.has('origin')) {
            url.searchParams.set('origin', window.location.origin);
        }
        return url.toString();
    } catch {
        return embedUrl;
    }
}

export function isYouTubeEmbed(url: string): boolean {
    return !!url && url.includes('youtube.com/embed/');
}
