import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, Search, User, LayoutGrid, List } from 'lucide-react';

interface ActorsTableProps {
    actorList: any[];
    loading: boolean;
    currentPage: number;
    itemsPerPage: number;
    handleEditActor: (actor: any) => void;
    handleDeleteActor: (id: number) => void;
}

export default function ActorsTable({
    actorList,
    loading,
    handleEditActor,
    handleDeleteActor,
}: ActorsTableProps) {
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filtered = useMemo(() => {
        if (!search.trim()) return actorList;
        const q = search.toLowerCase();
        return actorList.filter((a) =>
            a.name?.toLowerCase().includes(q) ||
            a.real_name?.toLowerCase().includes(q)
        );
    }, [actorList, search]);

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white/5 animate-pulse aspect-[3/4]" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar ator..."
                        className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:border-yellow-500/50 outline-none placeholder-gray-600 transition-all"
                    />
                </div>
                <div className="flex border border-white/10 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-yellow-500/10 text-yellow-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-yellow-500/10 text-yellow-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
                <span className="text-xs text-gray-500">{filtered.length} ator{filtered.length !== 1 ? 'es' : ''}</span>
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <User className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm">Nenhum ator encontrado.</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    <AnimatePresence>
                        {filtered.map((actor, idx) => (
                            <motion.div
                                key={actor.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.03 }}
                                className="group relative rounded-2xl overflow-hidden border border-white/5 cursor-pointer aspect-[3/4]"
                                style={{ background: '#111' }}
                            >
                                {/* Photo */}
                                {actor.image_url ? (
                                    <img src={actor.image_url} alt={actor.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                                        <User className="w-10 h-10 text-gray-600" />
                                    </div>
                                )}

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />

                                {/* Info */}
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <p className="text-white text-xs font-semibold truncate leading-tight">{actor.name}</p>
                                    <span className={`text-[10px] mt-0.5 ${actor.gender === 'Female' ? 'text-pink-400' : 'text-blue-400'}`}>
                                        {actor.gender === 'Female' ? 'Atriz' : 'Ator'}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEditActor(actor)}
                                        className="p-1.5 rounded-lg bg-blue-600/80 text-white hover:bg-blue-500 transition-colors"
                                    >
                                        <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteActor(actor.id)}
                                        className="p-1.5 rounded-lg bg-red-600/80 text-white hover:bg-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Gender badge */}
                                <div className="absolute top-2 left-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                                        actor.gender === 'Female'
                                            ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                    }`}>
                                        {actor.gender === 'Female' ? '♀' : '♂'}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                /* List View */
                <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#0d0d0d' }}>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Foto</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gênero</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map((actor) => (
                                <tr key={actor.id} className="hover:bg-white/3 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-900 flex-shrink-0">
                                            {actor.image_url ? (
                                                <img src={actor.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <User className="w-4 h-4 text-gray-600" />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium text-white">{actor.name}</p>
                                        {actor.real_name && <p className="text-xs text-gray-500">{actor.real_name}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                            actor.gender === 'Female'
                                                ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        }`}>
                                            {actor.gender === 'Female' ? 'Atriz' : 'Ator'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditActor(actor)}
                                                className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteActor(actor.id)}
                                                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
