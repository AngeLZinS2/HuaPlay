import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save } from 'lucide-react';

interface EpisodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    episodeData: any;
    setEpisodeData: (data: any) => void;
    seriesList: any[];
    editingEpisodeId: number | null;
    saving: boolean;
}

export default function EpisodeModal({
    isOpen,
    onClose,
    onSubmit,
    episodeData,
    setEpisodeData,
    seriesList,
    editingEpisodeId,
    saving
}: EpisodeModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface border border-gray-700 rounded-xl w-full max-w-5xl p-8 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black"
                >
                    <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                            <Plus className="w-6 h-6 text-primary" />
                            {editingEpisodeId ? 'Editar' : 'Adicionar'} Episódio
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-6">
                        {/* EPISODE FORM FIELDS */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Selecione o Projeto</label>
                            <select
                                value={episodeData.series_id}
                                onChange={(e) => setEpisodeData({ ...episodeData, series_id: e.target.value })}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                            >
                                {seriesList.map(s => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Número do Episódio</label>
                                <input
                                    type="number"
                                    value={episodeData.episode_number}
                                    onChange={(e) => setEpisodeData({ ...episodeData, episode_number: parseInt(e.target.value) })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Título do Episódio</label>
                                <input
                                    type="text"
                                    value={episodeData.title}
                                    onChange={(e) => setEpisodeData({ ...episodeData, title: e.target.value })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                    placeholder="Ex: O Início"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Google Drive (Link)</label>
                            <input
                                type="text"
                                value={episodeData.drive_link}
                                onChange={(e) => setEpisodeData({ ...episodeData, drive_link: e.target.value })}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                placeholder="https://drive.google.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mega (Link)</label>
                            <input
                                type="text"
                                value={episodeData.mega_link}
                                onChange={(e) => setEpisodeData({ ...episodeData, mega_link: e.target.value })}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                placeholder="https://mega.nz/..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mediafire (Link)</label>
                            <input
                                type="text"
                                value={episodeData.mediafire_link}
                                onChange={(e) => setEpisodeData({ ...episodeData, mediafire_link: e.target.value })}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                placeholder="https://mediafire.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Pixeldrain (Link)</label>
                            <input
                                type="text"
                                value={episodeData.pixeldrain_link}
                                onChange={(e) => setEpisodeData({ ...episodeData, pixeldrain_link: e.target.value })}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                placeholder="https://pixeldrain.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">YouTube (Link)</label>
                            <input
                                type="text"
                                value={episodeData.youtube_link}
                                onChange={(e) => setEpisodeData({ ...episodeData, youtube_link: e.target.value })}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                placeholder="https://youtube.com/..."
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-primary hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-6 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" /> Salvar Episódio
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
