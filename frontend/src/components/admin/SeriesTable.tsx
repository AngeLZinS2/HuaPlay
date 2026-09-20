import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, Star, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOptimizedImageUrl } from '../../utils/image';

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

const statusColors: Record<string, string> = {
    'Completo': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Completed': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Em andamento': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const typeColors: Record<string, string> = {
    Series: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Movie: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Anime: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    Donghua: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

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
    itemsPerPage,
    totalItems,
}: SeriesTableProps) {
    const [pageInput, setPageInput] = useState(currentPage.toString());
    const [hoveredCover, setHoveredCover] = useState<{ id: number; url: string; x: number; y: number } | null>(null);

    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    const handlePageSubmit = () => {
        const page = parseInt(pageInput);
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
        } else {
            setPageInput(currentPage.toString());
        }
    };

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#0d0d0d' }}>
            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Capa</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Título</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Gênero</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Ano</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        <AnimatePresence mode="wait">
                            {loading ? (
                                [...Array(itemsPerPage)].map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3"><div className="w-8 h-11 rounded-lg bg-white/5 animate-pulse" /></td>
                                        <td className="px-4 py-3"><div className="h-4 w-40 bg-white/5 rounded animate-pulse" /></td>
                                        <td className="px-4 py-3"><div className="h-5 w-16 bg-white/5 rounded-full animate-pulse" /></td>
                                        <td className="px-4 py-3"><div className="h-5 w-24 bg-white/5 rounded-full animate-pulse" /></td>
                                        <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-28 bg-white/5 rounded animate-pulse" /></td>
                                        <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-10 bg-white/5 rounded animate-pulse" /></td>
                                        <td className="px-4 py-3"><div className="h-8 w-28 bg-white/5 rounded-xl animate-pulse ml-auto" /></td>
                                    </tr>
                                ))
                            ) : seriesList.length > 0 ? (
                                seriesList.map((item) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="hover:bg-white/3 transition-colors"
                                    >
                                        {/* Cover */}
                                        <td className="px-4 py-3">
                                            <div
                                                className="relative w-8 h-11 rounded-lg overflow-hidden bg-gray-900 cursor-pointer"
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredCover({ id: item.id, url: item.cover_image, x: rect.right + 8, y: rect.top });
                                                }}
                                                onMouseLeave={() => setHoveredCover(null)}
                                            >
                                                <img src={getOptimizedImageUrl(item.cover_image, 'thumbnail')} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        </td>

                                        {/* Title */}
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">{item.title}</p>
                                                <p className="text-xs text-gray-600">#{item.id}</p>
                                            </div>
                                        </td>

                                        {/* Type */}
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[item.type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                {item.type || 'N/A'}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit ${statusColors[item.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {item.status}
                                            </span>
                                        </td>

                                        {/* Genre */}
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <span className="text-xs text-gray-500 truncate max-w-[120px] block">{item.genre}</span>
                                        </td>

                                        {/* Year */}
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            <span className="text-xs text-gray-500">{item.release_year}</span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => handleToggleFeature(item.id)}
                                                    title={item.is_featured ? 'Remover destaque' : 'Destacar'}
                                                    className={`p-1.5 rounded-lg transition-all ${
                                                        item.is_featured
                                                            ? 'text-yellow-400 bg-yellow-400/10'
                                                            : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/10'
                                                    }`}
                                                >
                                                    <Star className={`w-3.5 h-3.5 ${item.is_featured ? 'fill-yellow-400' : ''}`} />
                                                </button>
                                                <button
                                                    onClick={() => handleManageEpisodes(item)}
                                                    title="Gerenciar Episódios"
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-purple-400 hover:bg-purple-400/10 transition-all"
                                                >
                                                    <List className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    title="Editar"
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    title="Excluir"
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-gray-600">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                                <List className="w-6 h-6 opacity-50" />
                                            </div>
                                            <p className="text-sm">Nenhum projeto encontrado.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>

            {/* Cover preview tooltip */}
            {hoveredCover && (
                <div
                    className="fixed z-[300] pointer-events-none"
                    style={{ left: hoveredCover.x, top: hoveredCover.y }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-24 h-32 rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black"
                    >
                        <img src={hoveredCover.url} alt="" className="w-full h-full object-cover" />
                    </motion.div>
                </div>
            )}

            {/* Pagination */}
            {totalItems > itemsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                    <p className="text-xs text-gray-500">
                        Mostrando <span className="text-white">{startItem}–{endItem}</span> de <span className="text-white">{totalItems}</span>
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span>Pág.</span>
                            <input
                                type="text"
                                value={pageInput}
                                onChange={(e) => setPageInput(e.target.value)}
                                onBlur={handlePageSubmit}
                                onKeyDown={(e) => e.key === 'Enter' && handlePageSubmit()}
                                className="w-10 bg-white/5 border border-white/10 rounded-lg text-center text-white text-xs py-1 focus:border-yellow-500/50 outline-none"
                            />
                            <span>de {totalPages}</span>
                        </div>
                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
