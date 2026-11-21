import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    isYouTubeEmbed,
    loadYouTubeApi,
    withJsApi,
    YT_STATE,
    type YTPlayer,
} from '../utils/youtubeApi';
import { isPixeldrainUrl, toPixeldrainDirect } from '../utils/pixeldrain';
import { PREFER_NATIVE_PIXELDRAIN } from '../config';

interface VideoPlayerProps {
    embedUrl: string;
    placeholder?: string;
    /** Seconds to resume from. Honoured by the native player; YouTube uses ?start=. */
    resumeAt?: number;
    /** Called periodically with the exact playback position, and when playback stops. */
    onProgress?: (seconds: number, duration?: number) => void;
    /** Called when the video reaches its end (or >= 92% completion on exact players). */
    onEnded?: () => void;
    /** Tells parent whether this source reports exact player time or needs wall-clock estimation. */
    onPlaybackModeChange?: (mode: 'exact' | 'estimated') => void;
    /** Fired when the user clicks/focuses the player (including inside cross-origin iframes). */
    onUserInteract?: () => void;
    /** Subtle golden frame highlight when Cinema Mode is enabled. */
    cinemaMode?: boolean;
}

const PROGRESS_INTERVAL_MS = 15_000;
const COMPLETE_RATIO = 0.92;

