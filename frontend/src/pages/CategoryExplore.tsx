import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Film, RefreshCw, X, ChevronRight } from 'lucide-react';
import { getSeries } from '../services/api';
import SeriesCard from '../components/SeriesCard';
import { useModal } from '../context/ModalContext';

const TYPES = [
    { value: 'All', label: 'Todos os Tipos' },
    { value: 'Series', label: 'Séries' },
    { value: 'Movie', label: 'Filmes' },
    { value: 'Donghua', label: 'Donghua / Anime' },
];

const COUNTRIES = [
    { value: 'All', label: 'Todos os Países' },
    { value: 'China', label: '🇨🇳 China' },
    { value: 'South Korea', label: '🇰🇷 Coreia do Sul' },
    { value: 'Thailand', label: '🇹🇭 Tailândia' },
    { value: 'Japan', label: '🇯🇵 Japão' },
    { value: 'Taiwan', label: '🇹🇼 Taiwan' },
    { value: 'Philippines', label: '🇵🇭 Filipinas' },
    { value: 'Vietnam', label: '🇻🇳 Vietnã' },
    { value: 'Turkey', label: '🇹🇷 Turquia' },
];

const STATUSES = [
    { value: 'All', label: 'Todos os Status' },
    { value: 'Completo', label: 'Concluídos' },
    { value: 'Em andamento', label: 'Em Andamento' },
];

const GENRES = [
    'All', 'Ação', 'Age Gap', 'Coabitação', 'Comédia', 'Contrato', 'Criança',
    'Cross-Dressing', 'Drama', 'Escolar', 'Escritório', 'Esports', 'Fantasia',
    'Histórico', 'LGBTQIA+', 'Médico', 'Minis', 'Mistério', 'Republicano',
    'Romance', 'Sobrenatural', 'Wuxia', 'Youth'
];

const TAG_SLUG_MAP: Record<string, { title: string; genreKeyword: string }> = {
    'acao-misterio': { title: 'AÇÃO / MISTÉRIO', genreKeyword: 'Ação' },
    'acao--misterio': { title: 'AÇÃO / MISTÉRIO', genreKeyword: 'Ação' },
    'age-gap': { title: 'AGE GAP', genreKeyword: 'Age Gap' },
    'coabitacao': { title: 'COABITAÇÃO', genreKeyword: 'Coabitação' },
    'contrato': { title: 'CONTRATO', genreKeyword: 'Contrato' },
    'crianca': { title: 'CRIANÇA', genreKeyword: 'Criança' },
    'cross-dressing': { title: 'CROSS-DRESSING', genreKeyword: 'Cross-Dressing' },
    'escolar': { title: 'ESCOLAR', genreKeyword: 'Escolar' },
    'escritorio': { title: 'ESCRITÓRIO', genreKeyword: 'Escritório' },
    'esports-jogo': { title: 'ESPORTS / JOGO', genreKeyword: 'Esports' },
    'esports--jogo': { title: 'ESPORTS / JOGO', genreKeyword: 'Esports' },
    'historico': { title: 'HISTÓRICO', genreKeyword: 'Histórico' },
    'lgbtqia': { title: 'LGBTQIA+', genreKeyword: 'LGBTQIA+' },
    'lgbtqiaplus': { title: 'LGBTQIA+', genreKeyword: 'LGBTQIA+' },
    'medico': { title: 'MÉDICO', genreKeyword: 'Médico' },
    'minis': { title: 'MINIS', genreKeyword: 'Minis' },
    'republicano': { title: 'REPUBLICANO', genreKeyword: 'Republicano' },
    'sobrenatural': { title: 'SOBRENATURAL', genreKeyword: 'Sobrenatural' },
    'wuxia': { title: 'WUXIA', genreKeyword: 'Wuxia' },
};

