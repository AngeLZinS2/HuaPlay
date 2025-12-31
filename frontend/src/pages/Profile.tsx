import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, Clock, Heart, List, Edit } from 'lucide-react';
import SeriesCard from '../components/SeriesCard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
    const { user: contextUser, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'watching' | 'likes' | 'list'>('watching');
    const [userProfile, setUserProfile] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [myList, setMyList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                // Fetch user profile
                const meRes = await api.get('/users/me');
                setUserProfile(meRes.data);

                // Fetch history (mock endpoint structure for now)
                const historyRes = await api.get('/users/me/history');
                setHistory(historyRes.data);

                // Fetch my list
                const listRes = await api.get('/users/me/list');
                setMyList(listRes.data);

            } catch (error) {
                console.error("Failed to fetch profile data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, []);

    const tabs = [
        { id: 'watching', label: 'Assistindo', icon: Clock },
        { id: 'likes', label: 'Curtidas', icon: Heart },
        { id: 'list', label: 'Minha Lista', icon: List },
    ];

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
    }

    return (
        <div className="min-h-screen pb-20 pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-12">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-full p-[2px] bg-gradient-to-tr from-primary to-neon-blue">
                        <div className="w-full h-full rounded-full bg-surface overflow-hidden">
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                {userProfile?.avatar_url ? (
                                    <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-16 h-16 text-gray-400" />
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-white shadow-lg hover:scale-110 transition-transform">
                        <Edit className="w-4 h-4" />
                    </button>
                </div>

                <div className="text-center md:text-left space-y-2">
                    <h1 className="text-3xl font-bold text-white">{userProfile?.full_name || userProfile?.email || "Usuário"}</h1>
                    <p className="text-gray-400">{userProfile?.email}</p>
                    <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors mx-auto md:mx-0 text-red-400">
                        <Settings className="w-4 h-4" />
                        Sair
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
                        <SeriesCard key={item.id} id={item.id} title={item.title} image={item.cover_image} match="100%" duration="Continue" />
                    ))}
                    {activeTab === 'likes' && <p className="col-span-full text-center text-gray-500 py-10">Nenhuma curtida ainda.</p>}
                    {activeTab === 'list' && myList.map(item => (
                        <SeriesCard key={item.id} id={item.id} title={item.title} image={item.cover_image} match="100%" duration="Saved" />
                    ))}

                    {activeTab === 'watching' && history.length === 0 && (
                        <p className="col-span-full text-center text-gray-500 py-10">Nada por aqui ainda...</p>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
