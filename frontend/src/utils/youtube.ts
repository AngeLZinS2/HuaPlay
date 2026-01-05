export const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    try {
        let videoId = '';

        // Handle https://youtu.be/ID
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }
        // Handle https://www.youtube.com/embed/ID
        else if (url.includes('youtube.com/embed/')) {
            videoId = url.split('embed/')[1].split('?')[0];
        }
        // Handle https://www.youtube.com/watch?v=ID
        else if (url.includes('v=')) {
            const urlObj = new URL(url);
            videoId = urlObj.searchParams.get('v') || '';
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    } catch (e) {
        console.error("Error parsing YouTube URL:", url, e);
    }

    return null;
};

export const getYouTubeVideoId = (url: string): string | null => {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (!embedUrl) return null;
    return embedUrl.split('/').pop() || null;
};