// Helper to normalize slug to category/tag title
function getRouteMetadata(pathname: string, categoryParam?: string, tagParam?: string, colParam?: string) {
    if (pathname.startsWith('/category/')) {
        const cat = (categoryParam || '').toLowerCase();
        if (cat === 'dramas') return { title: 'Dramas Asiáticos', subtitle: 'Explore nossa seleção de doramas e dramas asiáticos.', defaultType: 'Series', defaultGenre: 'All' };
        if (cat === 'filmes') return { title: 'Filmes Asiáticos', subtitle: 'Filmes de todos os países orientais em alta definição.', defaultType: 'Movie', defaultGenre: 'All' };
        if (cat === 'animes' || cat === 'donghua') return { title: 'Animes & Donghuas', subtitle: 'Animações chinesas e japonesas legendadas em PT-BR.', defaultType: 'Donghua', defaultGenre: 'All' };
        if (cat === 'manhua') return { title: 'Manhuas & Histórias', subtitle: 'Projetos baseados em webcomics e manhuas.', defaultType: 'All', defaultGenre: 'Manhua' };
        if (cat === 'novels') return { title: 'Novels & Literatura', subtitle: 'Adaptações de webnovels e romances chineses.', defaultType: 'All', defaultGenre: 'Novel' };
    }

    if (pathname.startsWith('/tag/')) {
        const slug = (tagParam || '').toLowerCase();
        const mapped = TAG_SLUG_MAP[slug];
        const rawTag = mapped ? mapped.title : (tagParam || '').replace(/-/g, ' ').toUpperCase();
        const keyword = mapped ? mapped.genreKeyword : tagParam;

        return {
            title: `Tag: ${rawTag}`,
            subtitle: `Séries e filmes catalogados na tag "${rawTag}".`,
            defaultType: 'All',
            defaultGenre: keyword
        };
    }

    if (pathname.startsWith('/collection/chinese-dynasty') || colParam === 'chinese-dynasty') {
        return {
            title: 'Dinastia Chinesa',
            subtitle: 'Dramas históricos, Wuxia e épicos da antiga China.',
            defaultType: 'All',
            defaultCountry: 'China',
            defaultGenre: 'Historical'
        };
    }

    if (pathname === '/schedule') {
        return {
            title: 'Cronograma de Lançamentos',
            subtitle: 'Todas as séries em andamento sendo traduzidas e lançadas.',
            defaultType: 'All',
            defaultStatus: 'Em andamento'
        };
    }

    if (pathname === '/coming-soon') {
        return {
            title: 'Em Breve no HuaPlay',
            subtitle: 'Próximos lançamentos e dramas em andamento.',
            defaultType: 'All',
            defaultStatus: 'Em andamento'
        };
    }

    return {
        title: 'Explorar Catálogo',
        subtitle: 'Busque e filtre entre todas as 1.200+ séries, filmes e donghuas.',
        defaultType: 'All'
    };
}

