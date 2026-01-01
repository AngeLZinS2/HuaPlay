
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

// Refactored Components
import StatsGrid from '../components/admin/StatsGrid';
import DashboardToolbar from '../components/admin/DashboardToolbar';
import SeriesTable from '../components/admin/SeriesTable';
import ActorsTable from '../components/admin/ActorsTable';
import SeriesModal from '../components/admin/SeriesModal';
import ActorModal from '../components/admin/ActorModal';
import EpisodeModal from '../components/admin/EpisodeModal';
import EpisodeManager from '../components/admin/EpisodeManager';

export default function AdminDashboard() {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'series' | 'actors' | 'episodes'>('series');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [seriesList, setSeriesList] = useState<any[]>([]);
    const [actorList, setActorList] = useState<any[]>([]);
    const [episodeList, setEpisodeList] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingEpisodeId, setEditingEpisodeId] = useState<number | null>(null);

    // Filter states
    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCountry, setFilterCountry] = useState('');
    const [filterYear, setFilterYear] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 8;
    const [totalItems, setTotalItems] = useState(0);

    const [stats, setStats] = useState({ total: 0, ongoing: 0, completed: 0 });
    const [formData, setFormData] = useState({
        title: '',
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
        feature_type: 'TRAILER'
    });

    const [episodeData, setEpisodeData] = useState({
        series_id: '',
        title: '',
        episode_number: 1,
        video_url: '',
        duration: '',
        thumbnail_url: '',
        drive_link: '',
        mega_link: '',
        mediafire_link: '',
        pixeldrain_link: '',
        youtube_link: '',
        embed_url_1: '',
        embed_url_2: '',
        download_link: '',
        is_locked: false
    });

    const [actorFormData, setActorFormData] = useState({
        name: '',
        gender: 'Female',
        image_url: ''
    });

    const [isEpisodeManagerOpen, setIsEpisodeManagerOpen] = useState(false);
    const [managingSeries, setManagingSeries] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/series/stats');
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch stats");
            }
        };
        fetchStats();
    }, []);

    const fetchSeries = useCallback(async () => {
        try {
            setLoading(true);
            const params: any = {
                skip: (currentPage - 1) * itemsPerPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm || undefined,
                type: filterType !== 'All' ? filterType : undefined,
                status: filterStatus !== 'All' ? filterStatus : undefined,
                country: filterCountry || undefined,
                release_year: filterYear || undefined
            };

            const response = await api.get('/series/', { params });

            if (Array.isArray(response.data)) {
                setSeriesList(response.data);
                const total = parseInt(response.headers['x-total-count'] || '0');
                setTotalItems(total);
                setTotalPages(Math.ceil(total / itemsPerPage));
            } else {
                setSeriesList([]);
                setTotalPages(1);
            }

        } catch (error) {
            console.error('Error fetching series:', error);
            addToast("Erro ao carregar lista de séries.", "error");
        } finally {
            setLoading(false);
        }
    }, [currentPage, debouncedSearchTerm, filterType, filterStatus, filterCountry, filterYear, addToast]);

    const fetchActors = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/actors/');
            setActorList(response.data);
        } catch (error) {
            console.error('Error fetching actors:', error);
            addToast("Erro ao carregar lista de atores.", "error");
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (activeTab === 'series') {
            fetchSeries();
        } else if (activeTab === 'actors') {
            fetchActors();
        }
    }, [activeTab, fetchSeries, fetchActors]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to page 1 ONLY when DEBOUNCED search term changes or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterType, filterStatus, filterCountry, filterYear]);




    const handleOpenModal = () => {
        setEditingId(null);
        setEditingEpisodeId(null);
        setFormData({
            title: '',
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
            feature_type: 'TRAILER'
        });
        setActorFormData({
            name: '',
            gender: 'Female',
            image_url: ''
        });
        // We do typically reset episodeData but keeping series_id might be desired if coming from a context.
        // But for global add, we reset.
        setEpisodeData({
            series_id: seriesList.length > 0 ? seriesList[0].id.toString() : '',
            title: '',
            episode_number: 1,
            video_url: '',
            duration: '',
            thumbnail_url: '',
            drive_link: '',
            mega_link: '',
            mediafire_link: '',
            pixeldrain_link: '',
            youtube_link: '',
            embed_url_1: '',
            embed_url_2: '',
            download_link: '',
            is_locked: false
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        if (activeTab === 'series') {
            setFormData({
                title: item.title,
                cover_image: item.cover_image,
                banner_image: item.banner_image || '',
                description: item.description,
                type: item.type,
                status: item.status,
                release_year: item.release_year,
                country: item.country,
                genre: item.genre,
                cast: item.cast || '',
                trailer_url: item.trailer_url || '',
                is_featured: item.is_featured,
                feature_type: item.feature_type || 'TRAILER'
            });
        }
        setIsModalOpen(true);
    };

    const handleEditActor = (actor: any) => {
        setEditingId(actor.id);
        setActorFormData({
            name: actor.name,
            gender: actor.gender,
            image_url: actor.image_url
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Tem certeza que deseja excluir?')) {
            try {
                await api.delete(`/series/${id}`);
                addToast("Projeto excluído com sucesso!", "success");
                fetchSeries();
            } catch (error) {
                console.error('Error deleting:', error);
                addToast("Erro ao excluir projeto.", "error");
            }
        }
    };

    const handleDeleteActor = async (id: number) => {
        if (window.confirm('Tem certeza que deseja excluir este ator?')) {
            try {
                await api.delete(`/actors/${id}`);
                addToast("Ator excluído com sucesso!", "success");
                fetchActors();
            } catch (error) {
                console.error('Error deleting actor:', error);
                addToast("Erro ao excluir ator.", "error");
            }
        }
    };

    const handleToggleFeature = async (id: number) => {
        try {
            await api.post(`/series/${id}/feature`);
            addToast("Destaque atualizado!", "success");
            fetchSeries();
        } catch (error) {
            console.error('Error toggling feature:', error);
            addToast("Erro ao atualizar destaque.", "error");
        }
    };

    const handleManageEpisodes = async (series: any) => {
        setManagingSeries(series);
        try {
            const response = await api.get(`/series/${series.id}/episodes`);
            setEpisodeList(response.data);
            setIsEpisodeManagerOpen(true);
        } catch (error) {
            console.error("Failed to fetch episodes", error);
            addToast("Erro ao carregar episódios.", "error");
        }
    };

    const handleEditEpisode = (episode: any) => {
        setEditingEpisodeId(episode.id);
        setEpisodeData({
            series_id: episode.series_id.toString(),
            title: episode.title,
            episode_number: episode.episode_number,
            video_url: episode.video_url || '',
            duration: episode.duration || '',
            thumbnail_url: episode.thumbnail_url || '',
            drive_link: episode.drive_link || '',
            mega_link: episode.mega_link || '',
            mediafire_link: episode.mediafire_link || '',
            pixeldrain_link: episode.pixeldrain_link || '',
            youtube_link: episode.youtube_link || '',
            embed_url_1: episode.embed_url_1 || '',
            embed_url_2: episode.embed_url_2 || '',
            download_link: episode.download_link || '',
            is_locked: episode.is_locked
        });
        setIsEpisodeManagerOpen(false);
        // We set activeTab to 'series' (or keep it) but we need logic to define which modal to show.
        // We will repurpose 'episodes' tab concept internally or add a specific state 'isEpisodeModalOpen'.
        // For minimal refactor, I will reuse the 'episodes' tab concept just for the UI state, even if toolbar assumes series/actors.
        // But since I removed the button, let's keep it simple:
        // Use a flag or check if episodeData is being edited.
        // Actually, let's look at my Modal Logic below.
    };

    const handleDeleteEpisode = async (id: number) => {
        if (window.confirm("Deletar episódio?")) {
            try {
                await api.delete(`/episodes/${id}`);
                addToast("Episódio deletado.", "success");
                // Refresh list
                const response = await api.get(`/series/${managingSeries.id}/episodes`);
                setEpisodeList(response.data);
            } catch (error) {
                addToast("Erro ao deletar.", "error");
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (activeTab === 'series' && !editingEpisodeId && !isEpisodeManagerOpen && !episodeData.series_id) { // This condition is a bit tricky, 'activeTab' stays series even when editing episode?
                if (editingId) {
                    await api.put(`/series/${editingId}`, formData);
                    addToast("Projeto atualizado com sucesso!", "success");
                } else {
                    await api.post('/series/', formData);
                    addToast("Projeto adicionado com sucesso!", "success");
                }
                setIsModalOpen(false);
                fetchSeries();
            } else if (activeTab === 'actors') {
                if (editingId) {
                    await api.put(`/actors/${editingId}`, actorFormData);
                    addToast("Ator atualizado com sucesso!", "success");
                } else {
                    await api.post('/actors/', actorFormData);
                    addToast("Ator adicionado com sucesso!", "success");
                }
                setIsModalOpen(false);
                fetchActors();
            } else {
                // Formatting payload for Episode
                const payload = {
                    ...episodeData,
                    series_id: parseInt(episodeData.series_id),
                    episode_number: parseInt(episodeData.episode_number.toString())
                };

                if (editingEpisodeId) {
                    await api.put(`/episodes/${editingEpisodeId}`, payload);
                    addToast("Episódio atualizado!", "success");
                } else {
                    await api.post(`/series/${episodeData.series_id}/episodes`, payload);
                    addToast("Episódio adicionado!", "success");
                }
                setIsModalOpen(false);
                // If we were managing episodes, reopen manager? or just close?
                // Ideally refresh the manager list if it was open.
                if (managingSeries) {
                    const response = await api.get(`/series/${managingSeries.id}/episodes`);
                    setEpisodeList(response.data);
                    setIsEpisodeManagerOpen(true);
                }
            }
        } catch (error) {
            console.error("Failed to save:", error);
            addToast("Erro ao salvar. Verifique o console.", "error");
        } finally {
            setSaving(false);
        }
    };

    const extractSrc = (input: string) => {
        const match = input.match(/src=["']([^"']+)["']/);
        return match ? match[1] : input;
    };



    return (
        <div className="min-h-screen pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
                <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                        <p className="text-sm text-gray-400">Admin</p>
                        <p className="text-white font-medium">Logado</p>
                    </div>
                </div>
            </div>

            <StatsGrid stats={stats} />

            <DashboardToolbar
                activeTab={activeTab === 'episodes' ? 'series' : activeTab} // If 'episodes', show 'series' highlighted? Or neither.
                setActiveTab={setActiveTab}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterType={filterType}
                setFilterType={setFilterType}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterCountry={filterCountry}
                setFilterCountry={setFilterCountry}
                filterYear={filterYear}
                setFilterYear={setFilterYear}
                onAdd={handleOpenModal}
            />

            {activeTab === 'series' || activeTab === 'episodes' ? ( // Show Series table even if mode is episodes (modal handles the view) ? No.
                // If activeTab is episodes, we should probably still show the Series Table in background? 
                // In original code, the tabs switched the *list content*.
                // If I set activeTab='episodes', the list disappeared or showed episodes list?
                // Original: `activeTab === 'series' && <SeriesList ...>`
                // The user wanted to remove the TAB button because "Duplicate content".
                // So 'episodes' tab content was mirroring series table?
                // That implies we should just show SeriesTable when tab is 'series' OR 'episodes'.
                <SeriesTable
                    seriesList={seriesList}
                    loading={loading}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    setCurrentPage={setCurrentPage}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    handleToggleFeature={handleToggleFeature}
                    handleManageEpisodes={handleManageEpisodes}
                    setEpisodeData={setEpisodeData}
                    setActiveTab={setActiveTab} // Passing this allows the table buttons to switch mode
                    setIsModalOpen={setIsModalOpen}
                    itemsPerPage={itemsPerPage}
                    totalItems={totalItems}
                />
            ) : (
                <ActorsTable
                    actorList={actorList}
                    loading={loading}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage} // Assuming actors use same per page or just list all
                    handleEditActor={handleEditActor}
                    handleDeleteActor={handleDeleteActor}
                />
            )}

            <SeriesModal
                isOpen={isModalOpen && activeTab === 'series'}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSave}
                formData={formData}
                setFormData={setFormData}
                editingId={editingId}
                saving={saving}
                extractSrc={extractSrc}
            />

            <ActorModal
                isOpen={isModalOpen && activeTab === 'actors'}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSave}
                actorFormData={actorFormData}
                setActorFormData={setActorFormData}
                editingId={editingId}
                saving={saving}
            />

            <EpisodeModal
                isOpen={isModalOpen && activeTab === 'episodes'}
                onClose={() => {
                    setIsModalOpen(false);
                    // Optionally switch back to series
                    if (!managingSeries) setActiveTab('series');
                    // If we were managing via manager, maybe we want to reopen manager?
                    if (managingSeries) {
                        setIsEpisodeManagerOpen(true);
                        setActiveTab('series'); // Reset tab so background is correct?
                    }
                }}
                onSubmit={handleSave}
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
                onAddEpisode={() => {
                    setEpisodeData({
                        series_id: managingSeries.id.toString(),
                        title: '',
                        episode_number: episodeList.length + 1,
                        video_url: '',
                        duration: '',
                        thumbnail_url: '',
                        drive_link: '',
                        mega_link: '',
                        mediafire_link: '',
                        pixeldrain_link: '',
                        youtube_link: '',
                        embed_url_1: '',
                        embed_url_2: '',
                        download_link: '',
                        is_locked: false
                    });
                    setEditingEpisodeId(null);
                    setIsEpisodeManagerOpen(false);
                    setActiveTab('episodes'); // Switch to episode mode for the Modal
                    setIsModalOpen(true);
                }}
                onEditEpisode={(ep) => {
                    handleEditEpisode(ep); // This sets data and should switch tab/open modal
                    setActiveTab('episodes');
                    setIsModalOpen(true);
                }}
                onDeleteEpisode={handleDeleteEpisode}
            />
        </div>
    );
}
