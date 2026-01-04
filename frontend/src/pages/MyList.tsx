
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import SeriesCard from '../components/SeriesCard';
import { getMyList, getMyLikes } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function MyList() {
    const { isAuthenticated } = useAuth();
    const [myList, setMyList] = useState<any[]>([]);
    const [myLikes, setMyLikes] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'mylist' | 'likes'>('mylist');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAuthenticated) {
            fetchLists();
        }
    }, [isAuthenticated]);

    const fetchLists = async () => {
        setLoading(true);
        try {
            const [listData, likesData] = await Promise.all([getMyList(), getMyLikes()]);
            setMyList(listData);
            setMyLikes(likesData);
        } catch (error) {
            console.error("Failed to fetch lists", error);
        } finally {
            setLoading(false);
        }
    };

    // Placeholder for modal - In real app, reuse Home's modal logic or create a Context for it
    const handleOpenModal = (series: any) => {
        console.log("Open modal for", series);
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
                <Navbar />
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
            <Navbar />

            <div className="pt-24 px-4 md:px-12 pb-12">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        {currentItems.length > 0 ? (
                            currentItems.map((item, index) => (
                                <div key={item.id} className="relative h-[160px] md:h-[300px]">
                                    {/* Wrapping in div to impose size constraints if SeriesCard behaves unexpectedly */}
                                    <SeriesCard
                                        item={item}
                                        onOpenModal={handleOpenModal}
                                        isFirst={index % 5 === 0}
                                        isLast={(index + 1) % 5 === 0}
                                    />
                                </div>
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