export default function VideoPlayer({
    embedUrl,
    placeholder = 'Selecione um episódio para assistir',
    resumeAt = 0,
    onProgress,
    onEnded,
    onPlaybackModeChange,
    onUserInteract,
    cinemaMode = false,
}: VideoPlayerProps) {
    const frameId = `yt-${useId().replace(/:/g, '')}`;
    const playerRef = useRef<YTPlayer | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Keep latest callbacks in refs so the player is never torn down on parent re-renders.
    const onProgressRef = useRef(onProgress);
    const onEndedRef = useRef(onEnded);
    const onPlaybackModeChangeRef = useRef(onPlaybackModeChange);
    const onUserInteractRef = useRef(onUserInteract);

    useEffect(() => {
        onProgressRef.current = onProgress;
        onEndedRef.current = onEnded;
        onPlaybackModeChangeRef.current = onPlaybackModeChange;
        onUserInteractRef.current = onUserInteract;
    }, [onProgress, onEnded, onPlaybackModeChange, onUserInteract]);

    // Helper to format Google Drive URLs for embedding
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com') && (url.includes('/view') || url.includes('/edit'))) {
            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
        }
        return url;
    };

    const resolvedUrl = getEmbedUrl(embedUrl);
    const nativeSrc =
        PREFER_NATIVE_PIXELDRAIN && isPixeldrainUrl(resolvedUrl)
            ? toPixeldrainDirect(resolvedUrl)
            : null;
    const trackable = isYouTubeEmbed(resolvedUrl) && !nativeSrc;
    const srcUrl = trackable ? withJsApi(resolvedUrl) : resolvedUrl;

    // ---- native <video> path (when PREFER_NATIVE_PIXELDRAIN is enabled) ----
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastReportedRef = useRef(0);
    const autoCompletedSrcRef = useRef<string | null>(null);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    const isNativeActive = Boolean(nativeSrc && failedSrc !== nativeSrc);
    const isExactMode = isNativeActive || trackable;

    useEffect(() => {
        onPlaybackModeChangeRef.current?.(isExactMode ? 'exact' : 'estimated');
    }, [isExactMode, resolvedUrl]);

    // Detect when the viewer clicks Play inside a cross-origin iframe (Drive, Pixeldrain, Mega).
    // Clicking inside an iframe blurs the parent window and moves document.activeElement to the iframe.
    useEffect(() => {
        if (isNativeActive || !srcUrl) return;
        const handleBlur = () => {
            const checkFocus = () => {
                if (iframeRef.current && document.activeElement === iframeRef.current) {
                    onUserInteractRef.current?.();
                }
            };
            checkFocus();
            window.setTimeout(checkFocus, 0);
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, [isNativeActive, srcUrl]);

    const reportNative = useCallback(
        (force = false) => {
            const el = videoRef.current;
            if (!el) return;
            const seconds = Math.floor(el.currentTime);
            const duration = Number.isFinite(el.duration) ? Math.floor(el.duration) : undefined;

            if (
                duration &&
                duration > 60 &&
                seconds / duration >= COMPLETE_RATIO &&
                autoCompletedSrcRef.current !== nativeSrc
            ) {
                autoCompletedSrcRef.current = nativeSrc;
                onEndedRef.current?.();
                return;
            }

            if (!force && Math.abs(seconds - lastReportedRef.current) < 15) return;
            lastReportedRef.current = seconds;
            if (seconds > 0) onProgressRef.current?.(seconds, duration);
        },
        [nativeSrc],
    );

    // Seek to saved position once metadata loads.
    useEffect(() => {
        const el = videoRef.current;
        if (!el || !isNativeActive || resumeAt <= 0) return;
        const seek = () => {
            if (Number.isFinite(el.duration) && resumeAt < el.duration - 5) {
                el.currentTime = resumeAt;
            }
        };
        if (el.readyState >= 1) seek();
        else el.addEventListener('loadedmetadata', seek, { once: true });
        return () => el.removeEventListener('loadedmetadata', seek);
    }, [isNativeActive, nativeSrc, resumeAt]);

    // Persist native playback position on source change, hide, or unmount.
    useEffect(() => {
        if (!isNativeActive) return;
        lastReportedRef.current = 0;
        const onHide = () => {
            if (document.visibilityState === 'hidden') reportNative(true);
        };
        const onPageHide = () => reportNative(true);
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onPageHide);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onPageHide);
            reportNative(true);
        };
    }, [isNativeActive, nativeSrc, reportNative]);

    // ---- YouTube IFrame API path ----
    useEffect(() => {
        if (!trackable) return;

        let cancelled = false;
        let ticker: ReturnType<typeof setInterval> | undefined;
        let completedSent = false;

        const report = () => {
            const player = playerRef.current;
            if (!player) return;
            try {
                const seconds = Math.floor(player.getCurrentTime());
                const rawDuration = player.getDuration();
                const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.floor(rawDuration) : undefined;

                if (duration && duration > 60 && seconds / duration >= COMPLETE_RATIO && !completedSent) {
                    completedSent = true;
                    onEndedRef.current?.();
                    return;
                }
                if (seconds > 0) onProgressRef.current?.(seconds, duration);
            } catch {
                // Player torn down mid-call
            }
        };

        const onHide = () => {
            if (document.visibilityState === 'hidden') report();
        };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', report);

        loadYouTubeApi()
            .then((YT) => {
                if (cancelled) return;
                const el = document.getElementById(frameId);
                if (!el) return;

                playerRef.current = new YT.Player(el, {
                    events: {
                        onStateChange: (event) => {
                            if (event.data === YT_STATE.PLAYING) {
                                onUserInteractRef.current?.();
                                clearInterval(ticker);
                                ticker = setInterval(report, PROGRESS_INTERVAL_MS);
                            } else {
                                clearInterval(ticker);
                                ticker = undefined;
                                if (event.data === YT_STATE.PAUSED) report();
                            }
                            if (event.data === YT_STATE.ENDED && !completedSent) {
                                completedSent = true;
                                onEndedRef.current?.();
                            }
                        },
                    },
                });
            })
            .catch((err) => {
                console.warn('YouTube progress tracking unavailable:', err);
            });

        return () => {
            cancelled = true;
            clearInterval(ticker);
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', report);
            report();
            try {
                playerRef.current?.destroy();
            } catch {
                /* already gone */
            }
            playerRef.current = null;
        };
    }, [srcUrl, trackable, frameId]);

    const frameClasses = `relative w-full aspect-video bg-black rounded-2xl overflow-hidden border transition-all duration-300 ${
        cinemaMode
            ? 'border-primary/40 shadow-[0_0_80px_-15px_rgba(212,175,55,0.28),0_25px_60px_-12px_rgba(0,0,0,0.95)]'
            : 'border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)]'
    }`;

    if (isNativeActive && nativeSrc) {
        return (
            <div className={frameClasses} onPointerDown={() => onUserInteractRef.current?.()}>
                <video
                    ref={videoRef}
                    key={nativeSrc}
                    src={nativeSrc}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full bg-black"
                    onPlay={() => onUserInteractRef.current?.()}
                    onTimeUpdate={() => reportNative()}
                    onSeeked={() => reportNative(true)}
                    onPause={() => reportNative(true)}
                    onEnded={() => {
                        autoCompletedSrcRef.current = nativeSrc;
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
        <div className={frameClasses} onPointerDown={() => onUserInteractRef.current?.()}>
            {srcUrl ? (
                <iframe
                    ref={iframeRef}
                    id={frameId}
                    key={srcUrl}
                    src={srcUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 bg-gradient-to-b from-[#0d0d12] to-[#050507] px-6">
                    <p className="text-center text-sm max-w-md leading-relaxed">{placeholder}</p>
                </div>
            )}
        </div>
    );
}
