/**
 * Utility function to optimize image URLs for maximum speed and reliability.
 * Routes TMDB images through Automattic/Jetpack Edge CDN (i0.wp.com),
 * preventing ISP timeouts on image.tmdb.org and loading images in milliseconds!
 */
export const getOptimizedImageUrl = (
    url: string | null | undefined,
    type: 'poster' | 'backdrop' | 'thumbnail' = 'poster'
): string => {
    const fallback = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop";
    if (!url) return fallback;

    const cleanUrl = url.trim();
    if (!cleanUrl) return fallback;

    if (cleanUrl.includes('image.tmdb.org')) {
        let size = 'w342';
        if (type === 'thumbnail') size = 'w185';
        if (type === 'backdrop') size = 'w1280';

        // Extract filename e.g. /t/p/w500/abc.jpg -> abc.jpg
        const match = cleanUrl.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/([A-Za-z0-9_.-]+)$/);
        if (match && typeof window !== 'undefined' && window.location.hostname === 'huaplay.playdb.info') {
            // Same-origin HTTP/2 cached proxy (zero extra DNS/TLS handshake on web)
            return `/img/tmdb/${size}/${match[1]}`;
        }

        const tmdbPath = cleanUrl.replace(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\//, `/t/p/${size}/`);
        // Proxy through Jetpack Global Edge CDN (i0.wp.com) with automatic WebP + quality compression
        return `https://i0.wp.com/image.tmdb.org${tmdbPath}?quality=75&strip=all`;
    }

    return cleanUrl;
};
