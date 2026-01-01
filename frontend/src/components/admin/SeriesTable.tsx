import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, List, Star } from 'lucide-react';

interface SeriesTableProps {
    seriesList: any[];
    loading: boolean;
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number) => void;
    handleEdit: (item: any) => void;
    handleDelete: (id: number) => void;
    handleToggleFeature: (id: number) => void;
    handleManageEpisodes: (item: any) => void;
    setEpisodeData: (data: any) => void;
    setActiveTab: (tab: any) => void;
    setIsModalOpen: (isOpen: boolean) => void;
    itemsPerPage: number;
    totalItems: number;
}

export default function SeriesTable({
    seriesList,
    loading,
    currentPage,
    totalPages,
    setCurrentPage,
    handleEdit,
    handleDelete,
    handleToggleFeature,
    handleManageEpisodes,
    setEpisodeData,
    setActiveTab,
    setIsModalOpen,
    itemsPerPage,
    totalItems
}: SeriesTableProps) {
    // Local state for the input field to prevent jumping
    const [pageInput, setPageInput] = useState(currentPage.toString());

    // Sync local state when currentPage prop changes
    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    const handlePageSubmit = () => {
        const page = parseInt(pageInput);
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
        } else {
            // Reset to current page if invalid or unchanged
            setPageInput(currentPage.toString());
        }
    };

    return (
        <div className="bg-surface rounded-xl overflow-hidden border border-gray-800 shadow-xl">
            <table className="w-full text-left">
                <thead className="bg-white/5 text-gray-400 uppercase text-xs font-semibold tracking-wider">
                    <tr>
                        <th className="p-4">ID</th>
                        <th className="p-4">Capa</th>
                        <th className="p-4">Título</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Gênero</th>
                        <th className="p-4">Ano</th>
                        <th className="p-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    <div className="flex justify-center">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                </td>
                            </tr>
                        ) : seriesList.length > 0 ? (
                            seriesList.map((item) => (
                                <motion.tr
                                    key={item.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="hover:bg-white/5 transition-colors group"
                                >
                                    <td className="p-4 text-gray-500">#{item.id}</td>
                                    <td className="p-4">
                                        <div className="w-10 h-14 rounded overflow-hidden bg-gray-800">
                                            <img src={item.cover_image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium text-white">{item.title}</td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 rounded text-xs border border-gray-700 text-gray-300">
                                            {item.type || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${item.status === 'Completo' || item.status === 'Completed'
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Completo' || item.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'
                                                }`} />
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-400">{item.genre}</td>
                                    <td className="p-4 text-gray-400">{item.release_year}</td>
                                    <td className="p-4">
                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEpisodeData((prev: any) => ({ ...prev, series_id: item.id.toString() }));
                                                    setIsModalOpen(true);
                                                }}
                                                title="Adicionar Episódio"
                                                className="p-2 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleFeature(item.id)}
                                                title="Definir como Destaque"
                                                className={`p-2 rounded-lg transition-colors ${item.is_featured ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/10'}`}
                                            >
                                                <Star className={`w-4 h-4 ${item.is_featured ? 'fill-yellow-400' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(item)}
                                                title="Editar Projeto"
                                                className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                title="Excluir Projeto"
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleManageEpisodes(item)}
                                                title="Gerenciar Episódios"
                                                className="p-2 hover:bg-purple-500/20 rounded-lg text-purple-400 transition-colors"
                                            >
                                                <List className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    Nenhum projeto encontrado.
                                </td>
                            </tr>
                        )}
                    </AnimatePresence>
                </tbody>
                {totalItems > itemsPerPage && (
                    <tfoot>
                        <tr>
                            <td colSpan={8} className="p-4 border-t border-gray-800">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-400">Página</span>
                                        <input
                                            type="text"
                                            value={pageInput}
                                            onChange={(e) => setPageInput(e.target.value)}
                                            onBlur={handlePageSubmit}
                                            onKeyDown={(e) => e.key === 'Enter' && handlePageSubmit()}
                                            className="w-16 bg-gray-800 border border-gray-700 rounded text-center text-sm py-1 focus:ring-1 focus:ring-primary outline-none"
                                        />
                                        <span className="text-sm text-gray-400">de {totalPages}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}
