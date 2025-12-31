
interface VideoPlayerProps {
    embedUrl: string;
    placeholder?: string;
}

export default function VideoPlayer({ embedUrl, placeholder = "Selecione um episódio para assistir" }: VideoPlayerProps) {
    // Helper to format Google Drive URLs for embedding
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com') && (url.includes('/view') || url.includes('/edit'))) {
            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
        }
        return url;
    };

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
            {embedUrl ? (
                <iframe
                    src={getEmbedUrl(embedUrl)}
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
