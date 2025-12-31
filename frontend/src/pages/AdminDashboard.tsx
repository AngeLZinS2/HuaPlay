import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Edit, Trash2, Film, Tv, Save, X,
    Search, TrendingUp, CheckCircle, PlayCircle, List, Star, Users
} from 'lucide-react';
import api, { getActors, createActor, updateActor, deleteActor } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminDashboard() {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'series' | 'episodes' | 'actors'>('series');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [seriesList, setSeriesList] = useState<any[]>([]);
    const [actorList, setActorList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ...

    const handleToggleFeature = async (id: number) => {
        try {
            const series = seriesList.find(s => s.id === id);
            const isCurrentlyFeatured = series?.is_featured;

            await api.post(`/series/${id}/feature`);

            setSeriesList(prev => prev.map(item => {
                if (item.id === id) {
                    return { ...item, is_featured: !isCurrentlyFeatured };
                }
                // If we are enabling a new featured item, disable others. 
                // If we are disabling the current one, others remain disabled.
                return !isCurrentlyFeatured ? { ...item, is_featured: false } : item;
            }));

            addToast(isCurrentlyFeatured ? "Destaque removido!" : "Série definida como destaque!", "success");
        } catch (error) {
            console.error("Failed to set featured series:", error);
            addToast("Erro ao alterar destaque", "error");
        }
    };

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');

    // Edit Mode State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingEpisodeId, setEditingEpisodeId] = useState<number | null>(null);

    // Episode Management State
    const [isEpisodeManagerOpen, setIsEpisodeManagerOpen] = useState(false);
    const [managingSeries, setManagingSeries] = useState<any | null>(null);
    const [episodeList, setEpisodeList] = useState<any[]>([]);

    // Form State (Series)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        cover_image: '',
        banner_image: '',
        genre: '',
        type: 'Series',
        country: '',
        status: 'Em andamento',
        release_year: new Date().getFullYear(),
        trailer_url: '',
        cast: '',
        drive_link: '',
        mega_link: '',
        mediafire_link: '',
        pixeldrain_link: '',
    });

    // Form State (Episode)
    const [episodeData, setEpisodeData] = useState({
        series_id: '',
        title: '',
        episode_number: 1,
        embed_url_1: '',
        embed_url_2: '',
        download_link: '',
        drive_link: '',
        mega_link: '',
        mediafire_link: '',
        pixeldrain_link: '',
    });

    const [actorFormData, setActorFormData] = useState({
        name: '',
        gender: 'Female',
        image_url: '',
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchSeries = async () => {
        try {
            const response = await api.get('/series', { params: { limit: 1000 } });
            setSeriesList(response.data);
        } catch (error) {
            console.error("Failed to fetch series:", error);
            addToast("Erro ao carregar séries", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchEpisodes = async (seriesId: number) => {
        try {
            const response = await api.get(`/series/${seriesId}/episodes`);
            setEpisodeList(response.data);
        } catch (error) {
            console.error("Failed to fetch episodes:", error);
            addToast("Erro ao carregar episódios", "error");
        }
    };

    const fetchActorsList = async () => {
        try {
            const data = await getActors();
            setActorList(data);
        } catch (error) {
            console.error("Failed to fetch actors:", error);
            addToast("Erro ao carregar atores", "error");
        }
    };

    useEffect(() => {
        fetchSeries();
        fetchActorsList();
    }, []);

    // Statistics Calculation
    const stats = useMemo(() => {
        const total = seriesList.length;
        const ongoing = seriesList.filter(s => s.status === 'Em andamento').length;
        const completed = seriesList.filter(s => s.status === 'Completo').length;
        const types = {
            series: seriesList.filter(s => s.type === 'Series').length,
            movies: seriesList.filter(s => s.type === 'Movie').length,
            anime: seriesList.filter(s => s.type === 'Anime').length,
            donghua: seriesList.filter(s => s.type === 'Donghua').length,
        };
        return { total, ongoing, completed, types };
    }, [seriesList]);

    // Filtered List
    const filteredList = useMemo(() => {
        return seriesList.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'All' || item.type === filterType;
            return matchesSearch && matchesType;
        });
    }, [seriesList, searchTerm, filterType]);

    // Pagination Logic (Client Side)
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredList.slice(start, start + itemsPerPage);
    }, [filteredList, currentPage]);

    const totalPages = Math.ceil(filteredList.length / itemsPerPage);

    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);

    const handleDelete = async (id: number) => {
        if (confirm("Tem certeza que deseja excluir esta série?")) {
            try {
                await api.delete(`/series/${id}`);
                setSeriesList(prev => prev.filter(item => item.id !== id));
                addToast("Série excluída com sucesso", "success");
            } catch (error) {
                console.error("Failed to delete series:", error);
                addToast("Erro ao excluir série", "error");
            }
        }
    };

    const handleEdit = (item: any) => {
        setFormData({
            title: item.title,
            description: item.description || '',
            cover_image: item.cover_image || '',
            banner_image: item.banner_image || '',
            genre: item.genre,
            type: item.type || 'Series',
            country: item.country,
            status: item.status,
            release_year: item.release_year,
            trailer_url: item.trailer_url || '',
            cast: item.cast || '',
            // Connect legacy fields or API response fields
            drive_link: item.drive_link || '',
            mega_link: item.mega_link || '',
            mediafire_link: item.mediafire_link || '',
            pixeldrain_link: item.pixeldrain_link || '',
        });
        setEditingId(item.id);
        setActiveTab('series');
        setIsModalOpen(true);
    };

    const handleManageEpisodes = async (item: any) => {
        setManagingSeries(item);
        setIsEpisodeManagerOpen(true);
        await fetchEpisodes(item.id);
    };

    const handleEditEpisode = (episode: any) => {
        setEpisodeData({
            series_id: episode.series_id.toString(),
            title: episode.title,
            episode_number: episode.episode_number,
            embed_url_1: episode.embed_url_1 || '',
            embed_url_2: episode.embed_url_2 || '',
            download_link: episode.download_link || '',
            drive_link: episode.drive_link || '',
            mega_link: episode.mega_link || '',
            mediafire_link: episode.mediafire_link || '',
            pixeldrain_link: episode.pixeldrain_link || '',
        });
        setEditingEpisodeId(episode.id);

        // Close manager, open main modal in episode edit mode
        setIsEpisodeManagerOpen(false);
        setActiveTab('episodes');
        setIsModalOpen(true);
    };

    const handleDeleteEpisode = async (id: number) => {
        if (confirm("Tem certeza que deseja excluir este episódio?")) {
            try {
                await api.delete(`/series/episodes/${id}`);
                setEpisodeList(prev => prev.filter(item => item.id !== id));
                addToast("Episódio excluído com sucesso", "success");
            } catch (error) {
                console.error("Failed to delete episode:", error);
                addToast("Erro ao excluir episódio", "error");
            }
        }
    };

    const handleDeleteActor = async (id: number) => {
        if (confirm("Tem certeza que deseja excluir este ator?")) {
            try {
                await deleteActor(id);
                setActorList(prev => prev.filter(item => item.id !== id));
                addToast("Ator excluído com sucesso", "success");
            } catch (error) {
                console.error("Failed to delete actor:", error);
                addToast("Erro ao excluir ator", "error");
            }
        }
    };

    const handleEditActor = (actor: any) => {
        setActorFormData({
            name: actor.name,
            gender: actor.gender || 'Female',
            image_url: actor.image_url || '',
        });
        setEditingId(actor.id);
        setActiveTab('actors');
        setIsModalOpen(true);
    };

    const handleOpenModal = () => {
        setEditingId(null);
        // Reset forms
        setFormData({
            title: '',
            description: '',
            cover_image: '',
            banner_image: '',
            genre: '',
            type: 'Series',
            country: '',
            status: 'Em andamento',
            release_year: new Date().getFullYear(),
            trailer_url: '',
            cast: '',
            drive_link: '',
            mega_link: '',
            mediafire_link: '',
            pixeldrain_link: '',
        });
        setEpisodeData({
            series_id: seriesList.length > 0 ? seriesList[0].id.toString() : '',
            title: '',
            episode_number: 1,
            embed_url_1: '',
            embed_url_2: '',
            download_link: '',
            drive_link: '',
            mega_link: '',
            mediafire_link: '',
            pixeldrain_link: '',
        });
        setActorFormData({
            name: '',
            gender: 'Female',
            image_url: '',
        });
        setEditingEpisodeId(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (activeTab === 'series') {
                if (editingId) {
                    await api.put(`/series/${editingId}`, formData);
                    addToast("Série atualizada com sucesso!", "success");
                } else {
                    await api.post('/series', formData);
                    addToast("Série criada com sucesso!", "success");
                }
            } else if (activeTab === 'actors') {
                if (editingId) {
                    await updateActor(editingId, actorFormData);
                    addToast("Ator atualizado com sucesso!", "success");
                } else {
                    await createActor(actorFormData);
                    addToast("Ator criado com sucesso!", "success");
                }
                fetchActorsList();
            } else {
                // Save Episode
                if (!episodeData.series_id) {
                    addToast("Selecione uma série!", "error");
                    setSaving(false);
                    return;
                }

                if (editingEpisodeId) {
                    const payload = {
                        ...episodeData,
                        series_id: parseInt(episodeData.series_id),
                        episode_number: parseInt(episodeData.episode_number.toString())
                    };
                    await api.put(`/series/episodes/${editingEpisodeId}`, payload);
                    addToast("Episódio atualizado com sucesso!", "success");
                } else {
                    const payload = {
                        ...episodeData,
                        series_id: parseInt(episodeData.series_id),
                        episode_number: parseInt(episodeData.episode_number.toString())
                    };
                    await api.post(`/series/${episodeData.series_id}/episodes`, payload);
                    addToast("Episódio adicionado com sucesso!", "success");
                }
            }
            setIsModalOpen(false);
            if (activeTab === 'series') fetchSeries();
        } catch (error) {
            console.error("Failed to save:", error);
            addToast("Erro ao salvar. Verifique o console.", "error");
        } finally {
            setSaving(false);
        }
    };

    const StatusCard = ({ title, value, icon: Icon, color }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-gray-800 p-6 rounded-xl flex items-center justify-between"
        >
            <div>
                <p className="text-gray-400 text-sm mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
                <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
            </div>
        </motion.div>
    );

    const extractSrc = (input: string) => {
        const match = input.match(/src=["']([^"']+)["']/);
        return match ? match[1] : input;
    };

    return (
        <div className="min-h-screen pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
                <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                        <p className="text-sm text-gray-400">Admin</p>
                        <p className="text-white font-medium">Logado</p>
                    </div>
                </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatusCard title="Total Projetos" value={stats.total} icon={Film} color="text-blue-500 bg-blue-500" />
                <StatusCard title="Em Andamento" value={stats.ongoing} icon={PlayCircle} color="text-yellow-500 bg-yellow-500" />
                <StatusCard title="Concluídos" value={stats.completed} icon={CheckCircle} color="text-green-500 bg-green-500" />
                <StatusCard title="Novos (Hoje)" value={0} icon={TrendingUp} color="text-purple-500 bg-purple-500" />
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 bg-surface p-4 rounded-xl border border-gray-800">
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('series')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'series' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Tv className="w-4 h-4" /> Séries
                    </button>
                    <button
                        onClick={() => setActiveTab('episodes')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'episodes' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Film className="w-4 h-4" /> Episódios
                    </button>
                    <button
                        onClick={() => setActiveTab('actors')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'actors' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Users className="w-4 h-4" /> Atores
                    </button>
                </div>

                <div className="flex gap-4 w-full md:w-auto items-center">
                    <div className="relative group flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar série..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:border-primary outline-none transition-all"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-black/50 border border-gray-700 rounded-lg px-4 py-2 focus:border-primary outline-none"
                    >
                        <option value="All">Todos Tipos</option>
                        <option value="Series">Séries</option>
                        <option value="Movie">Filmes</option>
                        <option value="Anime">Animes</option>
                        <option value="Donghua">Donghuas</option>
                    </select>

                    <button
                        onClick={handleOpenModal}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 transition-all hover:scale-105 shadow-lg shadow-primary/25"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Adicionar</span>
                    </button>
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-surface rounded-xl overflow-hidden border border-gray-800 shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="p-4">ID</th>
                            {activeTab === 'actors' ? (
                                <>
                                    <th className="p-4">Imagem</th>
                                    <th className="p-4">Nome</th>
                                    <th className="p-4">Gênero</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-4">Capa</th>
                                    <th className="p-4">Título</th>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Gênero</th>
                                    <th className="p-4">Ano</th>
                                </>
                            )}
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        <AnimatePresence>
                            {activeTab === 'actors' ? (
                                <>
                                    <tbody className="divide-y divide-gray-800">
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
                                                    <tr key={actor.id} className="group hover:bg-white/5 transition-colors">
                                                        <td className="p-4 text-gray-500">#{actor.id}</td>
                                                        <td className="p-4">
                                                            <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden">
                                                                <img
                                                                    src={actor.image_url || "https://via.placeholder.com/300x400?text=No+Image"}
                                                                    alt={actor.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-medium text-white">{actor.name}</td>
                                                        <td className="p-4 text-gray-400">
                                                            {actor.gender === 'Female' ? 'Atriz' : 'Ator'}
                                                        </td>
                                                        <td className="p-4">
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
                                                    </tr>
                                                ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                                    Nenhum ator encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {/* Pagination Controls */}
                                    {actorList.length > itemsPerPage && (
                                        <tfoot>
                                            <tr>
                                                <td colSpan={5} className="p-4 border-t border-gray-800">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">
                                                            Página {currentPage} de {Math.ceil(actorList.length / itemsPerPage)}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                                disabled={currentPage === 1}
                                                                className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
                                                            >
                                                                Anterior
                                                            </button>
                                                            <button
                                                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(actorList.length / itemsPerPage), p + 1))}
                                                                disabled={currentPage >= Math.ceil(actorList.length / itemsPerPage)}
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
                                </>
                            ) : (
                                paginatedList.map((item) => (
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
                                                        setEpisodeData({ ...episodeData, series_id: item.id.toString() });
                                                        setActiveTab('episodes');
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
                            )}
                        </AnimatePresence>
                        {((activeTab === 'actors' && actorList.length === 0) || (activeTab !== 'actors' && filteredList.length === 0)) && !loading && (
                            <tr>
                                <td colSpan={8} className="p-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Film className="w-8 h-8 opacity-20" />
                                        <p>Nenhum item encontrado.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {activeTab !== 'actors' && filteredList.length > itemsPerPage && (
                        <tfoot>
                            <tr>
                                <td colSpan={5} className="p-4 border-t border-gray-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
                                            >
                                                Anterior
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
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
                                    {editingId || editingEpisodeId ? 'Editar' : 'Adicionar'} {activeTab === 'series' ? 'Projeto' : activeTab === 'actors' ? 'Ator' : 'Episódio'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-6">
                                {activeTab === 'series' ? (
                                    <>
                                        {/* Main Info Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Left Column: Basic Info */}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Título</label>
                                                    <input
                                                        type="text"
                                                        value={formData.title}
                                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-primary outline-none text-white transition-all text-lg font-medium"
                                                        placeholder="Ex: Kingdom of Mystery"
                                                        required
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                                                        <select
                                                            value={formData.status}
                                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        >
                                                            <option value="Em andamento">Em andamento</option>
                                                            <option value="Completo">Completo</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo</label>
                                                        <select
                                                            value={formData.type}
                                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        >
                                                            <option value="Series">Série</option>
                                                            <option value="Movie">Filme</option>
                                                            <option value="Anime">Anime</option>
                                                            <option value="Donghua">Donghua</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ano</label>
                                                        <input
                                                            type="number"
                                                            value={formData.release_year}
                                                            onChange={(e) => setFormData({ ...formData, release_year: parseInt(e.target.value) })}
                                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">País</label>
                                                        <input
                                                            type="text"
                                                            value={formData.country}
                                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Gênero</label>
                                                    <input
                                                        type="text"
                                                        value={formData.genre}
                                                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Elenco</label>
                                                    <input
                                                        type="text"
                                                        value={formData.cast}
                                                        onChange={(e) => setFormData({ ...formData, cast: e.target.value })}
                                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        placeholder="Atores separados por vírgula"
                                                    />
                                                </div>
                                            </div>

                                            {/* Right Column: Images & Extra */}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Capa URL (Vertical)</label>
                                                    <div className="flex gap-4">
                                                        <input
                                                            type="text"
                                                            value={formData.cover_image}
                                                            onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                                                            className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        />
                                                        {formData.cover_image && (
                                                            <img src={formData.cover_image} alt="Cover Preview" className="h-10 w-auto rounded border border-gray-700" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Banner URL (Horizontal)</label>
                                                    <div className="flex gap-4">
                                                        <input
                                                            type="text"
                                                            value={formData.banner_image}
                                                            onChange={(e) => setFormData({ ...formData, banner_image: e.target.value })}
                                                            className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        />
                                                        {formData.banner_image && (
                                                            <img src={formData.banner_image} alt="Banner Preview" className="h-10 w-auto rounded border border-gray-700" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Trailer URL</label>
                                                    <input
                                                        type="text"
                                                        value={formData.trailer_url}
                                                        onChange={(e) => setFormData({ ...formData, trailer_url: extractSrc(e.target.value) })}
                                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        placeholder="YouTube, Ok.ru ou Google Drive"
                                                    />
                                                </div>

                                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Descrição</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none h-[120px] text-white transition-all focus:bg-black/80 resize-none text-sm leading-relaxed"
                                                    placeholder="Sinopse do drama..."
                                                />
                                            </div>

                                        </div>
                                    </>
                                ) : activeTab === 'actors' ? (
                                    <>
                                        {/* ACTOR FORM FIELDS */}
                                        <div className="grid grid-cols-1 gap-6">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Ator/Atriz</label>
                                                <input
                                                    type="text"
                                                    value={actorFormData.name}
                                                    onChange={(e) => setActorFormData({ ...actorFormData, name: e.target.value })}
                                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-primary outline-none text-white transition-all text-lg font-medium"
                                                    placeholder="Ex: Dilraba Dilmurat"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Gênero</label>
                                                <select
                                                    value={actorFormData.gender}
                                                    onChange={(e) => setActorFormData({ ...actorFormData, gender: e.target.value })}
                                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-primary outline-none text-white transition-all"
                                                >
                                                    <option value="Female">Atriz</option>
                                                    <option value="Male">Ator</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">URL da Imagem</label>
                                                <div className="flex gap-4">
                                                    <input
                                                        type="text"
                                                        value={actorFormData.image_url}
                                                        onChange={(e) => setActorFormData({ ...actorFormData, image_url: e.target.value })}
                                                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                                        placeholder="https://..."
                                                        required
                                                    />
                                                    {actorFormData.image_url && (
                                                        <img src={actorFormData.image_url} alt="Preview" className="h-20 w-auto rounded border border-gray-700 object-cover" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}

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
                                            <Save className="w-5 h-5" /> Salvar {activeTab === 'series' ? 'Projeto' : activeTab === 'actors' ? 'Ator' : 'Episódio'}
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Episode Manager Modal */}
            <AnimatePresence>
                {
                    isEpisodeManagerOpen && managingSeries && (
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
                                            onClick={() => {
                                                setIsEpisodeManagerOpen(false);
                                                setEpisodeData({ ...episodeData, series_id: managingSeries.id.toString() });
                                                setActiveTab('episodes');
                                                setEditingEpisodeId(null);
                                                setIsModalOpen(true);
                                            }}
                                            className="px-3 py-1.5 bg-green-600 rounded-lg text-white text-sm hover:bg-green-500 transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" /> Novo
                                        </button>
                                        <button onClick={() => setIsEpisodeManagerOpen(false)} className="text-gray-400 hover:text-white transition-colors">
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
                                                                onClick={() => handleEditEpisode(ep)}
                                                                className="p-1.5 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEpisode(ep.id)}
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
                    )
                }
            </AnimatePresence >
        </div >
    );
}
