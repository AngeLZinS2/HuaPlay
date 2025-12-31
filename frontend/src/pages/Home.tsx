import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, ThumbsUp, X, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import SeriesRow from '../components/SeriesRow';
import api from '../services/api';

export default function Home() {
    const [series, setSeries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSeries, setSelectedSeries] = useState<any | null>(null);
    const [modalEpisodes, setModalEpisodes] = useState<any[]>([]);
    const [isMuted, setIsMuted] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSeries = async () => {
            try {
                const response = await api.get('/series/');
                const mappedSeries = response.data.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    image: item.cover_image || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
                    banner_image: item.banner_image,
                    banner: item.banner_image,
                    match: "98% Relevante",
                    duration: `${item.release_year}`,
                    genre: item.genre,
                    description: item.description,
                    trailer_url: item.trailer_url,
                    release_year: item.release_year,
                    cast: item.cast || "Elenco não informado",
                    moods: "Envolvente, Emocionante", // Mocked for demo
                }));
                setSeries(mappedSeries);
            } catch (error) {
                console.error("Failed to fetch series:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSeries();
    }, []);

    // Handle seamless audio toggle via postMessage
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const command = isMuted ? 'mute' : 'unMute';
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                'event': 'command',
                'func': command,
                'args': []
            }), '*');
        }
    }, [isMuted]);

    const handleOpenModal = async (seriesItem: any) => {
        setSelectedSeries(seriesItem);
        // Fetch episodes
        try {
            const response = await api.get(`/series/${seriesItem.id}/episodes`);
            setModalEpisodes(response.data);
        } catch (error) {
            console.error("Failed to fetch episodes for modal:", error);
        }
    };

    const handleCloseModal = () => {
        setSelectedSeries(null);
        setModalEpisodes([]);
        setIsMuted(true);
    };

    const handlePlay = (id: number) => {
        navigate(`/series/${id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden">
            <Hero />

            <div className="relative z-10 -mt-12 space-y-12">
                {series.length > 0 ? (
                    <>
                        <SeriesRow title="Em Alta" series={series} onOpenModal={handleOpenModal} />
                        <SeriesRow title="Novos Lançamentos" series={[...series].reverse()} onOpenModal={handleOpenModal} />
                        <SeriesRow title="Séries Adicionadas Recentemente" series={series} onOpenModal={handleOpenModal} />
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-20">
                        Nenhuma série encontrada. O administrador precisa adicionar conteúdo.
                    </div>
                )}
            </div>

            {/* Premium Detail Modal - Glassmorphism Side Panel Style */}
            <AnimatePresence>
                {selectedSeries && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={handleCloseModal}
                        />

                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-4xl h-full bg-[#0a0a0a] shadow-2xl overflow-y-auto border-l border-white/10"
                        >
                            <button
                                onClick={handleCloseModal}
                                className="absolute top-6 right-6 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/70 hover:text-white hover:bg-primary/20 transition-all border border-white/5 hover:border-primary/50"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            {/* Header Image Area */}
                            <div className="relative aspect-video w-full">
                                {selectedSeries.trailer_url ? (
                                    <iframe
                                        ref={iframeRef}
                                        src={`${selectedSeries.trailer_url}?enablejsapi=1&autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${selectedSeries.trailer_url.split('/').pop()}`}
                                        className="w-full h-full object-cover pointer-events-none"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    />
                                ) : (
                                    <img
                                        src={selectedSeries.banner || selectedSeries.image}
                                        alt={selectedSeries.title}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
                            </div>

                            {/* Content Area */}
                            <div className="px-8 md:px-12 -mt-32 relative z-10">
                                <h2 className="text-5xl md:text-6xl font-display font-bold text-white mb-4 drop-shadow-xl loading-none">
                                    {selectedSeries.title}
                                </h2>

                                <div className="flex items-center gap-4 mb-8">
                                    <button
                                        onClick={() => handlePlay(selectedSeries.id)}
                                        className="px-8 py-3 bg-primary text-black font-display font-bold text-lg rounded-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)] flex items-center gap-2"
                                    >
                                        <Play className="w-5 h-5 fill-black" /> ASSISTIR
                                    </button>
                                    <button className="p-3 border border-white/20 rounded-sm text-gray-300 hover:border-primary hover:text-primary transition-all bg-black/40 backdrop-blur-sm">
                                        <Plus className="w-6 h-6" />
                                    </button>
                                    <button className="p-3 border border-white/20 rounded-sm text-gray-300 hover:border-primary hover:text-primary transition-all bg-black/40 backdrop-blur-sm">
                                        <ThumbsUp className="w-6 h-6" />
                                    </button>
                                    {selectedSeries.trailer_url && (
                                        <button
                                            onClick={() => setIsMuted(!isMuted)}
                                            className="ml-auto p-3 border border-white/20 rounded-full text-gray-300 hover:text-white bg-black/40 backdrop-blur-sm"
                                        >
                                            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12 mb-12">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 text-sm font-medium">
                                            <span className="text-primary">98% Match</span>
                                            <span className="text-gray-400">{selectedSeries.release_year}</span>
                                            <span className="border border-white/20 px-2 py-0.5 rounded text-xs text-gray-300">HD</span>
                                            <span className="border border-white/20 px-2 py-0.5 rounded text-xs text-gray-300">Legendado</span>
                                        </div>
                                        <p className="text-gray-300 text-lg leading-relaxed font-light">
                                            {selectedSeries.description}
                                        </p>
                                    </div>
                                    <div className="space-y-4 text-sm border-l border-white/10 pl-8">
                                        <div>
                                            <span className="block text-gray-500 mb-1">Elenco</span>
                                            <span className="text-gray-200">{selectedSeries.cast}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-500 mb-1">Gêneros</span>
                                            <span className="text-gray-200">{selectedSeries.genre}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-500 mb-1">Mood</span>
                                            <span className="text-gray-200">{selectedSeries.moods}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Episodes Section */}
                                <div className="border-t border-white/10 pt-10 pb-20">
                                    <h3 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                                        <span className="h-8 w-1 bg-primary rounded-full" />
                                        Episódios
                                    </h3>

                                    <div className="grid grid-cols-1 gap-4">
                                        {modalEpisodes.map((ep, index) => (
                                            <div
                                                key={ep.id}
                                                onClick={() => handlePlay(selectedSeries.id)}
                                                className="group flex items-center gap-6 p-4 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                                            >
                                                <span className="text-2xl font-display font-bold text-gray-600 group-hover:text-primary transition-colors w-8">
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                                <div className="w-40 aspect-video bg-gray-900 rounded-sm overflow-hidden relative shadow-lg">
                                                    <img
                                                        src={selectedSeries.banner || selectedSeries.image}
                                                        alt={ep.title}
                                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                                        <Play className="w-8 h-8 fill-white text-white drop-shadow-lg" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-2">
                                                        <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors truncate pr-4">
                                                            {ep.title}
                                                        </h4>
                                                        <span className="text-xs text-gray-500 font-mono">45m</span>
                                                    </div>
                                                    <p className="text-gray-400 text-sm line-clamp-2 font-light">
                                                        {selectedSeries.description.substring(0, 120)}...
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {modalEpisodes.length === 0 && (
                                            <div className="text-gray-500 py-8 text-center borderBorder border-dashed border-white/10 rounded-lg">
                                                Nenhum episódio disponível no momento.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
