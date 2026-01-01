import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Download, Star, Share2 } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import api from '../services/api';

export default function SeriesDetail() {
    const { id } = useParams();
    const [series, setSeries] = useState<any | null>(null);
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [selectedEpisode, setSelectedEpisode] = useState<any | null>(null);
    const [useAlternativeLink, setUseAlternativeLink] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeSource, setActiveSource] = useState<string>('');

    useEffect(() => {
        const fetchSeriesData = async () => {
            try {
                const seriesRes = await api.get(`/series/${id}`);
                setSeries(seriesRes.data);

                const episodesRes = await api.get(`/series/${id}/episodes`);
                setEpisodes(episodesRes.data);

                if (episodesRes.data.length > 0) {
                    const firstEp = episodesRes.data[0];
                    setSelectedEpisode(firstEp);
                    // Default to Embed 1, then Embed 2, then Drive (transformed)
                    setActiveSource(firstEp.embed_url_1 || firstEp.embed_url_2 || transformToEmbed(firstEp.drive_link, 'drive') || '');
                }
            } catch (error) {
                console.error("Failed to fetch series data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchSeriesData();
        }
    }, [id]);

    // Helper to transform common file host links to embeddable versions
    const transformToEmbed = (url: string, type: 'drive' | 'pixeldrain' | 'mega' | 'youtube') => {
        if (!url) return '';
        if (type === 'drive') {
            // Extract ID and force preview
            // Matches /file/d/ID or /open?id=ID
            const idMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) {
                return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
            }
            // Fallback: replace /view with /preview if simple subst needed
            if (url.includes('/view')) return url.replace('/view', '/preview');
            return url;
        }
        if (type === 'pixeldrain') {
            // https://pixeldrain.com/u/ID -> https://pixeldrain.com/u/ID?embed could be better but direct /u/ID often works in iframe or requires handling
            // Search suggests iframe src=url is standard.
            return url;
        }
        if (type === 'mega') {
            // https://mega.nz/file/ID#KEY -> https://mega.nz/embed/ID#KEY
            if (url.includes('/file/')) return url.replace('/file/', '/embed/');
            return url;
        }
        if (type === 'youtube') {
            // https://www.youtube.com/watch?v=ID -> https://www.youtube.com/embed/ID
            // https://youtu.be/ID -> https://www.youtube.com/embed/ID
            const vParam = url.match(/[?&]v=([^&]+)/);
            if (vParam && vParam[1]) return `https://www.youtube.com/embed/${vParam[1]}`;
            if (url.includes('youtu.be/')) {
                const id = url.split('youtu.be/')[1].split('?')[0];
                return `https://www.youtube.com/embed/${id}`;
            }
            return url;
        }
        return url;
    };

    // Reset source when episode changes
    const handleEpisodeSelect = (ep: any) => {
        setSelectedEpisode(ep);
        setUseAlternativeLink(false);
        setActiveSource(ep.embed_url_1 || ep.embed_url_2 || transformToEmbed(ep.drive_link, 'drive') || '');
        // Scroll to player
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!series) {
        return <div className="min-h-screen flex items-center justify-center text-white">Série não encontrada.</div>;
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Cinematic Banner */}
            <div className="relative h-[60vh] w-full">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${series.banner_image || series.cover_image})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-end">
                    <motion.img
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        src={series.cover_image}
                        alt={series.title}
                        className="w-48 rounded-lg shadow-2xl hidden md:block"
                    />

                    <div className="space-y-4 mb-4">
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-4xl md:text-6xl font-bold text-white"
                        >
                            {series.title}
                        </motion.h1>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                            {/* Static rating for now as it's not in DB yet, or use defaults */}
                            <span className="flex items-center gap-1 text-green-400"><Star className="w-4 h-4 fill-current" /> 9.8</span>
                            <span>{series.release_year}</span>
                            <span>{series.genre}</span>
                            <span>{series.country}</span>
                        </div>

                        <p className="max-w-2xl text-gray-300 leading-relaxed md:line-clamp-3">
                            {series.description}
                        </p>

                        <div className="flex gap-4 pt-4">
                            <button className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-red-700 text-white rounded-full font-semibold transition-colors">
                                <Play className="w-4 h-4" /> Assistir
                            </button>
                            <button className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors border border-white/20">
                                <Share2 className="w-4 h-4" /> Compartilhar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Player */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedEpisode ? (
                        <>
                            <h2 className="text-2xl font-bold">Assistir: {selectedEpisode.episode_number}. {selectedEpisode.title || `Episódio ${selectedEpisode.episode_number}`}</h2>
                            <VideoPlayer
                                embedUrl={
                                    useAlternativeLink
                                        ? (selectedEpisode.embed_url_2 || activeSource)
                                        : activeSource
                                }
                                placeholder="Este episódio não tem reprodutor embutido. Utilize os links abaixo para assistir ou baixar."
                            />
                        </>
                    ) : (
                        <div className="text-gray-400">Nenhum episódio disponível.</div>
                    )}

                    <div className="flex flex-wrap gap-4 bg-surface p-4 rounded-lg">
                        {/* Play Actions (Instead of Download) */}
                        {/* Play Actions (Instead of Download) */}
                        {selectedEpisode?.drive_link && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(false);
                                    setActiveSource(transformToEmbed(selectedEpisode.drive_link, 'drive'));
                                }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-sm transition-all font-display font-medium tracking-wide ${activeSource.includes('drive.google')
                                    ? 'bg-primary text-black shadow-[0_0_15px_rgba(212,175,55,0.4)] font-bold'
                                    : 'bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 text-gray-300 hover:text-primary'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${activeSource.includes('drive.google') ? 'fill-black' : 'fill-current'}`} />
                                ASSITIR NO DRIVE
                            </button>
                        )}
                        {selectedEpisode?.mega_link && (
                            <a href={selectedEpisode.mega_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-gray-300 hover:text-red-400 rounded-sm transition-all font-display font-medium tracking-wide">
                                <Download className="w-4 h-4" /> MEGA
                            </a>
                        )}
                        {selectedEpisode?.pixeldrain_link && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(false);
                                    setActiveSource(transformToEmbed(selectedEpisode.pixeldrain_link, 'pixeldrain'));
                                }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-sm transition-all font-display font-medium tracking-wide ${activeSource.includes('pixeldrain')
                                    ? 'bg-[#F69220] text-black shadow-[0_0_15px_rgba(246,146,32,0.4)] font-bold'
                                    : 'bg-white/5 border border-white/10 hover:border-[#F69220]/50 hover:bg-[#F69220]/10 text-gray-300 hover:text-[#F69220]'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${activeSource.includes('pixeldrain') ? 'fill-black' : 'fill-current'}`} />
                                PIXELDRAIN
                            </button>
                        )}
                        {selectedEpisode?.youtube_link && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(false);
                                    setActiveSource(transformToEmbed(selectedEpisode.youtube_link, 'youtube'));
                                }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-sm transition-all font-display font-medium tracking-wide ${activeSource.includes('youtube')
                                    ? 'bg-[#FF0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.4)] font-bold'
                                    : 'bg-white/5 border border-white/10 hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10 text-gray-300 hover:text-[#FF0000]'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${activeSource.includes('youtube') ? 'fill-white' : 'fill-current'}`} />
                                YOUTUBE
                            </button>
                        )}

                        {/* Mediafire - Always Download */}
                        {selectedEpisode?.mediafire_link && (
                            <a href={selectedEpisode.mediafire_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 text-gray-300 hover:text-blue-400 rounded-sm transition-all font-display font-medium tracking-wide ml-auto">
                                <Download className="w-4 h-4" /> MEDIAFIRE
                            </a>
                        )}

                        {/* Generic Download Fallback */}
                        {!selectedEpisode?.drive_link && !selectedEpisode?.mega_link && !selectedEpisode?.mediafire_link && !selectedEpisode?.pixeldrain_link && selectedEpisode?.download_link && (
                            <a href={selectedEpisode.download_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                                <Download className="w-4 h-4" /> Download
                            </a>
                        )}

                        {/* Alternative Player Toggle */}
                        {selectedEpisode?.embed_url_2 && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(!useAlternativeLink);
                                    if (!useAlternativeLink) setActiveSource(selectedEpisode.embed_url_2);
                                    else setActiveSource(selectedEpisode.embed_url_1 || '');
                                }}
                                className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${useAlternativeLink
                                    ? 'bg-primary text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {useAlternativeLink ? 'Usando Player Alternativo' : 'Problemas? Link Alternativo'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Episode List */}
                <div className="bg-surface rounded-lg p-6 h-fit sticky top-24">
                    <h3 className="text-xl font-bold mb-4">Episódios</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {episodes.map((ep) => (
                            <motion.div
                                key={ep.id}
                                whileHover={{ x: 4 }}
                                onClick={() => handleEpisodeSelect(ep)}
                                className={`p-4 rounded-lg cursor-pointer transition-colors flex justify-between items-center ${selectedEpisode?.id === ep.id
                                    ? 'bg-primary/20 border border-primary/50'
                                    : 'bg-background hover:bg-gray-800'
                                    }`}
                            >
                                <div>
                                    <h4 className="font-semibold text-sm">Episódio {ep.episode_number}</h4>
                                    <p className="text-xs text-gray-400">{ep.title || `Episódio ${ep.episode_number}`}</p>
                                </div>
                                <Play className={`w-4 h-4 ${selectedEpisode?.id === ep.id ? 'text-primary' : 'text-gray-500'}`} />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
