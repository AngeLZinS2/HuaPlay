import { motion, AnimatePresence } from 'framer-motion';
import { List, Plus, X, Edit, Trash2 } from 'lucide-react';

interface EpisodeManagerProps {
    isOpen: boolean;
    onClose: () => void;
    managingSeries: any;
    episodeList: any[];
    onAddEpisode: () => void;
    onEditEpisode: (episode: any) => void;
    onDeleteEpisode: (id: number) => void;
}

export default function EpisodeManager({
    isOpen,
    onClose,
    managingSeries,
    episodeList,
    onAddEpisode,
    onEditEpisode,
    onDeleteEpisode
}: EpisodeManagerProps) {
    if (!isOpen || !managingSeries) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface border border-gray-700 rounded-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black"
                >
                    <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <List className="w-5 h-5 text-purple-500" />
                                Episódios: <span className="text-gray-400">{managingSeries.title}</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onAddEpisode}
                                className="px-3 py-1.5 bg-green-600 rounded-lg text-white text-sm hover:bg-green-500 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Novo
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="p-3">#</th>
                                    <th className="p-3">Título</th>
                                    <th className="p-3">Links</th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {episodeList.length > 0 ? episodeList.map((ep) => (
                                    <tr key={ep.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3 text-gray-500">#{ep.episode_number}</td>
                                        <td className="p-3 font-medium text-white">{ep.title}</td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                {ep.embed_url_1 && <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">Embed 1</span>}
                                                {ep.embed_url_2 && <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded">Embed 2</span>}
                                                {ep.download_link && <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">Down</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => onEditEpisode(ep)}
                                                    className="p-1.5 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteEpisode(ep.id)}
                                                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">
                                            Nenhum episódio encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
