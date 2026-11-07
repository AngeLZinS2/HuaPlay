import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadYouTubeIframeApi } from '../utils/youtubePlayer';
import type {
    YTPlayerInstance,
    YTReadyEvent,
    YTStateChangeEvent,
} from '../utils/youtubePlayer';

interface CompactHeroTrailerProps {
    videoId: string;
    title?: string;
    isMuted: boolean;
    onPlayingChange?: (isPlaying: boolean) => void;
    onMuteChange?: (isMuted: boolean) => void;
    onFallback?: () => void;
}

const TARGET_ASPECT_RATIO = 16 / 9;

export const CompactHeroTrailer: React.FC<CompactHeroTrailerProps> = ({
    videoId,
    title,
    isMuted,
    onPlayingChange,
    onMuteChange,
    onFallback,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const hostMountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });

    // Referências atualizadas em useLayoutEffect para respeitar as regras do react-hooks/refs
    const isMutedRef = useRef(isMuted);
    const onMuteChangeRef = useRef(onMuteChange);
    const onFallbackRef = useRef(onFallback);
    const onPlayingChangeRef = useRef(onPlayingChange);

    useLayoutEffect(() => {
        isMutedRef.current = isMuted;
        onMuteChangeRef.current = onMuteChange;
        onFallbackRef.current = onFallback;
        onPlayingChangeRef.current = onPlayingChange;
    }, [isMuted, onMuteChange, onFallback, onPlayingChange]);

    // 1. ResizeObserver para enquadramento 16:9 tipo "cover" sem distorção
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDimensions = (width: number, height: number) => {
            if (width <= 0 || height <= 0) return;

            // Enquadramento 16:9 sem arredondamentos independentes que alterem a proporção
            const targetHeight = Math.max(height, width / TARGET_ASPECT_RATIO) + 2;
            const targetWidth = targetHeight * TARGET_ASPECT_RATIO;

            setDimensions({ width: targetWidth, height: targetHeight });
        };

        const rect = container.getBoundingClientRect();
        updateDimensions(rect.width, rect.height);

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                updateDimensions(width, height);
            }
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, []);

    // 2. Ciclo de vida do Player YouTube com montagem e desmontagem segura (StrictMode compliant)
    useEffect(() => {
        let isCancelled = false;
        let reachedPlaying = false;
        let failed = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let playerInstance: YTPlayerInstance | null = null;

        const hostEl = hostMountRef.current;
        if (!hostEl) return;

        // Limpa filhos anteriores e cria elemento mount imperativo estável
        hostEl.innerHTML = '';
        const childMount = document.createElement('div');
        childMount.style.width = '100%';
        childMount.style.height = '100%';
        hostEl.appendChild(childMount);

        const triggerFallback = () => {
            if (isCancelled || failed) return;
            failed = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            setIsPlaying(false);
            onPlayingChangeRef.current?.(false);
            try {
                if (playerInstance) {
                    playerInstance.destroy();
                    playerInstance = null;
                    playerRef.current = null;
                }
            } catch {
                // Ignore cleanup error
            }
            if (hostEl) {
                hostEl.innerHTML = '';
            }
            onFallbackRef.current?.();
        };

        // Timeout terminal de 8000ms: se NÃO atingir PLAYING (data: 1), força fallback e desmonta sem áudio
        timeoutId = setTimeout(() => {
            if (!isCancelled && !reachedPlaying) {
                triggerFallback();
            }
        }, 8000);

        loadYouTubeIframeApi()
            .then((yt) => {
                // Anti-race: se cancelado ou com falha terminal, bloqueia then e aborta criacao
                if (isCancelled || failed || !yt || !yt.Player || !childMount.parentNode) {
                    return;
                }

                try {
                    playerInstance = new yt.Player(childMount, {
                        videoId,
                        width: '100%',
                        height: '100%',
                        playerVars: {
                            autoplay: 1,
                            mute: 1,
                            controls: 0,
                            disablekb: 1,
                            fs: 0,
                            loop: 1,
                            playlist: videoId,
                            modestbranding: 1,
                            playsinline: 1,
                            rel: 0,
                            origin: window.location.origin,
                            enablejsapi: 1,
                            iv_load_policy: 3,
                        },
                        events: {
                            onReady: (event: YTReadyEvent) => {
                                if (isCancelled || failed) return;
                                try {
                                    // Acessibilidade e atributos do iframe de background
                                    const iframe = event.target.getIframe?.();
                                    if (iframe) {
                                        iframe.title = title ? `Trailer de ${title}` : 'Trailer em destaque';
                                        iframe.tabIndex = -1;
                                        iframe.setAttribute('aria-hidden', 'true');
                                        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                                        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                                    }

                                    // Regra: onReady -> mute antes de dar play
                                    event.target.mute();
                                    event.target.playVideo();
                                } catch {
                                    triggerFallback();
                                }
                            },
                            onStateChange: (event: YTStateChangeEvent) => {
                                if (isCancelled || failed) return;
                                // 1 = YT.PlayerState.PLAYING
                                if (event.data === 1) {
                                    reachedPlaying = true;
                                    if (timeoutId) {
                                        clearTimeout(timeoutId);
                                        timeoutId = null;
                                    }
                                    setIsPlaying(true);
                                    onPlayingChangeRef.current?.(true);

                                    // Aplica o estado de áudio conforme a prop isMuted
                                    try {
                                        if (isMutedRef.current) {
                                            event.target.mute();
                                        } else {
                                            event.target.unMute();
                                        }
                                    } catch {
                                        // Ignore
                                    }
                                } else {
                                    // Fora do data: 1 (PLAYING), garante isPlaying false e notifica false
                                    setIsPlaying(false);
                                    onPlayingChangeRef.current?.(false);
                                }
                            },
                            onError: () => {
                                if (isCancelled || failed) return;
                                triggerFallback();
                            },
                            onAutoplayBlocked: () => {
                                if (isCancelled || failed) return;
                                triggerFallback();
                            },
                        },
                    });

                    // Anti-race: se fallback disparou antes da atribuição da ref
                    if (failed || isCancelled) {
                        try {
                            playerInstance.destroy();
                            playerInstance = null;
                        } catch {
                            // Ignore
                        }
                        return;
                    }

                    playerRef.current = playerInstance;
                } catch {
                    triggerFallback();
                }
            })
            .catch(() => {
                if (isCancelled || failed) return;
                triggerFallback();
            });

        // 3. Pausar ao ocultar aba e retomar MUTED ao voltar visível, notificando o parent
        const handleVisibilityChange = () => {
            if (!playerRef.current) return;
            try {
                if (document.visibilityState === 'hidden') {
                    playerRef.current.pauseVideo();
                } else if (document.visibilityState === 'visible') {
                    // Força mute no player e notifica parent para sincronizar o botão/estado
                    playerRef.current.mute();
                    onMuteChangeRef.current?.(true);
                    playerRef.current.playVideo();
                }
            } catch {
                // Ignore
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isCancelled = true;
            reachedPlaying = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            try {
                if (playerRef.current) {
                    playerRef.current.destroy();
                    playerRef.current = null;
                } else if (playerInstance) {
                    playerInstance.destroy();
                }
            } catch {
                // Ignore destruction error
            }
            if (hostEl) {
                hostEl.innerHTML = '';
            }
        };
    }, [videoId, title]);

    // 4. Sincronização explícita do estado de áudio quando a prop isMuted muda
    useEffect(() => {
        if (!playerRef.current || !isPlaying) return;
        try {
            if (isMuted) {
                playerRef.current.mute();
            } else {
                playerRef.current.unMute();
            }
        } catch {
            // Ignore
        }
    }, [isMuted, isPlaying]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
        >
            <div
                style={{
                    width: dimensions.width ? `${dimensions.width}px` : '100%',
                    height: dimensions.height ? `${dimensions.height}px` : '100%',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                }}
                className={`transition-opacity duration-700 ease-in-out ${
                    isPlaying ? 'opacity-100' : 'opacity-0'
                }`}
            >
                <div ref={hostMountRef} className="w-full h-full pointer-events-none" />
            </div>
        </div>
    );
};

export default CompactHeroTrailer;
