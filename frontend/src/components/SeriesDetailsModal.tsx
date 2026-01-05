import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Check, ThumbsUp, X, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { getYouTubeEmbedUrl, getYouTubeVideoId } from '../utils/youtube';

export default function SeriesDetailsModal() {
    const { isOpen, content: selectedSeries, closeModal } = useModal();
    const [modalEpisodes, setModalEpisodes] = useState<any[]>([]);
    const [isMuted, setIsMuted] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const navigate = useNavigate();
    const { myListIds, myLikeIds, updateLists, isAuthenticated } = useAuth();
    const { addToast } = useToast();

    // Derived states
    const isInList = selectedSeries ? myListIds.includes(selectedSeries.id) : false;
    const isLiked = selectedSeries ? myLikeIds.includes(selectedSeries.id) : false;

    // Reset state when modal opens/closes or series changes
    useEffect(() => {
        if (isOpen && selectedSeries) {
            fetchEpisodes(selectedSeries.id);
            setIsMuted(true);
        } else {
            setModalEpisodes([]);
        }
    }, [isOpen, selectedSeries]);

    const fetchEpisodes = async (id: number) => {
        try {
            const response = await api.get(`/series/${id}/episodes`);
            setModalEpisodes(response.data);
        } catch (error) {
            console.error("Failed to fetch episodes for modal:", error);
        }
    };

    // Handle seamless audio toggle via postMessage for YouTube iframe
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

    const handleToggleList = async () => {
        if (!selectedSeries) return;
        if (!isAuthenticated) {
            navigate('/login');
            closeModal();
            return;
        }
        try {
            if (isInList) {
                await api.delete(`/users/me/list/${selectedSeries.id}`);
                addToast('Removido da sua lista', 'info');
            } else {
                await api.post(`/users/me/list/${selectedSeries.id}`);
                addToast('Adicionado à sua lista', 'success');
            }
            await updateLists();
        } catch (error) {
            console.error(error);
            addToast('Erro ao atualizar lista', 'error');
        }
    };

    const handleToggleLike = async () => {
        if (!selectedSeries) return;
        if (!isAuthenticated) {
            navigate('/login');
            closeModal();
            return;
        }
        try {
            if (isLiked) {
                await api.delete(`/users/me/likes/${selectedSeries.id}`);
                addToast('Você descurtiu', 'info');
            } else {
                await api.post(`/users/me/likes/${selectedSeries.id}`);
                addToast('Você curtiu!', 'success');
            }
            await updateLists();
        } catch (error) {
            console.error(error);
            addToast('Erro ao atualizar curtida', 'error');
        }
    };

    const handlePlay = (id: number) => {
        closeModal();
        navigate(`/series/${id}`);
    };

    return (
        <AnimatePresence>
            {isOpen && selectedSeries && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={closeModal}
                    />

                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-4xl h-full bg-[#0a0a0a] shadow-2xl overflow-y-auto border-l border-white/10"
                    >
                        <button
                            onClick={closeModal}
                            className="absolute top-6 right-6 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/70 hover:text-white hover:bg-primary/20 transition-all border border-white/5 hover:border-primary/50"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {/* Header Image Area */}
                        <div className="relative aspect-video w-full">
                            {selectedSeries.trailer_url && getYouTubeEmbedUrl(selectedSeries.trailer_url) ? (
                                <iframe
                                    ref={iframeRef}
                                    src={`${getYouTubeEmbedUrl(selectedSeries.trailer_url)}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${getYouTubeVideoId(selectedSeries.trailer_url)}`}
                                    className="w-full h-full object-cover pointer-events-none"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                />
                            ) : (
                                <img
                                    src={selectedSeries.banner || selectedSeries.banner_image || selectedSeries.image || selectedSeries.cover_image}
                                    alt={selectedSeries.title}
                                    className="w-full h-full object-cover"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
                        </div>

                        {/* Content Area */}
                        <div className="px-4 md:px-12 -mt-20 md:-mt-32 relative z-10 pb-20">
                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4 drop-shadow-xl leading-tight">
                                {selectedSeries.title}
                            </h2>

                            <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-8">
                                <button
                                    onClick={() => handlePlay(selectedSeries.id)}
                                    className="px-6 py-2 md:px-8 md:py-3 bg-primary text-black font-display font-bold text-base md:text-lg rounded-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)] flex items-center gap-2 flex-grow md:flex-grow-0 justify-center"
                                >
                                    <Play className="w-5 h-5 fill-black" /> ASSISTIR
                                </button>
                                <button
                                    onClick={handleToggleList}
                                    className={`p-2 md:p-3 border rounded-sm transition-all backdrop-blur-sm ${isInList ? 'border-primary text-primary bg-primary/20' : 'border-white/20 text-gray-300 hover:border-primary hover:text-primary bg-black/40'}`}
                                >
                                    {isInList ? <Check className="w-5 h-5 md:w-6 md:h-6" /> : <Plus className="w-5 h-5 md:w-6 md:h-6" />}
                                </button>
                                <button
                                    onClick={handleToggleLike}
                                    className={`p-2 md:p-3 border rounded-sm transition-all backdrop-blur-sm ${isLiked ? 'border-primary text-primary bg-primary/20' : 'border-white/20 text-gray-300 hover:border-primary hover:text-primary bg-black/40'}`}
                                >
                                    <ThumbsUp className={`w-5 h-5 md:w-6 md:h-6 ${isLiked ? 'fill-current' : ''}`} />
                                </button>
                                {selectedSeries.trailer_url && (
                                    <button
                                        onClick={() => setIsMuted(!isMuted)}
                                        className="ml-auto p-2 md:p-3 border border-white/20 rounded-full text-gray-300 hover:text-white bg-black/40 backdrop-blur-sm"
                                    >
                                        {isMuted ? <VolumeX className="w-5 h-5 md:w-6 md:h-6" /> : <Volume2 className="w-5 h-5 md:w-6 md:h-6" />}
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8 md:gap-12 mb-12">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 text-sm font-medium">
                                        <span className="text-primary">98% Match</span>
                                        <span className="text-gray-400">{selectedSeries.release_year}</span>
                                        <span className="border border-white/20 px-2 py-0.5 rounded text-xs text-gray-300">HD</span>
                                        <span className="border border-white/20 px-2 py-0.5 rounded text-xs text-gray-300">Legendado</span>
                                    </div>
                                    <p className="text-gray-300 text-base md:text-lg leading-relaxed font-light">
                                        {selectedSeries.description}
                                    </p>
                                </div>
                                <div className="space-y-4 text-sm border-l border-white/10 pl-6 md:pl-8">
                                    <div>
                                        <span className="block text-gray-500 mb-1">Elenco</span>
                                        <span className="text-gray-200">{selectedSeries.cast || "Não informado"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 mb-1">Gêneros</span>
                                        <span className="text-gray-200">{selectedSeries.genre || "Variados"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 mb-1">Mood</span>
                                        <span className="text-gray-200">{selectedSeries.moods || "Envolvente, Emocionante"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Episodes Section */}
                            <div className="border-t border-white/10 pt-10 pb-10">
                                <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                                    <span className="h-6 w-1 md:h-8 bg-primary rounded-full" />
                                    Episódios
                                </h3>

                                <div className="grid grid-cols-1 gap-4">
                                    {modalEpisodes.map((ep, index) => (
                                        <div
                                            key={ep.id}
                                            onClick={() => handlePlay(selectedSeries.id)}
                                            className="group flex items-center gap-4 md:gap-6 p-3 md:p-4 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                                        >
                                            <span className="text-xl md:text-2xl font-display font-bold text-gray-600 group-hover:text-primary transition-colors min-w-[2rem]">
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <div className="w-32 md:w-40 aspect-video bg-gray-900 rounded-sm overflow-hidden relative shadow-lg flex-shrink-0">
                                                <img
                                                    src={selectedSeries.banner || selectedSeries.image}
                                                    alt={ep.title}
                                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                                    <Play className="w-6 h-6 md:w-8 md:h-8 fill-white text-white drop-shadow-lg" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1 md:mb-2">
                                                    <h4 className="text-base md:text-lg font-bold text-white group-hover:text-primary transition-colors truncate pr-2">
                                                        {ep.title}
                                                    </h4>
                                                    <span className="text-xs text-gray-500 font-mono hidden sm:block">45m</span>
                                                </div>
                                                <p className="text-gray-400 text-xs md:text-sm line-clamp-2 font-light">
                                                    {selectedSeries.description.substring(0, 120)}...
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {modalEpisodes.length === 0 && (
                                        <div className="text-gray-500 py-8 text-center border border-dashed border-white/10 rounded-lg">
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
    );
}
