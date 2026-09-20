import { getYouTubeVideoId } from './youtube';

/**
 * Resolves whatever the admin pasted into the "URL do Trailer" field into a URL
 * that can actually go into an iframe.
 *
 * The hero used to call getYouTubeEmbedUrl() directly, so a perfectly valid
 * embed link from any other host resolved to null and the iframe was rendered
 * with the literal string "null" as its src — a black banner with no error and
 * no fallback image. Anything this function cannot resolve now returns null, and
 * the callers fall back to the still banner instead.
 */

export type TrailerProvider =
    | 'youtube'
    | 'okru'
    | 'dailymotion'
    | 'vimeo'
    | 'drive'
    | 'generic';

export interface TrailerEmbed {
    src: string;
    provider: TrailerProvider;
    /** Whether mute/unMute can be driven over postMessage. YouTube only. */
    supportsMuteApi: boolean;
}

export interface TrailerEmbedOptions {
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    /** YouTube-only quality hint, used by the full-bleed hero banner. */
    hd?: boolean;
}

const OKRU = /(?:ok\.ru|odnoklassniki\.ru)\/(?:video|videoembed)\/(\d+)/i;
const DAILYMOTION = /dailymotion\.com\/(?:embed\/)?video\/([A-Za-z0-9]+)/i;
const DAILYMOTION_SHORT = /dai\.ly\/([A-Za-z0-9]+)/i;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/i;
const DRIVE = /drive\.google\.com\/file\/d\/([\w-]+)/i;

// Path shapes used by the embed players of the file hosts this catalog relies
// on: /embed/, /videoembed/, /player/, /preview, and the short /e/ and /v/ forms.
const GENERIC_EMBED_PATH = /\/(embed|embeds|videoembed|iframe|player|preview|e|v|u)(\/|\?|$)/i;

const query = (params: Record<string, string | number | undefined>): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.append(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
};

const flag = (on: boolean | undefined, fallback: boolean): 1 | 0 =>
    (on ?? fallback) ? 1 : 0;

export const getTrailerEmbed = (
    url: string | null | undefined,
    options: TrailerEmbedOptions = {},
): TrailerEmbed | null => {
    if (!url) return null;
    const value = url.trim();
    if (!value) return null;

    const autoplay = flag(options.autoplay, true);
    const muted = flag(options.muted, true);
    const loop = flag(options.loop, true);
    const controls = flag(options.controls, false);

    const youtubeId = getYouTubeVideoId(value);
    if (youtubeId) {
        const src =
            `https://www.youtube.com/embed/${youtubeId}` +
            query({
                enablejsapi: 1,
                autoplay,
                mute: muted,
                controls,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                loop,
                playlist: loop ? youtubeId : undefined,
                vq: options.hd ? 'hd1080' : undefined,
                origin: window.location.origin,
            });
        return { src, provider: 'youtube', supportsMuteApi: true };
    }

    const okru = value.match(OKRU);
    if (okru) {
        return {
            src: `https://ok.ru/videoembed/${okru[1]}${query({ autoplay, nochat: 1 })}`,
            provider: 'okru',
            supportsMuteApi: false,
        };
    }

    const dailymotion = value.match(DAILYMOTION) || value.match(DAILYMOTION_SHORT);
    if (dailymotion) {
        return {
            src:
                `https://www.dailymotion.com/embed/video/${dailymotion[1]}` +
                query({ autoplay, mute: muted, controls, loop }),
            provider: 'dailymotion',
            supportsMuteApi: false,
        };
    }

    const vimeo = value.match(VIMEO);
    if (vimeo) {
        return {
            src:
                `https://player.vimeo.com/video/${vimeo[1]}` +
                query({ autoplay, muted, loop, background: controls ? undefined : 1 }),
            provider: 'vimeo',
            supportsMuteApi: false,
        };
    }

    const drive = value.match(DRIVE);
    if (drive) {
        return {
            src: `https://drive.google.com/file/d/${drive[1]}/preview`,
            provider: 'drive',
            supportsMuteApi: false,
        };
    }

    // Any other host: accept it only when the path looks like a player, so a
    // pasted catalogue page does not get rendered inside the banner.
    try {
        const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
        if (GENERIC_EMBED_PATH.test(parsed.pathname)) {
            return { src: parsed.toString(), provider: 'generic', supportsMuteApi: false };
        }
    } catch {
        return null;
    }

    return null;
};

const PROVIDER_LABELS: Record<TrailerProvider, string> = {
    youtube: 'YouTube',
    okru: 'Ok.ru',
    dailymotion: 'Dailymotion',
    vimeo: 'Vimeo',
    drive: 'Google Drive',
    generic: 'Embed externo',
};

export const getTrailerProviderLabel = (provider: TrailerProvider): string =>
    PROVIDER_LABELS[provider];
