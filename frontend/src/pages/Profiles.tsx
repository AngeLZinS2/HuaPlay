import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createProfile, deleteProfile, updateProfile } from '../services/userData';

// --- Particle Component with Gold Theme ---
const ParticlesBackground = () => {
    const particles = useMemo(() => {
        return Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            duration: Math.random() * 10 + 10,
            delay: Math.random() * 5,
            opacity: Math.random() * 0.5 + 0.3
        }));
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Rich Dark Golden Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#2c2005_0%,#1a1202_40%,#000000_100%)]" />

            {/* Subtle Cloud-like Texture Overlay (CSS Pattern) */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />

            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full shadow-[0_0_8px_#FFD700]"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        backgroundColor: '#FFD700', // Gold color
                    }}
                    animate={{
                        y: [0, -60, 0],
                        opacity: [p.opacity, p.opacity * 1.5, p.opacity],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        ease: "linear",
                        delay: p.delay,
                    }}
                />
            ))}

            {/* Vignette for cinematic focus */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
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
        <div className="relative min-h-screen bg-black flex flex-col items-center justify-center p-4 overflow-hidden font-serif text-[#E5D5A6] selection:bg-[#D4AF37] selection:text-black">
            <ParticlesBackground />

            {/* Top decorative line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#AD892D] to-transparent opacity-60" />

            {/* Logout button — always visible as escape route */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => { logout(); navigate('/login'); }}
                className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#B8860B] border border-[#B8860B]/30 hover:border-[#FFD700]/60 hover:text-[#FFD700] hover:bg-[#FFD700]/5 transition-all duration-300"
            >
                <LogOut className="w-4 h-4" />
                Sair
            </motion.button>

            <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
                <motion.h1
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="text-5xl md:text-7xl font-medium tracking-wide mb-24 text-transparent bg-clip-text bg-gradient-to-b from-[#FFF8DC] to-[#B8860B] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] text-center font-display"
                >
                    Quem está assistindo?
                </motion.h1>

                <motion.div
                    className="flex flex-wrap justify-center gap-12 md:gap-20"
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
                            className="group relative flex flex-col items-center gap-6 cursor-pointer"
                            onClick={() => handleSelectProfile(profile)}
                        >
                            {/* Ornate Gold Frame Container */}
                            <div className={`relative p-[3px] rounded-xl transition-all duration-500 ${isManaging ? 'opacity-80' : ''} bg-gradient-to-b from-[#FFD700] via-[#F6E27A] to-[#B8860B] shadow-[0_0_25px_rgba(218,165,32,0.3)] group-hover:shadow-[0_0_50px_rgba(255,215,0,0.6)]`}>
                                {/* Inner Card Border */}
                                <div className="relative w-36 h-36 md:w-52 md:h-52 bg-black rounded-[9px] overflow-hidden border border-[#D4AF37]/30">
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

                            <span className="text-xl md:text-2xl font-medium tracking-widest text-[#D4AF37] group-hover:text-[#FFF8DC] transition-colors duration-300 drop-shadow-md">
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
                            className="flex flex-col items-center gap-6 cursor-pointer group"
                            onClick={() => setIsCreating(true)}
                        >
                            {/* Similar Frame style for consistency but outlined */}
                            <div className="relative w-36 h-36 md:w-52 md:h-52 rounded-xl border-2 border-dashed border-[#D4AF37]/50 flex items-center justify-center bg-black/40 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37] transition-all duration-300 shadow-[0_0_15px_rgba(218,165,32,0.1)] group-hover:shadow-[0_0_30px_rgba(218,165,32,0.4)]">
                                <Plus className="w-16 h-16 text-[#D4AF37] opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>
                            <span className="text-xl md:text-2xl font-light text-[#D4AF37]/70 group-hover:text-[#D4AF37] transition-colors tracking-widest">
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
                    className="mt-24 px-12 py-3 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-500 uppercase tracking-[0.2em] text-sm font-semibold rounded-sm hover:shadow-[0_0_20px_#D4AF37]"
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
