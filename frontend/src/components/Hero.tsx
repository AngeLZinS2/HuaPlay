import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus, Check, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { addToMyList, removeFromMyList } from '../services/userData';
import { useToast } from '../context/ToastContext';
import { getTrailerEmbed } from '../utils/trailer';
import { getOptimizedImageUrl } from '../utils/image';

export default function Hero() {
    const [featured, setFeatured] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const navigate = useNavigate();
    const { uid, currentProfile, myListIds, updateLists, isAuthenticated } = useAuth();
    const { addToast } = useToast();

    const isInList = featured ? myListIds.includes(featured.id) : false;

    const handleToggleList = async () => {
        if (!featured) return;
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        try {
            if (!uid || !currentProfile) return;
            if (isInList) {
                await removeFromMyList(uid, currentProfile.id, featured.id);
                addToast('Removido da sua lista', 'info');
            } else {
                await addToMyList(uid, currentProfile.id, featured.id);
                addToast('Adicionado à sua lista', 'success');
            }
            await updateLists();
        } catch (error) {
            console.error("Failed to update list", error);
            addToast('Erro ao atualizar lista', 'error');
        }
    };

    useEffect(() => {
        const fetchFeatured = async () => {
            try {
                const response = await api.get('/series/hero-featured');
                if (response.data) {
                    setFeatured(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch hero featured series:", error);
                try {
                    const fallbackRes = await api.get('/series/?limit=30');
                    const pool = (fallbackRes.data || []).filter((s: any) => s.banner_image);
                    if (pool.length > 0) {
                        setFeatured(pool[Math.floor(Math.random() * pool.length)]);
                    }
                } catch (e) {
                    console.error("Fallback featured failed:", e);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchFeatured();
    }, []);

    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const command = isMuted ? 'mute' : 'unMute';
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                'event': 'command',
                'func': command,
                'args': []
            }), '*');
        }
    }, [isMuted, featured]);

    if (loading) {
        return <div className="relative h-screen w-full bg-black" />;
    }

    if (!featured) {
        return (
            <div className="relative h-screen w-full overflow-hidden bg-black">
                <div className="absolute inset-0 select-none pointer-events-none">
                    <img
                        src="/Banner Wei.png"
                        alt="HuaPlay"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                </div>
                <div className="relative h-full w-full px-4 flex flex-col items-center justify-end pb-40">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center"
                    >
                        <p className="text-xl md:text-2xl text-gray-200 font-light tracking-widest uppercase drop-shadow-lg bg-black/30 backdrop-blur-sm py-2 px-6 rounded-full border border-white/10">
                            O melhor do entretenimento asiático para você
                        </p>
                    </motion.div>
                </div>
            </div>
        );
    }



    // Single source of truth: the mute control must follow whether a trailer is
    // actually playing, not merely whether the series has a trailer_url. A series
    // in BANNER mode shows a still image even when it has one, and a link we
    // cannot turn into an embed falls back to the still image too — rendering the
    // iframe anyway is what left the banner black for non-YouTube embed links.
    const trailer = getTrailerEmbed(featured.trailer_url, { hd: true });
    const showsTrailer = Boolean(
        trailer && (featured.feature_type === 'TRAILER' || !featured.feature_type),
    );

    return (
        <div className="relative h-screen w-full overflow-hidden">
            {/* Background Video/Image */}
            <div className="absolute inset-0 select-none pointer-events-none">
                {showsTrailer ? (
                    <>
                        {/* Mobile: Show Image Fallback */}
                        <div className="block md:hidden w-full h-full relative bg-neutral-950">
                            <img
                                src={getOptimizedImageUrl(featured.banner_image || featured.cover_image, 'backdrop')}
                                alt={featured.title}
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Desktop: Show Trailer */}
                        <div className="hidden md:block relative w-full h-full overflow-hidden">
                            <iframe
                                ref={iframeRef}
                                src={trailer?.src}
                                title={featured.title}
                                className="absolute top-1/2 left-1/2 w-[150vw] h-[150vh] -translate-x-1/2 -translate-y-1/2 pointer-events-none object-cover"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                referrerPolicy="strict-origin-when-cross-origin"
                            />
                        </div>
                    </>
                ) : (
                    <img
                        src={getOptimizedImageUrl(featured.banner_image || featured.cover_image, 'backdrop')}
                        alt={featured.title}
                        decoding="async"
                        className="w-full h-full object-cover"
                    />
                )}
                {/* Cinematic Gradient Overlays */}
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/40 to-transparent" />
                <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#050505] to-transparent" />
            </div>

            {/* Content */}
            <div className="relative h-full w-full px-6 md:px-12 lg:px-20 flex items-center pt-16 md:pt-20 lg:pt-24 pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="max-w-4xl space-y-4 md:space-y-6 lg:space-y-8"
                >
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center gap-3 mb-4"
                    >
                        <div className="h-[2px] w-8 md:w-12 bg-primary"></div>
                        <span className="text-primary font-display font-bold tracking-[0.2em] text-xs md:text-sm uppercase glow-text">
                            Destaque Semanal
                        </span>
                    </motion.div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-2xl max-w-4xl">
                        {featured.title}
                    </h1>

                    <div className="flex items-center gap-3 md:gap-6 text-gray-200 font-sans text-sm md:text-lg tracking-wide border-l-2 border-primary pl-4">
                        <span className="text-primary font-bold">98% Match</span>
                        <span>{featured.release_year}</span>
                        <span className="px-2 py-0.5 border border-white/20 rounded text-xs bg-black/40 backdrop-blur-sm">{featured.status}</span>
                        <span className="px-2 py-0.5 border border-white/20 rounded text-xs bg-black/40 backdrop-blur-sm">HD</span>
                    </div>

                    <p className="text-gray-300 text-sm md:text-lg max-w-xl md:max-w-2xl line-clamp-3 font-light leading-relaxed drop-shadow-md">
                        {featured.description || "Uma história envolvente que vai prender sua atenção do início ao fim. Descubra os segredos e emoções desta incrível produção asiática."}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-4 md:pt-6">
                        <motion.button
                            whileHover={{ scale: 1.05, textShadow: "0 0 8px rgba(212, 175, 55, 0.5)" }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/series/${featured.slug || featured.id}`)}
                            className="group flex items-center gap-2 md:gap-3 px-6 py-3 md:px-10 md:py-4 bg-gradient-to-r from-primary to-[#b8860b] text-black rounded-sm font-display font-bold text-base md:text-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] w-full md:w-auto justify-center"
                        >
                            <Play className="w-5 h-5 md:w-6 md:h-6 fill-black group-hover:fill-current transition-colors" />
                            ASSISTIR AGORA
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05, borderColor: "#D4AF37", color: "#D4AF37" }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleToggleList}
                            className={`flex items-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 border border-white/30 backdrop-blur-md rounded-sm font-display font-bold text-base md:text-xl transition-all hover:bg-black/60 w-full md:w-auto justify-center ${isInList ? 'bg-primary/20 text-primary border-primary' : 'bg-black/40 text-white'}`}
                        >
                            {isInList ? <Check className="w-5 h-5 md:w-6 md:h-6" /> : <Plus className="w-5 h-5 md:w-6 md:h-6" />}
                            {isInList ? 'NA LISTA' : 'MINHA LISTA'}
                        </motion.button>

                    </div>
                </motion.div>
            </div>

            {/* Mute toggle. Anchored to the hero itself rather than the text
                column, and only rendered while the trailer is on screen — the
                trailer is desktop-only, so the control is too. */}
            {showsTrailer && trailer?.supportsMuteApi && (
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    aria-label={isMuted ? 'Ativar som do trailer' : 'Silenciar trailer'}
                    title={isMuted ? 'Ativar som' : 'Silenciar'}
                    className="hidden md:flex absolute bottom-28 right-6 md:right-12 lg:right-20 z-20 items-center justify-center p-4 border border-white/10 rounded-full text-gray-400 hover:text-primary hover:border-primary/50 bg-black/60 backdrop-blur-md transition-all"
                >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
            )}
        </div>
    );
}
