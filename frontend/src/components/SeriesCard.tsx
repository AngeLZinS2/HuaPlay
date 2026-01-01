import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus, ThumbsUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SeriesCardProps {
    item: any;
    onOpenModal: (series: any) => void;
    isFirst?: boolean;
    isLast?: boolean;
}

export default function SeriesCard({ item, onOpenModal, isFirst, isLast }: SeriesCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [showTrailer, setShowTrailer] = useState(false);
    const timeoutRef = useRef<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isHovered) {
            timeoutRef.current = setTimeout(() => {
                setShowTrailer(true);
            }, 600); // reduced delay slightly for snappier feel
        } else {
            clearTimeout(timeoutRef.current);
            setShowTrailer(false);
        }
        return () => clearTimeout(timeoutRef.current);
    }, [isHovered]);

    const handlePlayClick = (e: any) => {
        e.stopPropagation();
        navigate(`/series/${item.slug || item.id}`);
    };

    return (
        <div
            className="group relative flex-none w-[140px] md:w-[200px] h-[210px] md:h-[300px] z-[0] hover:z-[999]" // Wrapper maintains layout size
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                className="w-full h-full bg-[#181818] rounded-md shadow-xl overflow-hidden origin-center"
                animate={
                    showTrailer
                        ? {
                            width: 320,
                            height: 'auto',
                            top: -25, // Reduced from -50 to keep it closer to the line
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
                            scale: isHovered ? 1.05 : 1,
                            position: 'absolute',
                            zIndex: isHovered ? 50 : 0
                        }
                }
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                {/* Media Container */}
                <div className={`relative w-full ${showTrailer ? 'aspect-video' : 'h-full'} bg-black transition-all duration-300 overflow-hidden`}>
                    {showTrailer && item.trailer_url ? (
                        <iframe
                            src={`${item.trailer_url}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${item.trailer_url.split('/').pop()}`}
                            className="w-full h-full object-cover pointer-events-none scale-[1.50]"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            title={item.title}
                        />
                    ) : showTrailer ? (
                        <img
                            src={item.banner_image || item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            src={item.cover_image || item.image}
                            alt={item.title}
                            className="w-full h-full object-cover transition-opacity duration-300"
                        />
                    )}
                </div>

                {/* Info Content - Only shown when expanded */}
                <motion.div
                    className="p-4"
                    initial={{ opacity: 0 }}
                    animate={showTrailer ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePlayClick}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                            >
                                <Play className="w-4 h-4 fill-black text-black pl-0.5" />
                            </button>
                            <button className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-400 hover:border-white hover:text-white transition-colors">
                                <Plus className="w-4 h-4" />
                            </button>
                            <button className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-400 hover:border-white hover:text-white transition-colors">
                                <ThumbsUp className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={() => onOpenModal(item)}
                            className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-400 hover:border-white hover:text-white transition-colors"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Metadata */}
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
                </motion.div>
            </motion.div>
        </div>
    );
}
