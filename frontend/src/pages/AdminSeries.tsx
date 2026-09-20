import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api, {
    createEpisode,
    deleteEpisode,
    deleteSeries,
    getEpisodes,
    getSeriesPage,
    updateEpisode,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import { Plus, Search, Filter, X, Sparkles } from 'lucide-react';

import SeriesTable from '../components/admin/SeriesTable';
import SeriesModal from '../components/admin/SeriesModal';
import EpisodeModal from '../components/admin/EpisodeModal';
import EpisodeManager from '../components/admin/EpisodeManager';
import DeleteConfirmModal from '../components/admin/DeleteConfirmModal';
import FeaturedConfigModal from '../components/admin/FeaturedConfigModal';

const ITEMS_PER_PAGE = 10;

const DEFAULT_SERIES_FORM = {
    title: '',
    slug: '',
    cover_image: '',
    banner_image: '',
    description: '',
    type: 'Series',
    status: 'Em andamento',
    release_year: new Date().getFullYear(),
    country: '',
    genre: '',
    cast: '',
    trailer_url: '',
    is_featured: false,
    feature_type: 'TRAILER',
    drive_link: '',
    mega_link: '',
    mediafire_link: '',
    pixeldrain_link: '',
};

const DEFAULT_EPISODE_FORM = {
    series_id: '',
    title: '',
    episode_number: 1,
    season_number: 1,
    embed_url_1: '',
    embed_url_2: '',
    youtube_link: '',
    external_link: '',
    download_link: '',
    drive_link: '',
    mega_link: '',
    mediafire_link: '',
    pixeldrain_link: '',
};

export default function AdminSeries() {
    const { addToast } = useToast();

    // Data
    const [seriesList, setSeriesList] = useState<any[]>([]);
    const [episodeList, setEpisodeList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
    const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
    const [isEpisodeManagerOpen, setIsEpisodeManagerOpen] = useState(false);
    const [isFeaturedConfigOpen, setIsFeaturedConfigOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'series' | 'episode'; id: number; name: string } | null>(null);
    const [saving, setSaving] = useState(false);

    // Editing
    const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null);
    const [editingEpisodeId, setEditingEpisodeId] = useState<number | null>(null);
    const [managingSeries, setManagingSeries] = useState<any>(null);

    // Forms
    const [formData, setFormData] = useState(DEFAULT_SERIES_FORM);
    const [episodeData, setEpisodeData] = useState(DEFAULT_EPISODE_FORM);

    // Search & Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterYear, setFilterYear] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Reset page on filter change
    useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filterType, filterStatus, filterYear]);

    const fetchSeries = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {
                skip: (currentPage - 1) * ITEMS_PER_PAGE,
                limit: ITEMS_PER_PAGE,
                search: debouncedSearch || undefined,
                type: filterType !== 'All' ? filterType : undefined,
                status: filterStatus !== 'All' ? filterStatus : undefined,
                release_year: filterYear !== 'All' ? parseInt(filterYear) : undefined,
            };
            const { items, total } = await getSeriesPage(params);
            setSeriesList(items);
            setTotalItems(total);
            setTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));
        } catch {
            addToast('Erro ao carregar séries.', 'error');
        } finally {
            setLoading(false);
        }
    }, [currentPage, debouncedSearch, filterType, filterStatus, filterYear, addToast]);

    useEffect(() => { fetchSeries(); }, [fetchSeries]);

    // --- Series CRUD ---
    const handleOpenNewSeries = () => {
        setEditingSeriesId(null);
        setFormData(DEFAULT_SERIES_FORM);
        setIsSeriesModalOpen(true);
    };

    const handleEditSeries = (item: any) => {
        setEditingSeriesId(item.id);
        setFormData({
            title: item.title || '',
            slug: item.slug || '',
            cover_image: item.cover_image || '',
            banner_image: item.banner_image || '',
            description: item.description || '',
            type: item.type || 'Series',
            status: item.status || 'Em andamento',
            release_year: item.release_year || new Date().getFullYear(),
            country: item.country || '',
            genre: item.genre || '',
            cast: item.cast || '',
            trailer_url: item.trailer_url || '',
            is_featured: item.is_featured || false,
            feature_type: item.feature_type || 'TRAILER',
            drive_link: item.drive_link || '',
            mega_link: item.mega_link || '',
            mediafire_link: item.mediafire_link || '',
            pixeldrain_link: item.pixeldrain_link || '',
        });
        setIsSeriesModalOpen(true);
    };

    // A bare `catch {}` hid why a save failed — a 403 from an expired admin
    // session and a 422 from a rejected field both surfaced as the same
    // "Erro ao salvar". Surface the status and the backend's own detail.
    const describeError = (error: any) => {
        const status = error?.response?.status;
        const detail = error?.response?.data?.detail;
        if (!status) return error?.message || 'sem resposta do servidor';
        const text = Array.isArray(detail)
            ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join('; ')
            : detail;
        return `${status}${text ? ` — ${text}` : ''}`;
    };

    const handleSaveSeries = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingSeriesId) {
                await api.put(`/series/${editingSeriesId}`, formData);
                addToast('Série atualizada com sucesso!', 'success');
            } else {
                await api.post('/series/', formData);
                addToast('Série criada com sucesso!', 'success');
            }
            setIsSeriesModalOpen(false);
            fetchSeries();
        } catch (error) {
            console.error('Failed to save series', error);
            addToast(`Erro ao salvar série: ${describeError(error)}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSeries = async () => {
        if (!deleteTarget) return;
        try {
            await deleteSeries(deleteTarget.id);
            addToast('Série excluída!', 'success');
            fetchSeries();
        } catch {
            addToast('Erro ao excluir série.', 'error');
        }
    };

    const handleToggleFeature = async (id: number) => {
        try {
            await api.post(`/series/${id}/feature`);
            addToast('Destaque atualizado!', 'success');
            fetchSeries();
        } catch {
            addToast('Erro ao atualizar destaque.', 'error');
        }
    };

    // --- Episode Management ---
    const handleManageEpisodes = async (series: any) => {
        setManagingSeries(series);
        try {
            setEpisodeList(await getEpisodes(series.id));
            setIsEpisodeManagerOpen(true);
        } catch {
            addToast('Erro ao carregar episódios.', 'error');
        }
    };

    const refreshEpisodes = async () => {
        if (!managingSeries) return;
        setEpisodeList(await getEpisodes(managingSeries.id));
    };

    const handleAddEpisode = () => {
        setEditingEpisodeId(null);
        setEpisodeData({
            ...DEFAULT_EPISODE_FORM,
            series_id: managingSeries?.id?.toString() || '',
            episode_number: episodeList.length + 1,
            season_number: 1,
        });
        setIsEpisodeManagerOpen(false);
        setIsEpisodeModalOpen(true);
    };

    const handleEditEpisode = (ep: any) => {
        setEditingEpisodeId(ep.id);
        setEpisodeData({
            series_id: ep.series_id?.toString() || '',
            title: ep.title || '',
            episode_number: ep.episode_number || 1,
            season_number: ep.season_number ?? 1,
            embed_url_1: ep.embed_url_1 || '',
            embed_url_2: ep.embed_url_2 || '',
            youtube_link: ep.youtube_link || '',
            external_link: ep.external_link || '',
            download_link: ep.download_link || '',
            drive_link: ep.drive_link || '',
            mega_link: ep.mega_link || '',
            mediafire_link: ep.mediafire_link || '',
            pixeldrain_link: ep.pixeldrain_link || '',
        });
        setIsEpisodeManagerOpen(false);
        setIsEpisodeModalOpen(true);
    };

    const handleSaveEpisode = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...episodeData,
                series_id: parseInt(episodeData.series_id),
                episode_number: parseInt(episodeData.episode_number.toString()),
                season_number: parseInt((episodeData.season_number ?? 1).toString()),
            };
            if (editingEpisodeId) {
                await updateEpisode(editingEpisodeId, payload);
                addToast('Episódio atualizado!', 'success');
            } else {
                await createEpisode(payload.series_id, payload);
                addToast('Episódio adicionado!', 'success');
            }
            setIsEpisodeModalOpen(false);
            await refreshEpisodes();
            setIsEpisodeManagerOpen(true);
        } catch (error) {
            console.error('Failed to save episode', error);
            addToast(`Erro ao salvar episódio: ${describeError(error)}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEpisode = async (id: number) => {
        const ep = episodeList.find((e) => e.id === id);
        setDeleteTarget({ type: 'episode', id, name: ep?.title || `Episódio #${id}` });
    };

    const confirmDeleteEpisode = async () => {
        if (!deleteTarget) return;
        try {
            await deleteEpisode(deleteTarget.id);
            addToast('Episódio excluído!', 'success');
            await refreshEpisodes();
        } catch {
            addToast('Erro ao excluir episódio.', 'error');
        }
    };

    // Admins paste either a bare URL or the whole <iframe> snippet the host
    // offers. Entity-decode the extracted src: a copied snippet carries &amp;
    // between query params, which would otherwise be stored verbatim.
    const extractSrc = (input: string) => {
        const match = input.match(/src=["']([^"']+)["']/);
        return (match ? match[1] : input).replace(/&amp;/g, '&').trim();
    };

    const activeFilters = (filterType !== 'All' ? 1 : 0) + (filterStatus !== 'All' ? 1 : 0) + (filterYear !== 'All' ? 1 : 0);

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Cinzel, serif' }}>
                        Séries & Filmes
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {totalItems > 0 ? `${totalItems} projeto${totalItems !== 1 ? 's' : ''} cadastrado${totalItems !== 1 ? 's' : ''}` : 'Gerencie o catálogo de conteúdo'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsFeaturedConfigOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-yellow-500/30 text-yellow-400 text-sm font-semibold transition-all shadow-lg hover:border-yellow-500/60"
                    >
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        Configurar Destaque
                    </button>
                    <button
                        onClick={handleOpenNewSeries}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition-all shadow-lg shadow-yellow-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Série
                    </button>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar série ou filme..."
                        className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:border-yellow-500/50 outline-none placeholder-gray-600 transition-all"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                        showFilters || activeFilters > 0
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            : 'border-white/10 text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Filter className="w-4 h-4" />
                    Filtros
                    {activeFilters > 0 && (
                        <span className="w-4 h-4 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
                            {activeFilters}
                        </span>
                    )}
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-3 mb-5 p-4 rounded-2xl border border-white/5"
                    style={{ background: '#0d0d0d' }}
                >
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-semibold uppercase">Tipo</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-yellow-500/50 outline-none"
                        >
                            <option value="All">Todos</option>
                            <option value="Series">Séries</option>
                            <option value="Movie">Filmes</option>
                            <option value="Anime">Animes</option>
                            <option value="Donghua">Donghuas</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-semibold uppercase">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-yellow-500/50 outline-none"
                        >
                            <option value="All">Todos</option>
                            <option value="Em andamento">Em andamento</option>
                            <option value="Completo">Completo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-semibold uppercase">Ano de Lançamento</label>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-yellow-500/50 outline-none"
                        >
                            <option value="All">Todos os Anos</option>
                            {Array.from({ length: 25 }, (_, i) => 2026 - i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    {activeFilters > 0 && (
                        <div className="flex items-end">
                            <button
                                onClick={() => { setFilterType('All'); setFilterStatus('All'); setFilterYear('All'); }}
                                className="text-xs text-yellow-400/80 hover:text-yellow-400 underline pb-2"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Table */}
            <SeriesTable
                seriesList={seriesList}
                loading={loading}
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                handleEdit={handleEditSeries}
                handleDelete={(id) => {
                    const s = seriesList.find((s) => s.id === id);
                    setDeleteTarget({ type: 'series', id, name: s?.title || `Série #${id}` });
                }}
                handleToggleFeature={handleToggleFeature}
                handleManageEpisodes={handleManageEpisodes}
                setEpisodeData={setEpisodeData}
                setActiveTab={() => {}}
                setIsModalOpen={() => {}}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={totalItems}
            />

            {/* Modals */}
            <SeriesModal
                isOpen={isSeriesModalOpen}
                onClose={() => setIsSeriesModalOpen(false)}
                onSubmit={handleSaveSeries}
                formData={formData}
                setFormData={setFormData}
                editingId={editingSeriesId}
                saving={saving}
                extractSrc={extractSrc}
            />

            <EpisodeModal
                isOpen={isEpisodeModalOpen}
                onClose={() => {
                    setIsEpisodeModalOpen(false);
                    setIsEpisodeManagerOpen(true);
                }}
                onSubmit={handleSaveEpisode}
                episodeData={episodeData}
                setEpisodeData={setEpisodeData}
                seriesList={seriesList}
                editingEpisodeId={editingEpisodeId}
                saving={saving}
            />

            <EpisodeManager
                isOpen={isEpisodeManagerOpen}
                onClose={() => setIsEpisodeManagerOpen(false)}
                managingSeries={managingSeries}
                episodeList={episodeList}
                onAddEpisode={handleAddEpisode}
                onEditEpisode={handleEditEpisode}
                onDeleteEpisode={handleDeleteEpisode}
            />

            <DeleteConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={deleteTarget?.type === 'series' ? handleDeleteSeries : confirmDeleteEpisode}
                itemName={deleteTarget?.name}
                message={
                    deleteTarget?.type === 'series'
                        ? 'Isso excluirá permanentemente a série e todos os seus episódios.'
                        : 'Esta ação removerá permanentemente o episódio.'
                }
            />

            <FeaturedConfigModal
                isOpen={isFeaturedConfigOpen}
                onClose={() => setIsFeaturedConfigOpen(false)}
            />
        </div>
    );
}
