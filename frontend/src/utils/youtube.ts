// A YouTube id is always 11 characters of [A-Za-z0-9_-]. Matching on that shape
// instead of "the URL has a v= param" keeps links from other hosts — which often
// carry their own v= — from being turned into broken YouTube embeds.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;
const ID_MARKERS = ['youtu.be/', '/embed/', '/shorts/', '/live/', '/v/'];

const cleanId = (raw: string): string => {
    const id = raw.split(/[?&#/]/)[0];
    return YOUTUBE_ID.test(id) ? id : '';
};

export const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const value = url.trim();
    if (!value) return null;

    try {
        // A bare id pasted on its own.
        if (YOUTUBE_ID.test(value)) return value;

        const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
        if (!YOUTUBE_HOST.test(parsed.hostname)) return null;

        for (const marker of ID_MARKERS) {
            const index = value.indexOf(marker);
            if (index !== -1) {
                const id = cleanId(value.slice(index + marker.length));
                if (id) return id;
            }
        }

        const v = parsed.searchParams.get('v');
        if (v) return cleanId(v) || null;
    } catch (e) {
        console.error('Error parsing YouTube URL:', url, e);
    }

    return null;
};

export const getYouTubeEmbedUrl = (url: string): string | null => {
    const id = getYouTubeVideoId(url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
};
