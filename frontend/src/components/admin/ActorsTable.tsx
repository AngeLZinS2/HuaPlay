import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react';

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
    currentPage,
    itemsPerPage,
    handleEditActor,
    handleDeleteActor
}: ActorsTableProps) {
    return (
        <div className="bg-surface rounded-xl overflow-hidden border border-gray-800 shadow-xl">
            <table className="w-full text-left">
                <thead className="bg-white/5 text-gray-400 uppercase text-xs font-semibold tracking-wider">
                    <tr>
                        <th className="p-4">ID</th>
                        <th className="p-4">Imagem</th>
                        <th className="p-4">Nome</th>
                        <th className="p-4">Gênero</th>
                        <th className="p-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                    <div className="flex justify-center">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                </td>
                            </tr>
                        ) : actorList.length > 0 ? (
                            actorList
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((actor) => (
                                    <motion.tr
                                        key={actor.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="p-4 text-gray-500">#{actor.id}</td>
                                        <td className="p-4">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
                                                {actor.image_url ? (
                                                    <img src={actor.image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                                        N/A
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 font-medium text-white">{actor.name}</td>
                                        <td className="p-4 text-gray-400">
                                            <span className={`px-2 py-1 rounded text-xs ${actor.gender === 'Female' ? 'bg-pink-500/10 text-pink-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                {actor.gender === 'Female' ? 'Atriz' : 'Ator'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditActor(actor)}
                                                    className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteActor(actor.id)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                    Nenhum ator encontrado.
                                </td>
                            </tr>
                        )}
                    </AnimatePresence>
                </tbody>
                {/* Pagination for actors can be added here if needed, currently reusing state? */}
            </table>
        </div>
    );
}
