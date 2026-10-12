import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createProfile, deleteProfile, updateProfile } from '../services/userData';
import api from '../services/api';
import { getOptimizedImageUrl } from '../utils/image';

type BackgroundSeries = { id: number; title: string; banner_image?: string | null; cover_image?: string | null };

const CinematicBackground = ({ items, activeIndex }: { items: BackgroundSeries[]; activeIndex: number }) => {
    const active = items[activeIndex];
    return (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black">
            <AnimatePresence initial={false} mode="sync">
                {active && <motion.div key={active.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ opacity: { duration: 1.8, ease: 'easeInOut' } }} className="absolute inset-0">
                    <motion.img
                        src={getOptimizedImageUrl(active.banner_image || active.cover_image, 'backdrop')}
                        alt=""
                        initial={{ scale: 1.14 }}
                        animate={{ scale: 1 }}
                        transition={{ scale: { duration: 8, ease: 'easeOut' } }}
                        className="h-[72%] w-full object-cover object-center sm:h-full"
                    />
                </motion.div>}
            </AnimatePresence>
            {!active && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#302006_0%,#080604_50%,#000_100%)]" />}
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 via-45% to-black to-75% sm:bg-gradient-to-r sm:from-black/20 sm:via-black/35 sm:to-black/80" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,.55)_100%)]" />
        </div>
    );
};

