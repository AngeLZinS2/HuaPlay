import { Tv, Users, Search, Plus } from 'lucide-react';

interface DashboardToolbarProps {
    activeTab: 'series' | 'actors' | 'episodes';
    setActiveTab: (tab: 'series' | 'actors' | 'episodes') => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterType: string;
    setFilterType: (type: string) => void;
    filterStatus: string;
    setFilterStatus: (status: string) => void;
    filterCountry: string;
    setFilterCountry: (country: string) => void;
    filterYear: string;
    setFilterYear: (year: string) => void;
    onAdd: () => void;
}

export default function DashboardToolbar({
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterCountry,
    setFilterCountry,
    filterYear,
    setFilterYear,
    onAdd
}: DashboardToolbarProps) {
    return (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 bg-surface p-4 rounded-xl border border-gray-800">
            <div className="flex gap-4 w-full md:w-auto">
                <button
                    onClick={() => setActiveTab('series')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'series' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                >
                    <Tv className="w-4 h-4" /> Séries
                </button>

                <button
                    onClick={() => setActiveTab('actors')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'actors' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                >
                    <Users className="w-4 h-4" /> Atores
                </button>
            </div>

            <div className="flex flex-wrap gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar projeto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 pl-10 pr-4 py-2 bg-black/50 border border-white/10 rounded-lg text-sm focus:border-primary outline-none text-white placeholder-gray-500"
                    />
                </div>

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-gray-300"
                >
                    <option value="All">Todos os Tipos</option>
                    <option value="Series">Series</option>
                    <option value="Movie">Filmes</option>
                    <option value="Anime">Animes</option>
                    <option value="Donghua">Donghuas</option>
                </select>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-gray-300"
                >
                    <option value="All">Todos Status</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Completo">Completo</option>
                </select>

                <input
                    type="text"
                    placeholder="País (ex: China)"
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="w-32 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-white placeholder-gray-500"
                />

                <input
                    type="number"
                    placeholder="Ano"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="w-24 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-white placeholder-gray-500"
                />
            </div>
            <button
                onClick={onAdd}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 transition-all hover:scale-105 shadow-lg shadow-primary/25"
            >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Adicionar</span>
            </button>
        </div>
    );
}
