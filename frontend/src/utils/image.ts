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

        // Extract relative path e.g. /t/p/w500/abc.jpg -> /t/p/w342/abc.jpg
        const tmdbPath = cleanUrl.replace(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^\/]+\//, `/t/p/${size}/`);
        
        // Proxy through Jetpack Global Edge CDN (i0.wp.com) - 200 OK fast response in LatAm/Brazil
        return `https://i0.wp.com/image.tmdb.org${tmdbPath}`;
    }

    return cleanUrl;
};
