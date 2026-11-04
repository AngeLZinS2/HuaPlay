
import { useEffect, useState } from 'react';
import { fetchLikedSeries, fetchMyListSeries } from '../services/library';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/image';
import type { Series } from '../types/models';

export default function MyList() {
    const { uid, currentProfile, isAuthenticated } = useAuth();
    const [myList, setMyList] = useState<Series[]>([]);
    const [myLikes, setMyLikes] = useState<Series[]>([]);
    const [activeTab, setActiveTab] = useState<'mylist' | 'likes'>('mylist');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && uid && currentProfile) {
            fetchLists();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, uid, currentProfile?.id]);

    const fetchLists = async () => {
        setLoading(true);
        try {
            const [listData, likesData] = await Promise.all([
                fetchMyListSeries(uid!, currentProfile!.id),
                fetchLikedSeries(uid!, currentProfile!.id),
            ]);
            setMyList(listData);
            setMyLikes(likesData);
        } catch (error) {
            console.error("Failed to fetch lists", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
                    <p>Por favor, faça login para ver sua lista.</p>
                </div>
            </div>
        );
    }

    const currentItems = activeTab === 'mylist' ? myList : myLikes;

    return (
        <div className="min-h-screen bg-[#141414] text-white overflow-x-hidden">
            <div className="px-4 pb-12 pt-24 sm:px-6 md:px-12">
                <h1 className="text-3xl font-bold mb-8">Minha Conta</h1>

                {/* Tabs */}
                <div className="flex gap-8 mb-8 border-b border-gray-800">
                    <button
                        onClick={() => setActiveTab('mylist')}
                        className={`pb-4 text-lg font-medium transition-colors relative ${activeTab === 'mylist' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Minha Lista
                        {activeTab === 'mylist' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-1 bg-[#E50914]"
                            />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('likes')}
                        className={`pb-4 text-lg font-medium transition-colors relative ${activeTab === 'likes' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Curtidos
                        {activeTab === 'likes' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-1 bg-[#E50914]"
                            />
                        )}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E50914]"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6">
                        {currentItems.length > 0 ? (
                            currentItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => navigate(`/series/${item.slug || item.id}`)}
                                    className="group min-w-0 text-left focus:outline-none"
                                    aria-label={`Abrir detalhes de ${item.title}`}
                                >
                                    <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-neutral-900 shadow-lg ring-1 ring-white/5 transition duration-300 group-hover:-translate-y-1 group-hover:ring-yellow-500/60 group-focus-visible:ring-2 group-focus-visible:ring-yellow-400">
                                        <img
                                            src={getOptimizedImageUrl(item.cover_image || item.banner_image, 'poster')}
                                            alt={item.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                                        <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-yellow-500 text-black opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                            <Play className="h-4 w-4 fill-current" />
                                        </span>
                                    </span>
                                    <span className="mt-2 block truncate text-sm font-medium text-gray-200 transition group-hover:text-yellow-400">{item.title}</span>
                                    <span className="mt-0.5 block truncate text-xs text-gray-500">{item.release_year || item.genre || 'HuaPlay'}</span>
                                </button>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-20 text-gray-500">
                                {activeTab === 'mylist'
                                    ? "Sua lista está vazia. Adicione séries para assistir mais tarde."
                                    : "Você ainda não curtiu nenhuma série."}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
