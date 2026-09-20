import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus, Check, ThumbsUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addToMyList, removeFromMyList, likeSeries, unlikeSeries } from '../services/userData';
import { useToast } from '../context/ToastContext';
import { getTrailerEmbed } from '../utils/trailer';
import { getOptimizedImageUrl } from '../utils/image';

interface SeriesCardProps {
    item: any;
    onOpenModal: (series: any) => void;
    isFirst?: boolean;
    isLast?: boolean;
    variant?: 'default' | 'profile';
}

export default function SeriesCard({ item, onOpenModal, isFirst, isLast, variant = 'default' }: SeriesCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [showTrailer, setShowTrailer] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const timeoutRef = useRef<any>(null);
    const navigate = useNavigate();
    const { uid, currentProfile, isAuthenticated, myListIds, myLikeIds, updateLists } = useAuth();
    const { addToast } = useToast();
    // null when the link cannot be embedded, so the hover preview keeps the
    // poster instead of swapping in a dead iframe.
    const trailer = getTrailerEmbed(item.trailer_url);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Local optimistic UI state
    const [isInList, setIsInList] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (myListIds) setIsInList(myListIds.includes(item.id));
        if (myLikeIds) setIsLiked(myLikeIds.includes(item.id));
    }, [myListIds, myLikeIds, item.id]);

    useEffect(() => {
        if (variant === 'profile' || isMobile) return; // Disable expansion for profile variant or mobile

        if (isHovered) {
            timeoutRef.current = setTimeout(() => {
                setShowTrailer(true);
            }, 600);
        } else {
            clearTimeout(timeoutRef.current);
            setShowTrailer(false);
        }
        return () => clearTimeout(timeoutRef.current);
    }, [isHovered, variant, isMobile]);

    const handlePlayClick = (e: any) => {
        e.stopPropagation();
        navigate(`/series/${item.slug || item.id}`);
    };

    const handleToggleList = async (e: any) => {
        e.stopPropagation();
        if (!isAuthenticated) {
            addToast('Faça login para adicionar à sua lista', 'error');
            return;
        }

        const previousState = isInList;
        setIsInList(!previousState); // Optimistic

        try {
            if (previousState) {
                await removeFromMyList(uid!, currentProfile!.id, item.id);
                addToast('Removido da sua lista', 'success');
            } else {
                await addToMyList(uid!, currentProfile!.id, item.id);
                addToast('Adicionado à sua lista', 'success');
            }
            updateLists(); // Background sync
        } catch (error) {
            setIsInList(previousState); // Revert
            addToast('Erro ao atualizar lista', 'error');
        }
    };

    const handleToggleLike = async (e: any) => {
        e.stopPropagation();
        if (!isAuthenticated) {
            addToast('Faça login para curtir', 'error');
            return;
        }

        const previousState = isLiked;
        setIsLiked(!previousState);

        try {
            if (previousState) {
                await unlikeSeries(uid!, currentProfile!.id, item.id);
            } else {
                await likeSeries(uid!, currentProfile!.id, item.id);
                addToast('Marcado como Gostei', 'success');
            }
            updateLists();
        } catch (error) {
            setIsLiked(previousState);
            addToast('Erro ao atualizar', 'error');
        }
    };

    return (
        <div
            className="group relative flex-none w-[140px] md:w-[200px] h-[210px] md:h-[300px] z-[0] hover:z-[999]"
            onMouseEnter={() => !isMobile && setIsHovered(true)}
            onMouseLeave={() => !isMobile && setIsHovered(false)}
            onClick={() => isMobile && onOpenModal(item)}
        >
            <motion.div
                className="w-full h-full bg-[#181818] rounded-md shadow-xl overflow-hidden origin-center"
                animate={
                    showTrailer && !isMobile
                        ? {
                            width: 320,
                            height: 'auto',
                            top: -25,
                            left: isFirst ? 0 : isLast ? -120 : -60,
                            scale: 1.1,
                            position: 'absolute',
                            zIndex: 999
                        }
                        : {
                            width: '100%',
                            height: '100%',
                            top: 0,
                            left: 0,
                            scale: isHovered && variant !== 'profile' && !isMobile ? 1.05 : 1,
                            position: 'absolute',
                            zIndex: isHovered && !isMobile ? 50 : 0
                        }
                }
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                {/* Media Container */}
                <div className={`relative w-full ${showTrailer && !isMobile ? 'aspect-video' : 'h-full'} bg-neutral-900 transition-all duration-300 overflow-hidden`}>
                    {/* Skeleton loader while image is fetching */}
                    {!imageLoaded && !showTrailer && (
                        <div className="absolute inset-0 bg-neutral-900 animate-pulse flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
                        </div>
                    )}

                    {showTrailer && !isMobile && trailer ? (
                        <iframe
                            src={trailer.src}
                            className="w-full h-full object-cover pointer-events-none scale-[1.50]"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            title={item.title}
                            referrerPolicy="strict-origin-when-cross-origin"
                        />
                    ) : (
                        <img
                            src={imageError ? (item.banner_image || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop") : getOptimizedImageUrl(item.cover_image || item.image, 'poster')}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            onLoad={() => setImageLoaded(true)}
                            onError={() => {
                                setImageError(true);
                                setImageLoaded(true);
                            }}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                {/* Info Content - Only shown when expanded or on hover in profile variant */}
                <motion.div
                    className={`p-4 ${variant === 'profile' ? 'absolute inset-0 bg-black/80 flex flex-col justify-center items-center gap-4' : ''}`}
                    initial={{ opacity: 0 }}
                    animate={showTrailer || (variant === 'profile' && isHovered) ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Action Buttons */}
                    <div className={`flex items-center ${variant === 'profile' ? 'justify-center gap-4 w-full' : 'justify-between mb-3'}`}>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePlayClick}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                            >
                                <Play className="w-4 h-4 fill-black text-black pl-0.5" />
                            </button>
                            <button
                                onClick={handleToggleList}
                                className={`w-8 h-8 border-2 rounded-full flex items-center justify-center transition-colors ${isInList
                                    ? 'border-green-500 bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                    : 'border-gray-400 text-gray-400 hover:border-white hover:text-white'
                                    }`}
                                title={isInList ? "Remover da Lista" : "Adicionar à Lista"}
                            >
                                {isInList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={handleToggleLike}
                                className={`w-8 h-8 border-2 rounded-full flex items-center justify-center transition-colors ${isLiked
                                    ? 'border-[#E50914] bg-[#E50914]/10 text-[#E50914] hover:bg-[#E50914]/20'
                                    : 'border-gray-400 text-gray-400 hover:border-white hover:text-white'
                                    }`}
                            >
                                <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                        {variant !== 'profile' && (
                            <button
                                onClick={() => onOpenModal(item)}
                                className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-400 hover:border-white hover:text-white transition-colors"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Metadata - Only for default variant */}
                    {variant !== 'profile' && (
                        <div>
                            <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{item.title}</h3>
                            <div className="flex items-center gap-2 text-[10px] font-semibold mb-1">
                                <span className="text-green-500">98% Relevante</span>
                                <span className="border border-gray-500 px-1 text-gray-400">16</span>
                                <span className="text-gray-400">{item.duration}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-white">
                                <span>{item.genre}</span>
                                <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
}
