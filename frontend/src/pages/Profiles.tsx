import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api, { updateProfile } from '../services/api';

export default function Profiles() {
    const { profiles, selectProfile, fetchProfiles } = useAuth();
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
            setEditAvatarUrl(profile.avatar_url || '');
            return;
        }
        selectProfile(profile);
        navigate('/');
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProfile) return;

        try {
            await updateProfile(editingProfile.id, {
                name: editProfileName,
                avatar_url: editAvatarUrl
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
            await api.post('/users/profiles', {
                name: newProfileName,
                avatar_url: `https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg` // Default avatar for now
            });
            setNewProfileName('');
            setIsCreating(false);
            await fetchProfiles();
        } catch (error) {
            console.error("Failed to create profile", error);
        }
    };

    const handleDeleteProfile = async (id: number) => {
        if (!window.confirm("Tem certeza que deseja excluir este perfil?")) return;
        try {
            await api.delete(`/users/profiles/${id}`);
            await fetchProfiles();
        } catch (error) {
            alert("Não é possível excluir o último perfil.");
        }
    };

    return (
        <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-4">
            <h1 className="text-3xl md:text-5xl font-medium text-white mb-8 md:mb-12">Quem está assistindo?</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-12">
                {profiles.map(profile => (
                    <motion.div
                        key={profile.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="group relative flex flex-col items-center gap-4 cursor-pointer"
                        onClick={() => handleSelectProfile(profile)}
                    >
                        <div className={`w-24 h-24 md:w-32 md:h-32 rounded-md overflow-hidden border-2 ${isManaging ? 'border-gray-500 opacity-50' : 'border-transparent group-hover:border-white'}`}>
                            <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                            {isManaging && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                    <div className="p-2 border-2 border-white rounded-full">
                                        {/* Use Edit/Pencil icon instead of Trash to indicate editing */}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                    </div>
                                </div>
                            )}
                        </div>
                        <span className="text-gray-400 text-lg md:text-xl group-hover:text-white transition-colors">{profile.name}</span>
                    </motion.div>
                ))}

                {!isCreating && profiles.length < 3 && (
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex flex-col items-center gap-4 cursor-pointer"
                        onClick={() => setIsCreating(true)}
                    >
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-md flex items-center justify-center bg-[#141414] border-2 border-gray-500 hover:border-white hover:bg-white/10 transition-colors text-gray-500 hover:text-white">
                            <Plus className="w-12 h-12 md:w-16 md:h-16" />
                        </div>
                        <span className="text-gray-400 text-lg md:text-xl hover:text-white transition-colors">Adicionar Perfil</span>
                    </motion.div>
                )}
            </div>

            {isCreating && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#141414] p-8 rounded-lg max-w-md w-full border border-white/10">
                        <h2 className="text-2xl text-white mb-6">Novo Perfil</h2>
                        <form onSubmit={handleCreateProfile} className="space-y-6">
                            <input
                                type="text"
                                placeholder="Nome do perfil"
                                value={newProfileName}
                                onChange={e => setNewProfileName(e.target.value)}
                                className="w-full bg-[#333] text-white px-4 py-3 rounded outline-none focus:bg-[#444]"
                                autoFocus
                            />
                            <div className="flex gap-4">
                                <button type="submit" className="flex-1 bg-white text-black font-bold py-2 rounded hover:bg-gray-200">Salvar</button>
                                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 border border-gray-500 text-gray-500 font-bold py-2 rounded hover:border-white hover:text-white">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {editingProfile && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#141414] p-8 rounded-lg max-w-md w-full border border-white/10">
                        <h2 className="text-2xl text-white mb-6">Editar Perfil</h2>
                        <div className="flex flex-col items-center mb-6">
                            <img
                                src={editAvatarUrl || "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg"}
                                alt="Preview"
                                className="w-24 h-24 rounded-md object-cover mb-4 border-2 border-white/20"
                            />
                        </div>
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Nome</label>
                                <input
                                    type="text"
                                    placeholder="Nome do perfil"
                                    value={editProfileName}
                                    onChange={e => setEditProfileName(e.target.value)}
                                    className="w-full bg-[#333] text-white px-4 py-3 rounded outline-none focus:bg-[#444]"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">URL da Imagem</label>
                                <input
                                    type="text"
                                    placeholder="https://exemplo.com/imagem.jpg"
                                    value={editAvatarUrl}
                                    onChange={e => setEditAvatarUrl(e.target.value)}
                                    className="w-full bg-[#333] text-white px-4 py-3 rounded outline-none focus:bg-[#444]"
                                />
                            </div>

                            <div className="flex flex-col gap-4 mt-8">
                                <div className="flex gap-4">
                                    <button type="submit" className="flex-1 bg-white text-black font-bold py-2 rounded hover:bg-gray-200">Salvar</button>
                                    <button type="button" onClick={() => setEditingProfile(null)} className="flex-1 border border-gray-500 text-gray-500 font-bold py-2 rounded hover:border-white hover:text-white">Cancelar</button>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await handleDeleteProfile(editingProfile.id);
                                        setEditingProfile(null);
                                    }}
                                    className="w-full border border-red-900/50 text-red-500 font-bold py-2 rounded hover:bg-red-900/20 hover:border-red-500 transition-colors"
                                >
                                    Excluir Perfil
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsManaging(!isManaging)}
                className="px-6 py-2 border border-gray-500 text-gray-500 hover:border-white hover:text-white transition-colors uppercase tracking-widest text-sm"
            >
                {isManaging ? 'Concluído' : 'Gerenciar Perfis'}
            </button>
        </div>
    );
}
