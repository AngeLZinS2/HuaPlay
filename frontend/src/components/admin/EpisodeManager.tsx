import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Edit, Trash2, List, PlayCircle, Download } from 'lucide-react';

interface EpisodeManagerProps {
    isOpen: boolean;
    onClose: () => void;
    managingSeries: any;
    episodeList: any[];
    onAddEpisode: () => void;
    onEditEpisode: (episode: any) => void;
    onDeleteEpisode: (id: number) => void;
}

function LinkBadge({ label, color }: { label: string; color: string }) {
    return (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color} font-medium`}>
            {label}
        </span>
    );
}

export default function EpisodeManager({
    isOpen,
    onClose,
    managingSeries,
    episodeList,
    onAddEpisode,
    onEditEpisode,
    onDeleteEpisode,
}: EpisodeManagerProps) {
    return (
        <AnimatePresence>
            {isOpen && managingSeries && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                        className="fixed right-0 top-0 bottom-0 z-[120] w-full max-w-xl border-l border-white/10 flex flex-col shadow-2xl shadow-black"
                        style={{ background: '#0a0a0a' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-11 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0">
                                    <img src={managingSeries.cover_image} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold text-white truncate">{managingSeries.title}</h2>
                                    <p className="text-xs text-gray-500">{episodeList.length} episódio{episodeList.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={onAddEpisode}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Novo Ep.
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Episode List */}
                        <div className="flex-1 overflow-y-auto py-2">
                            {episodeList.length > 0 ? (
                                <div className="space-y-1 px-3">
                                    {episodeList.map((ep, idx) => (
                                        <motion.div
                                            key={ep.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.04 }}
                                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                                        >
                                            {/* Ep Number */}
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0 mt-0.5">
                                                {ep.episode_number}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{ep.title}</p>
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {ep.embed_url_1 && <LinkBadge label="Embed 1" color="bg-blue-500/10 text-blue-400 border-blue-500/20" />}
                                                    {ep.embed_url_2 && <LinkBadge label="Embed 2" color="bg-indigo-500/10 text-indigo-400 border-indigo-500/20" />}
                                                    {ep.youtube_link && <LinkBadge label="YouTube" color="bg-red-500/10 text-red-400 border-red-500/20" />}
                                                    {ep.drive_link && <LinkBadge label="Drive" color="bg-green-500/10 text-green-400 border-green-500/20" />}
                                                    {ep.mega_link && <LinkBadge label="Mega" color="bg-orange-500/10 text-orange-400 border-orange-500/20" />}
                                                    {ep.mediafire_link && <LinkBadge label="MF" color="bg-sky-500/10 text-sky-400 border-sky-500/20" />}
                                                    {ep.pixeldrain_link && <LinkBadge label="PD" color="bg-purple-500/10 text-purple-400 border-purple-500/20" />}
                                                    {ep.download_link && <LinkBadge label="Down" color="bg-gray-500/10 text-gray-400 border-gray-500/20" />}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                                                <button
                                                    onClick={() => onEditEpisode(ep)}
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteEpisode(ep.id)}
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-gray-600">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                        <List className="w-6 h-6 opacity-50" />
                                    </div>
                                    <p className="text-sm mb-1">Nenhum episódio ainda</p>
                                    <p className="text-xs text-gray-700">Clique em "Novo Ep." para adicionar</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Stats */}
                        <div className="px-5 py-3 border-t border-white/5 flex items-center gap-4 flex-shrink-0">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>{episodeList.filter(e => e.embed_url_1 || e.embed_url_2).length} com embed</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Download className="w-3.5 h-3.5" />
                                <span>{episodeList.filter(e => e.drive_link || e.mega_link || e.download_link).length} com download</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