export default function CategoryExplore() {
    const { category, tag, collection } = useParams<{ category?: string; tag?: string; collection?: string }>();
    const location = useLocation();
    const { openModal } = useModal();

    const meta = useMemo(() => getRouteMetadata(location.pathname, category, tag, collection), [location.pathname, category, tag, collection]);

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string>(meta.defaultType || 'All');
    const [selectedCountry, setSelectedCountry] = useState<string>(meta.defaultCountry || 'All');
    const [selectedStatus, setSelectedStatus] = useState<string>(meta.defaultStatus || 'All');
    const [selectedGenre, setSelectedGenre] = useState<string>(meta.defaultGenre || 'All');

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const LIMIT = 36;

    // Reset filters when route changes
    useEffect(() => {
        setSelectedType(meta.defaultType || 'All');
        setSelectedCountry(meta.defaultCountry || 'All');
        setSelectedStatus(meta.defaultStatus || 'All');
        setSelectedGenre(meta.defaultGenre || 'All');
        setSearchQuery('');
        setPage(1);
    }, [meta]);

    // Fetch items from backend API
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const params: any = {
            skip: (page - 1) * LIMIT,
            limit: LIMIT,
        };

        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (selectedType !== 'All') params.type = selectedType;
        if (selectedCountry !== 'All') params.country = selectedCountry;
        if (selectedStatus !== 'All') params.status = selectedStatus;
        if (selectedGenre !== 'All') params.genre = selectedGenre;

        getSeries(params)
            .then((data: any) => {
                if (!isMounted) return;
                setItems(data);
                setLoading(false);
            })
            .catch((err: any) => {
                console.error('Error fetching filtered series:', err);
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [selectedType, selectedCountry, selectedStatus, selectedGenre, searchQuery, page]);

    const hasActiveFilters = selectedType !== 'All' || selectedCountry !== 'All' || selectedStatus !== 'All' || selectedGenre !== 'All' || searchQuery !== '';

    const resetFilters = () => {
        setSelectedType('All');
        setSelectedCountry('All');
        setSelectedStatus('All');
        setSelectedGenre('All');
        setSearchQuery('');
        setPage(1);
    };

    return (
        <div className="min-h-screen bg-background pt-24 pb-20 text-white">
            {/* Header Hero Banner */}
            <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-primary/10 via-background to-background py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">
                        <Link to="/" className="hover:text-primary transition-colors">Início</Link>
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <span className="text-primary">{meta.title}</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-display font-bold text-white tracking-tight flex items-center gap-3">
                                {meta.title}
                            </h1>
                            <p className="text-gray-400 text-sm md:text-base mt-2 max-w-2xl">
                                {meta.subtitle}
                            </p>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por título..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 focus:border-primary rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                {/* Filter Toolbar */}
                <div className="bg-surface/60 border border-white/10 rounded-2xl p-4 mb-8 backdrop-blur-md shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Filter className="w-4 h-4 text-primary" />
                            <span>Filtros do Catálogo</span>
                        </div>

                        {hasActiveFilters && (
                            <button
                                onClick={resetFilters}
                                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Limpar Filtros
                            </button>
                        )}
                    </div>

                    {/* Filter Selectors Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Type Filter */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tipo</label>
                            <select
                                value={selectedType}
                                onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none transition-all cursor-pointer"
                            >
                                {TYPES.map((t) => (
                                    <option key={t.value} value={t.value} className="bg-neutral-900">{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Country Filter */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">País</label>
                            <select
                                value={selectedCountry}
                                onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none transition-all cursor-pointer"
                            >
                                {COUNTRIES.map((c) => (
                                    <option key={c.value} value={c.value} className="bg-neutral-900">{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none transition-all cursor-pointer"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s.value} value={s.value} className="bg-neutral-900">{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Genre Filter */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Gênero / Categoria</label>
                            <select
                                value={selectedGenre}
                                onChange={(e) => { setSelectedGenre(e.target.value); setPage(1); }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary focus:outline-none transition-all cursor-pointer"
                            >
                                {GENRES.map((g) => (
                                    <option key={g} value={g} className="bg-neutral-900">{g === 'All' ? 'Todos os Gêneros' : g}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Items Grid & States */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 18 }).map((_, i) => (
                            <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-20 text-center border border-white/10 rounded-2xl bg-surface/30">
                        <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-white">Nenhum conteúdo encontrado</h3>
                        <p className="text-gray-400 text-sm mt-1">Tente ajustar seus filtros ou termo de busca.</p>
                        <button
                            onClick={resetFilters}
                            className="mt-4 px-4 py-2 bg-primary text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all"
                        >
                            Limpar Filtros
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs text-gray-400 font-semibold">
                                Mostrando {items.length} obras nesta página
                            </span>
                        </div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                        >
                            {items.map((item) => (
                                <SeriesCard
                                    key={item.id}
                                    item={item}
                                    onOpenModal={openModal}
                                />
                            ))}
                        </motion.div>

                        {/* Pagination Buttons */}
                        <div className="flex justify-center items-center gap-4 mt-12">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-semibold hover:border-primary disabled:opacity-30 disabled:hover:border-white/10 transition-all"
                            >
                                Anterior
                            </button>
                            <span className="text-xs text-gray-400 font-semibold">
                                Página {page}
                            </span>
                            <button
                                disabled={items.length < LIMIT}
                                onClick={() => setPage((p) => p + 1)}
                                className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-semibold hover:border-primary disabled:opacity-30 disabled:hover:border-white/10 transition-all"
                            >
                                Próxima
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
