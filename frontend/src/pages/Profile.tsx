import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, Clock, Heart, List } from 'lucide-react';
import SeriesCard from '../components/SeriesCard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const { logout, isAuthenticated, currentProfile, user, isLoading } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'watching' | 'likes' | 'list'>('watching');
    const [history, setHistory] = useState<any[]>([]);
    const [myList, setMyList] = useState<any[]>([]);
    const [myLikes, setMyLikes] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (isLoading) return; // Wait for auth check

        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        const fetchProfileData = async () => {
            try {
                // Fetch history (mock endpoint structure for now)
                const historyRes = await api.get('/users/me/history');
                setHistory(historyRes.data);

                // Fetch my list
                const listRes = await api.get('/users/me/list');
                setMyList(listRes.data);

                // Fetch likes
                const likesRes = await api.get('/users/me/likes');
                setMyLikes(likesRes.data);

            } catch (error) {
                console.error("Failed to fetch profile data:", error);
            } finally {
                setDataLoading(false);
            }
        };

        fetchProfileData();
    }, [currentProfile, isAuthenticated, isLoading]); // Reload when profile changes

    const tabs = [
        { id: 'watching', label: 'Assistindo', icon: Clock },
        { id: 'likes', label: 'Curtidas', icon: Heart },
        { id: 'list', label: 'Minha Lista', icon: List },
    ];

    if (isLoading || dataLoading) {
        return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
    }

    // Display info: Priority to Current Profile, then User Info
    const displayName = currentProfile?.name || user?.full_name || user?.email || "Usuário";
    const displayAvatar = currentProfile?.avatar_url || user?.avatar_url;
    const displayEmail = user?.email;

    return (
        <div className="min-h-screen pb-20 pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-12">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-full p-[2px] bg-gradient-to-tr from-primary to-neon-blue">
                        <div className="w-full h-full rounded-full bg-surface overflow-hidden">
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                {displayAvatar ? (
                                    <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-16 h-16 text-gray-400" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center md:text-left space-y-2">
                    <h1 className="text-3xl font-bold text-white uppercase">{displayName}</h1>
                    <p className="text-gray-400">{displayEmail}</p>
                    <button
                        onClick={() => {
                            logout();
                            navigate('/');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors mx-auto md:mx-0 text-red-400"
                    >
                        <Settings className="w-4 h-4" />
                        Sair
                    </button>
                    <button
                        onClick={() => navigate('/profiles')}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors mx-auto md:mx-0 text-gray-300"
                    >
                        <User className="w-4 h-4" />
                        Gerenciar Perfis
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-800 mb-8 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-t-lg transition-colors relative ${activeTab === tab.id ? 'text-primary' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6"
                >
                    {activeTab === 'watching' && history.map(item => (
                        <SeriesCard key={item.id} item={item} onOpenModal={() => { }} variant="profile" />
                    ))}
                    {activeTab === 'likes' && myLikes.length > 0 ? (
                        myLikes.map(item => (
                            <SeriesCard key={item.id} item={item} onOpenModal={() => { }} variant="profile" />
                        ))
                    ) : activeTab === 'likes' ? (
                        <p className="col-span-full text-center text-gray-500 py-10">Nenhuma curtida ainda.</p>
                    ) : null}
                    {activeTab === 'list' && myList.map(item => (
                        <SeriesCard key={item.id} item={item} onOpenModal={() => { }} variant="profile" />
                    ))}

                    {activeTab === 'list' && myList.length === 0 && (
                        <p className="col-span-full text-center text-gray-500 py-10">Sua lista está vazia.</p>
                    )}

                    {activeTab === 'watching' && history.length === 0 && (
                        <p className="col-span-full text-center text-gray-500 py-10">Nada por aqui ainda...</p>
                    )}
                </motion.div>
            </AnimatePresence>
        </div >
    );
}
