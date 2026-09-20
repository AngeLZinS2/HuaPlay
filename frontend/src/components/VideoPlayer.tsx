import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    isYouTubeEmbed,
    loadYouTubeApi,
    withJsApi,
    YT_STATE,
    type YTPlayer,
} from '../utils/youtubeApi';
import { isPixeldrainUrl, toPixeldrainDirect } from '../utils/pixeldrain';

interface VideoPlayerProps {
    embedUrl: string;
    placeholder?: string;
    /** Seconds to resume from. Honoured by the native player; YouTube uses ?start=. */
    resumeAt?: number;
    /** Called periodically with the current position, and once when playback stops. */
    onProgress?: (seconds: number) => void;
    /** Called when the video reaches its end. */
    onEnded?: () => void;
}

const PROGRESS_INTERVAL_MS = 30_000;

export default function VideoPlayer({
    embedUrl,
    placeholder = 'Selecione um episódio para assistir',
    resumeAt = 0,
    onProgress,
    onEnded,
}: VideoPlayerProps) {
    const frameId = `yt-${useId().replace(/:/g, '')}`;
    const playerRef = useRef<YTPlayer | null>(null);

    // Keep the latest callbacks in refs so the player is not torn down and
    // rebuilt every time the parent re-renders with new closures. Written in an
    // effect rather than during render, which React forbids.
    const onProgressRef = useRef(onProgress);
    const onEndedRef = useRef(onEnded);
    useEffect(() => {
        onProgressRef.current = onProgress;
        onEndedRef.current = onEnded;
    }, [onProgress, onEnded]);

    // Helper to format Google Drive URLs for embedding
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com') && (url.includes('/view') || url.includes('/edit'))) {
            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
        }
        return url;
    };

    const resolvedUrl = getEmbedUrl(embedUrl);
    const nativeSrc = isPixeldrainUrl(resolvedUrl) ? toPixeldrainDirect(resolvedUrl) : null;
    const trackable = isYouTubeEmbed(resolvedUrl) && !nativeSrc;
    const srcUrl = trackable ? withJsApi(resolvedUrl) : resolvedUrl;

    // ---- native <video> path (Pixeldrain) ----
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastReportedRef = useRef(0);
    // Remember which source failed rather than a bare boolean: a different source
    // is then automatically a fresh attempt, with no effect resetting state.
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    const reportNative = useCallback((force = false) => {
        const el = videoRef.current;
        if (!el) return;
        const seconds = Math.floor(el.currentTime);
        // timeupdate fires several times a second; only persist every 30s of
        // playback, plus on pause/unmount/end where force is set.
        if (!force && Math.abs(seconds - lastReportedRef.current) < 30) return;
        lastReportedRef.current = seconds;
        if (seconds > 0) onProgressRef.current?.(seconds);
    }, []);

    // Seek to the saved position once the browser knows the duration.
    useEffect(() => {
        const el = videoRef.current;
        if (!el || !nativeSrc || resumeAt <= 0) return;
        const seek = () => {
            if (resumeAt < el.duration - 5) el.currentTime = resumeAt;
        };
        if (el.readyState >= 1) seek();
        else el.addEventListener('loadedmetadata', seek, { once: true });
        return () => el.removeEventListener('loadedmetadata', seek);
    }, [nativeSrc, resumeAt]);

    // Persist wherever the viewer stopped when the source changes or unmounts.
    useEffect(() => {
        if (!nativeSrc) return;
        lastReportedRef.current = 0;
        return () => reportNative(true);
    }, [nativeSrc, reportNative]);

    useEffect(() => {
        if (!trackable) return;

        let cancelled = false;
        let ticker: ReturnType<typeof setInterval> | undefined;

        const report = () => {
            const player = playerRef.current;
            if (!player) return;
            try {
                const seconds = Math.floor(player.getCurrentTime());
                if (seconds > 0) onProgressRef.current?.(seconds);
            } catch {
                // Player torn down mid-call; nothing useful to do.
            }
        };

        loadYouTubeApi()
            .then((YT) => {
                if (cancelled) return;
                const el = document.getElementById(frameId);
                if (!el) return;

                playerRef.current = new YT.Player(el, {
                    events: {
                        onStateChange: (event) => {
                            if (event.data === YT_STATE.PLAYING) {
                                clearInterval(ticker);
                                ticker = setInterval(report, PROGRESS_INTERVAL_MS);
                            } else {
                                clearInterval(ticker);
                                ticker = undefined;
                                // Capture the position on pause too, not only on a timer tick.
                                if (event.data === YT_STATE.PAUSED) report();
                            }
                            if (event.data === YT_STATE.ENDED) {
                                report();
                                onEndedRef.current?.();
                            }
                        },
                    },
                });
            })
            .catch((err) => {
                // Progress tracking is an enhancement — the iframe still plays without it.
                console.warn('YouTube progress tracking unavailable:', err);
            });

        return () => {
            cancelled = true;
            clearInterval(ticker);
            // Save wherever the viewer stopped before the player goes away.
            report();
            try {
                playerRef.current?.destroy();
            } catch {
                /* already gone */
            }
            playerRef.current = null;
        };
    }, [srcUrl, trackable, frameId]);

    // If the native element cannot play the file, fall back to the provider's own
    // iframe rather than leaving the viewer staring at a grey rectangle.
    if (nativeSrc && failedSrc !== nativeSrc) {
        return (
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
                <video
                    ref={videoRef}
                    key={nativeSrc}
                    src={nativeSrc}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full bg-black"
                    onTimeUpdate={() => reportNative()}
                    onPause={() => reportNative(true)}
                    onEnded={() => {
                        reportNative(true);
                        onEndedRef.current?.();
                    }}
                    onError={() => {
                        const err = videoRef.current?.error;
                        console.error(
                            `[VideoPlayer] native playback failed for ${nativeSrc} — ` +
                            `code=${err?.code} message="${err?.message}". Falling back to the embed.`,
                        );
                        setFailedSrc(nativeSrc);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
            {srcUrl ? (
                <iframe
                    id={frameId}
                    key={srcUrl}
                    src={srcUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 bg-black/50">
                    <p className="text-center px-4">{placeholder}</p>
                </div>
            )}
        </div>
    );
}