export default function Profiles() {
    const { uid, profiles, selectProfile, fetchProfiles, logout } = useAuth();
    const [isManaging, setIsManaging] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const navigate = useNavigate();

    const [editingProfile, setEditingProfile] = useState<any | null>(null);
    const [editProfileName, setEditProfileName] = useState('');
    const [editAvatarUrl, setEditAvatarUrl] = useState('');
    const [backgrounds, setBackgrounds] = useState<BackgroundSeries[]>([]);
    const [activeBackground, setActiveBackground] = useState(0);

    useEffect(() => {
        api.get('/series/', { params: { limit: 30, skip: 0 } }).then(response => {
            const usable = (response.data || []).filter((item: BackgroundSeries) => item.banner_image || item.cover_image);
            setBackgrounds(usable.sort(() => Math.random() - 0.5).slice(0, 12));
        }).catch(error => console.error('Failed to load profile backgrounds', error));
    }, []);

    useEffect(() => {
        if (backgrounds.length < 2) return;
        const timer = window.setInterval(() => setActiveBackground(current => (current + 1) % backgrounds.length), 7500);
        return () => window.clearInterval(timer);
    }, [backgrounds]);

    const handleSelectProfile = (profile: any) => {
        if (isManaging) {
            setEditingProfile(profile);
            setEditProfileName(profile.name);
            setEditAvatarUrl(profile.avatarUrl || '');
            return;
        }
        selectProfile(profile);
        navigate('/');
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProfile) return;

        try {
            if (!uid) return;
            await updateProfile(uid, editingProfile.id, {
                name: editProfileName,
                avatarUrl: editAvatarUrl,
            });
            setEditingProfile(null);
            await fetchProfiles();
        } catch (error) {
            console.error("Failed to update profile", error);
        }
    };

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!uid) return;
            await createProfile(uid, { name: newProfileName });
            setNewProfileName('');
            setIsCreating(false);
            await fetchProfiles();
        } catch (error) {
            console.error("Failed to create profile", error);
        }
    };

    const handleDeleteProfile = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este perfil?")) return;
        try {
            if (!uid) return;
            await deleteProfile(uid, id);
            await fetchProfiles();
            setEditingProfile(null);
        } catch (error) {
            console.error("Failed to delete profile", error);
        }
    };

    return (
        <div className="relative min-h-[100svh] bg-black flex flex-col items-center justify-end px-4 pb-12 pt-24 overflow-hidden font-sans text-white selection:bg-[#D4AF37] selection:text-black sm:justify-center sm:p-6">
            <CinematicBackground items={backgrounds} activeIndex={activeBackground} />

            {/* Top decorative line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#AD892D] to-transparent opacity-60" />

            {/* Logout button — always visible as escape route */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => { logout(); navigate('/login'); }}
                className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs text-white/80 backdrop-blur-md transition hover:bg-black/60 hover:text-white sm:px-4 sm:text-sm"
            >
                <LogOut className="w-4 h-4" />
                Sair
            </motion.button>

            <div className="relative z-10 flex w-full max-w-6xl flex-col items-center">
                <motion.h1
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="mb-7 text-center text-2xl font-medium tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:mb-16 sm:text-5xl md:text-6xl"
                >
                    Escolha o seu perfil
                </motion.h1>

                <motion.div
                    className="grid w-full max-w-md grid-cols-3 justify-items-center gap-x-4 gap-y-7 sm:max-w-4xl sm:flex sm:flex-wrap sm:justify-center sm:gap-12 md:gap-16"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.15 }
                        }
                    }}
                >
                    {profiles.map(profile => (
                        <motion.div
                            key={profile.id}
                            variants={{
                                hidden: { opacity: 0, scale: 0.9, y: 20 },
                                visible: { opacity: 1, scale: 1, y: 0 }
                            }}
                            whileHover={{ scale: 1.1, zIndex: 20 }}
                            className="group relative flex min-w-0 flex-col items-center gap-2.5 cursor-pointer sm:gap-5"
                            onClick={() => handleSelectProfile(profile)}
                        >
                            {/* Ornate Gold Frame Container */}
                            <div className={`relative rounded-xl border-2 border-transparent transition-all duration-300 ${isManaging ? 'opacity-80' : ''} group-hover:border-white`}>
                                {/* Inner Card Border */}
                                <div className="relative h-24 w-24 overflow-hidden rounded-[10px] bg-[#29251f] shadow-xl sm:h-36 sm:w-36 md:h-44 md:w-44">
                                    <img
                                        src={profile.avatarUrl ?? undefined}
                                        alt={profile.name}
                                        className={`w-full h-full object-cover transition-transform duration-700 ${isManaging ? 'scale-100 blur-[2px]' : 'group-hover:scale-110'}`}
                                    />

                                    {/* Lustrous Shine Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                                    {/* Edit Icon Overlay */}
                                    {isManaging && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                            <div className="p-3 bg-black/60 border border-[#D4AF37] rounded-full">
                                                <Edit2 className="w-6 h-6 text-[#D4AF37]" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <span className="max-w-24 truncate text-sm font-semibold text-white transition-colors group-hover:text-[#f2c94c] sm:max-w-44 sm:text-xl">
                                {profile.name}
                            </span>
                        </motion.div>
                    ))}

                    {/* Add Profile Button (Limit 3) */}
                    {!isCreating && profiles.length < 3 && (
                        <motion.div
                            variants={{
                                hidden: { opacity: 0, scale: 0.9, y: 20 },
                                visible: { opacity: 1, scale: 1, y: 0 }
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex flex-col items-center gap-2.5 cursor-pointer group sm:gap-5"
                            onClick={() => setIsCreating(true)}
                        >
                            {/* Similar Frame style for consistency but outlined */}
                            <div className="relative flex h-24 w-24 items-center justify-center rounded-[10px] border-2 border-dashed border-white/30 bg-black/35 backdrop-blur-sm transition group-hover:border-white sm:h-36 sm:w-36 md:h-44 md:w-44">
                                <Plus className="h-10 w-10 text-white/70 transition-opacity group-hover:text-white sm:h-14 sm:w-14" />
                            </div>
                            <span className="text-sm font-semibold text-white/80 transition-colors group-hover:text-white sm:text-xl">
                                Adicionar
                            </span>
                        </motion.div>
                    )}
                </motion.div>

                {/* Manage Profiles Button */}
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 0.8 }}
                    onClick={() => setIsManaging(!isManaging)}
                    className="mt-9 rounded-lg border border-white/30 bg-black/25 px-7 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm transition hover:border-white hover:text-white sm:mt-16 sm:px-10 sm:text-sm"
                >
                    {isManaging ? 'Concluído' : 'Gerenciar Perfis'}
                </motion.button>
            </div>

            {/* --- Modals (Create / Edit) in Gold Theme --- */}
            <AnimatePresence>
                {(isCreating || editingProfile) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                            onClick={() => { setIsCreating(false); setEditingProfile(null); }}
                        />

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-lg bg-[#0F0F0F] border border-[#D4AF37]/30 rounded-lg p-10 shadow-[0_0_60px_rgba(184,134,11,0.2)] overflow-hidden"
                        >
                            {/* Gold header line */}
                            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

                            <h2 className="text-3xl font-display text-[#D4AF37] mb-8 text-center tracking-widest uppercase">
                                {isCreating ? 'Novo Perfil' : 'Editar Perfil'}
                            </h2>

                            <form onSubmit={isCreating ? handleCreateProfile : handleUpdateProfile} className="space-y-6">
                                <div className="flex flex-col items-center gap-6">
                                    <div className="w-32 h-32 rounded-lg p-[2px] bg-gradient-to-br from-[#FFD700] to-[#B8860B]">
                                        <div className="w-full h-full rounded-[6px] overflow-hidden bg-black">
                                            <img
                                                src={isCreating ? "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg" : (editAvatarUrl || "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg")}
                                                alt="Avatar Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>

                                    <div className="w-full space-y-4">
                                        <div className="relative group">
                                            <label className="block text-[#D4AF37]/60 text-xs uppercase tracking-widest mb-2">Nome</label>
                                            <input
                                                type="text"
                                                placeholder={isCreating ? "Nome do Perfil" : "Nome"}
                                                value={isCreating ? newProfileName : editProfileName}
                                                onChange={e => isCreating ? setNewProfileName(e.target.value) : setEditProfileName(e.target.value)}
                                                className="w-full bg-[#1A1A1A] border border-[#D4AF37]/20 rounded px-4 py-3 text-[#E5D5A6] placeholder-[#D4AF37]/30 outline-none focus:border-[#D4AF37] transition-all font-serif tracking-wide text-lg"
                                                autoFocus
                                            />
                                        </div>

                                        {!isCreating && (
                                            <div className="relative group">
                                                <label className="block text-[#D4AF37]/60 text-xs uppercase tracking-widest mb-2">URL do Avatar</label>
                                                <input
                                                    type="text"
                                                    placeholder="URL da Imagem (Avatar)"
                                                    value={editAvatarUrl}
                                                    onChange={e => setEditAvatarUrl(e.target.value)}
                                                    className="w-full bg-[#1A1A1A] border border-[#D4AF37]/20 rounded px-4 py-3 text-[#E5D5A6] placeholder-[#D4AF37]/30 outline-none focus:border-[#D4AF37] transition-all font-serif tracking-wide text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-6 border-t border-[#D4AF37]/10">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold py-3 rounded hover:brightness-110 transition-all shadow-lg uppercase tracking-widest text-xs"
                                    >
                                        Salvar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsCreating(false); setEditingProfile(null); }}
                                        className="flex-1 bg-transparent border border-[#D4AF37]/30 text-[#D4AF37]/80 font-bold py-3 rounded hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all uppercase tracking-widest text-xs"
                                    >
                                        Cancelar
                                    </button>
                                </div>

                                {!isCreating && editingProfile && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleDeleteProfile(editingProfile.id);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 text-red-500/60 hover:text-red-500 font-semibold text-xs tracking-widest uppercase transition-colors"
                                    >
                                        <X className="w-4 h-4" /> Excluir Perfil
                                    </button>
                                )}
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
