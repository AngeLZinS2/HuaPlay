/**
 * Gerenciador singleton com retry para carregamento da YouTube IFrame Player API.
 * Sem dependências externas e com tipos explícitos para lint/tsc.
 */

export interface YTPlayerInstance {
    playVideo(): void;
    pauseVideo(): void;
    stopVideo?(): void;
    mute(): void;
    unMute(): void;
    isMuted?(): boolean;
    destroy(): void;
    getIframe?(): HTMLIFrameElement;
}

export interface YTReadyEvent {
    target: YTPlayerInstance;
}

export interface YTStateChangeEvent {
    target: YTPlayerInstance;
    data: number;
}

export interface YTPlayerOptions {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number | undefined>;
    events?: {
        onReady?: (event: YTReadyEvent) => void;
        onStateChange?: (event: YTStateChangeEvent) => void;
        onError?: () => void;
        onAutoplayBlocked?: () => void;
    };
}

export interface YTNamespaceLocal {
    Player: new (el: HTMLElement | string, options: YTPlayerOptions) => YTPlayerInstance;
    PlayerState?: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
    };
}

export interface WindowWithYT {
    YT?: YTNamespaceLocal;
    onYouTubeIframeAPIReady?: () => void;
}

let ytScriptPromise: Promise<YTNamespaceLocal> | null = null;

export function getWindowWithYT(): WindowWithYT | null {
    if (typeof window === 'undefined') {
        return null;
    }
    return window as unknown as WindowWithYT;
}

/**
 * Carrega a YouTube IFrame API de forma lazy e idempotente.
 * Se falhar por erro de rede ou timeout (~10s), limpa a tag do script e permite nova tentativa.
 */
export function loadYouTubeIframeApi(timeoutMs = 10000): Promise<YTNamespaceLocal> {
    const win = getWindowWithYT();
    if (!win) {
        return Promise.reject(new Error('Window indisponível para carregamento da YouTube API'));
    }

    if (win.YT && win.YT.Player) {
        return Promise.resolve(win.YT);
    }

    if (ytScriptPromise) {
        return ytScriptPromise;
    }

    ytScriptPromise = new Promise<YTNamespaceLocal>((resolve, reject) => {
        let isTimedOut = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        timer = setTimeout(() => {
            isTimedOut = true;
            cleanup();
            ytScriptPromise = null;
            const scriptTag = document.getElementById('youtube-iframe-api-singleton');
            if (scriptTag && scriptTag.parentNode) {
                scriptTag.parentNode.removeChild(scriptTag);
            }
            reject(new Error('Timeout ao carregar YouTube IFrame API'));
        }, timeoutMs);

        const prevReady = win.onYouTubeIframeAPIReady;
        win.onYouTubeIframeAPIReady = () => {
            if (typeof prevReady === 'function') {
                prevReady();
            }
            if (isTimedOut) {
                return; // Ignora resolução tardia após timeout
            }
            cleanup();
            if (win.YT && win.YT.Player) {
                resolve(win.YT);
            } else {
                ytScriptPromise = null;
                reject(new Error('YouTube API pronta sem construtor Player'));
            }
        };

        const existingScript = document.getElementById('youtube-iframe-api-singleton') as HTMLScriptElement | null;
        if (existingScript) {
            return;
        }

        const script = document.createElement('script');
        script.id = 'youtube-iframe-api-singleton';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;

        script.onerror = () => {
            if (isTimedOut) return;
            cleanup();
            ytScriptPromise = null;
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error('Erro ao carregar script da YouTube IFrame API'));
        };

        document.head.appendChild(script);
    });

    return ytScriptPromise;
}
