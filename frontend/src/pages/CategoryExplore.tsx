import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    SlidersHorizontal,
    Film,
    RefreshCw,
    X,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Play,
    Plus,
    Check,
    Info,
    LayoutGrid,
    LayoutList,
    Sparkles,
    ArrowUpDown,
} from 'lucide-react';
import { getSeriesPage, type SeriesQuery } from '../services/api';
import CatalogCard, {
    formatCountryPt,
    formatTypePt,
    parseGenres,
} from '../components/CatalogCard';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { addToMyList, removeFromMyList } from '../services/userData';
import type { Series } from '../types/models';
import { getOptimizedImageUrl } from '../utils/image';

const TYPES = [
    { value: 'All', label: 'Todos', fullLabel: 'Todos os Tipos' },
    { value: 'Series', label: 'Séries', fullLabel: 'Séries' },
    { value: 'Movie', label: 'Filmes', fullLabel: 'Filmes' },
    { value: 'Donghua', label: 'Donghuas', fullLabel: 'Donghua / Anime' },
];

const COUNTRIES = [
    { value: 'All', label: 'Todos', fullLabel: 'Todos os Países' },
    { value: 'China', label: 'China', fullLabel: '🇨🇳 China' },
    { value: 'South Korea', label: 'Coreia do Sul', fullLabel: '🇰🇷 Coreia do Sul' },
    { value: 'Thailand', label: 'Tailândia', fullLabel: '🇹🇭 Tailândia' },
    { value: 'Japan', label: 'Japão', fullLabel: '🇯🇵 Japão' },
    { value: 'Taiwan', label: 'Taiwan', fullLabel: '🇹🇼 Taiwan' },
    { value: 'Philippines', label: 'Filipinas', fullLabel: '🇵🇭 Filipinas' },
    { value: 'Vietnam', label: 'Vietnã', fullLabel: '🇻🇳 Vietnã' },
    { value: 'Turkey', label: 'Turquia', fullLabel: '🇹🇷 Turquia' },
];

const STATUSES = [
    { value: 'All', label: 'Todos', fullLabel: 'Todos os Status' },
    { value: 'Em andamento', label: 'Em Andamento', fullLabel: 'Em Andamento' },
    { value: 'Completo', label: 'Concluídos', fullLabel: 'Concluídos' },
];

const GENRES = [
    'All', 'Ação', 'Age Gap', 'Coabitação', 'Comédia', 'Contrato', 'Criança',
    'Cross-Dressing', 'Drama', 'Escolar', 'Escritório', 'Esports', 'Fantasia',
    'Histórico', 'LGBTQIA+', 'Médico', 'Minis', 'Mistério', 'Republicano',
    'Romance', 'Sobrenatural', 'Wuxia', 'Youth',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS: string[] = [
    'All',
    ...Array.from({ length: Math.max(12, CURRENT_YEAR - 2009) }, (_, i) => String(CURRENT_YEAR - i)),
];

type SortOption = 'default' | 'year_desc' | 'popular' | 'title_asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'default', label: 'Padrão' },
    { value: 'year_desc', label: 'Ano (Mais novo)' },
    { value: 'popular', label: 'Mais populares' },
    { value: 'title_asc', label: 'Título (A–Z)' },
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

interface RouteMeta {
    title: string;
    subtitle: string;
    eyebrow: string;
    searchPlaceholder: string;
    defaultType: string;
    defaultCountry?: string;
    defaultStatus?: string;
    defaultGenre?: string;
    isSchedule?: boolean;
}

function getRouteMetadata(
    pathname: string,
    categoryParam?: string,
    tagParam?: string,
    colParam?: string
): RouteMeta {
    if (pathname.startsWith('/category/')) {
        const cat = (categoryParam || '').toLowerCase();
        if (cat === 'dramas') {
            return {
                title: 'Dramas Asiáticos',
                subtitle: 'Explore nossa seleção de doramas e dramas asiáticos em HD.',
                eyebrow: 'DESTAQUE EM DRAMAS ASIÁTICOS',
                searchPlaceholder: 'Buscar em Dramas...',
                defaultType: 'Series',
                defaultGenre: 'All',
            };
        }
        if (cat === 'filmes') {
            return {
                title: 'Filmes Asiáticos',
                subtitle: 'Filmes de todos os países orientais em alta definição.',
                eyebrow: 'DESTAQUE EM FILMES ASIÁTICOS',
                searchPlaceholder: 'Buscar em Filmes...',
                defaultType: 'Movie',
                defaultGenre: 'All',
            };
        }
        if (cat === 'animes' || cat === 'donghua') {
            return {
                title: 'Animes & Donghuas',
                subtitle: 'Animações chinesas e japonesas legendadas em PT-BR.',
                eyebrow: 'DESTAQUE EM ANIMES & DONGHUAS',
                searchPlaceholder: 'Buscar em Donghuas...',
                defaultType: 'Donghua',
                defaultGenre: 'All',
            };
        }
        if (cat === 'manhua') {
            return {
                title: 'Manhuas & Histórias',
                subtitle: 'Projetos baseados em webcomics e manhuas.',
                eyebrow: 'DESTAQUE EM MANHUAS',
                searchPlaceholder: 'Buscar em Manhuas...',
                defaultType: 'All',
                defaultGenre: 'Manhua',
            };
        }
        if (cat === 'novels') {
            return {
                title: 'Novels & Literatura',
                subtitle: 'Adaptações de webnovels e romances chineses.',
                eyebrow: 'DESTAQUE EM NOVELS',
                searchPlaceholder: 'Buscar em Novels...',
                defaultType: 'All',
                defaultGenre: 'Novel',
            };
        }
    }

    if (pathname.startsWith('/tag/')) {
        const slug = (tagParam || '').toLowerCase();
        const mapped = TAG_SLUG_MAP[slug];
        const rawTag = mapped ? mapped.title : (tagParam || '').replace(/-/g, ' ').toUpperCase();
        const keyword = mapped ? mapped.genreKeyword : tagParam;

        return {
            title: `Tag: ${rawTag}`,
            subtitle: `Séries e filmes catalogados na tag "${rawTag}".`,
            eyebrow: `DESTAQUE EM ${rawTag}`,
            searchPlaceholder: `Buscar em ${rawTag}...`,
            defaultType: 'All',
            defaultGenre: keyword || 'All',
        };
    }

    if (pathname.startsWith('/collection/chinese-dynasty') || colParam === 'chinese-dynasty') {
        return {
            title: 'Dinastia Chinesa',
            subtitle: 'Dramas históricos, Wuxia e épicos da antiga China.',
            eyebrow: 'COLEÇÃO DINASTIA CHINESA',
            searchPlaceholder: 'Buscar na coleção...',
            defaultType: 'All',
            defaultCountry: 'China',
            defaultGenre: 'Historical',
        };
    }

    if (pathname === '/schedule') {
        return {
            title: 'Cronograma de Lançamentos',
            subtitle: 'Todas as séries em andamento sendo traduzidas e lançadas.',
            eyebrow: 'EM LANÇAMENTO • CRONOGRAMA',
            searchPlaceholder: 'Buscar no Cronograma...',
            defaultType: 'All',
            defaultStatus: 'Em andamento',
            isSchedule: true,
        };
    }

    if (pathname === '/coming-soon') {
        return {
            title: 'Em Breve no HuaPlay',
            subtitle: 'Próximos lançamentos e dramas em andamento.',
            eyebrow: 'EM BREVE NO HUAPLAY',
            searchPlaceholder: 'Buscar lançamentos...',
            defaultType: 'All',
            defaultStatus: 'Em andamento',
            isSchedule: true,
        };
    }

    return {
        title: 'Explorar Catálogo',
        subtitle: 'Busque e filtre entre todas as séries, filmes e donghuas do catálogo.',
        eyebrow: 'DESTAQUE DO CATÁLOGO',
        searchPlaceholder: 'Buscar por título...',
        defaultType: 'All',
    };
}

function pickSpotlightCandidates(list: Series[]): Series[] {
    if (!list.length) return [];
    const scored = [...list].sort((a, b) => {
        const aBanner = a.banner_image && a.banner_image.trim() ? 1 : 0;
        const bBanner = b.banner_image && b.banner_image.trim() ? 1 : 0;
        if (bBanner !== aBanner) return bBanner - aBanner;

        const aFeat = a.is_featured ? 1 : 0;
        const bFeat = b.is_featured ? 1 : 0;
        if (bFeat !== aFeat) return bFeat - aFeat;

        const viewsDiff = (b.views_count || 0) - (a.views_count || 0);
        if (viewsDiff !== 0) return viewsDiff;

        return (b.release_year || 0) - (a.release_year || 0);
    });
    return scored.slice(0, 4);
}

function buildPaginationPages(current: number, total: number): Array<number | '...'> {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: Array<number | '...'> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i += 1) {
        pages.push(i);
    }
    if (end < total - 1) pages.push('...');
    pages.push(total);
    return pages;
}

export default function CategoryExplore() {
    const { category, tag, collection } = useParams<{
        category?: string;
        tag?: string;
        collection?: string;
    }>();
    const location = useLocation();
    const { openModal } = useModal();
    const { uid, currentProfile, isAuthenticated, myListIds, updateLists } = useAuth();
    const { addToast } = useToast();

    const meta = useMemo(
        () => getRouteMetadata(location.pathname, category, tag, collection),
        [location.pathname, category, tag, collection]
    );

    const catalogBarRef = useRef<HTMLDivElement>(null);

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string>(meta.defaultType || 'All');
    const [selectedCountry, setSelectedCountry] = useState<string>(meta.defaultCountry || 'All');
    const [selectedStatus, setSelectedStatus] = useState<string>(meta.defaultStatus || 'All');
    const [selectedGenre, setSelectedGenre] = useState<string>(meta.defaultGenre || 'All');
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [sortBy, setSortBy] = useState<SortOption>('default');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    // Data state
    const [items, setItems] = useState<Series[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const LIMIT = 36;

    // Spotlight state
    const [spotlightPool, setSpotlightPool] = useState<Series[]>([]);
    const [spotlightIndex, setSpotlightIndex] = useState<number>(0);
    const [spotlightInList, setSpotlightInList] = useState<boolean>(false);
    const [spotlightSaving, setSpotlightSaving] = useState<boolean>(false);

    // Debounce search query by 300ms (only resets page when query actually changes)
    useEffect(() => {
        if (searchQuery === debouncedSearchQuery) return;
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, debouncedSearchQuery]);

    // Reset filters & spotlight when route changes
    useEffect(() => {
        setSelectedType(meta.defaultType || 'All');
        setSelectedCountry(meta.defaultCountry || 'All');
        setSelectedStatus(meta.defaultStatus || 'All');
        setSelectedGenre(meta.defaultGenre || 'All');
        setSelectedYear('All');
        setSortBy('default');
        setSearchQuery('');
        setDebouncedSearchQuery('');
        setPage(1);
        setSpotlightPool([]);
        setSpotlightIndex(0);
        setMobileDrawerOpen(false);
    }, [meta]);

    // Lock body scroll when mobile filter drawer is open
    useEffect(() => {
        if (!mobileDrawerOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileDrawerOpen]);

    // Fetch filtered page from backend API
    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        setLoading(true);

        const params: SeriesQuery = {
            skip: (page - 1) * LIMIT,
            limit: LIMIT,
        };

        if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();
        if (selectedType !== 'All') params.type = selectedType;
        if (selectedCountry !== 'All') params.country = selectedCountry;
        if (selectedStatus !== 'All') params.status = selectedStatus;
        if (selectedGenre !== 'All') params.genre = selectedGenre;
        if (selectedYear !== 'All') params.release_year = Number(selectedYear);

        getSeriesPage(params, controller.signal)
            .then(({ items: data, total }) => {
                if (!isMounted) return;
                setItems(data);
                setTotalCount(total);
                setLoading(false);

                if (page === 1 && !debouncedSearchQuery.trim() && data.length > 0) {
                    setSpotlightPool(pickSpotlightCandidates(data));
                    setSpotlightIndex(0);
                }
            })
            .catch((err: any) => {
                if (
                    err?.name === 'CanceledError' ||
                    err?.name === 'AbortError' ||
                    err?.code === 'ERR_CANCELED'
                ) {
                    return;
                }
                if (isMounted) {
                    console.error('Error fetching filtered series:', err);
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [
        selectedType,
        selectedCountry,
        selectedStatus,
        selectedGenre,
        selectedYear,
        debouncedSearchQuery,
        page,
    ]);

    const sortedItems = useMemo(() => {
        if (sortBy === 'default') return items;
        const copy = [...items];
        if (sortBy === 'year_desc') {
            copy.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
        } else if (sortBy === 'popular') {
            copy.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        } else if (sortBy === 'title_asc') {
            copy.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
        }
        return copy;
    }, [items, sortBy]);

    const activeSpotlight = spotlightPool[spotlightIndex] ?? spotlightPool[0] ?? null;

    useEffect(() => {
        if (!activeSpotlight) {
            setSpotlightInList(false);
            return;
        }
        setSpotlightInList(Boolean(myListIds?.includes(activeSpotlight.id)));
    }, [myListIds, activeSpotlight]);

    const handleToggleSpotlightList = async () => {
        if (!activeSpotlight) return;
        if (!isAuthenticated || !uid || !currentProfile) {
            addToast('Faça login para adicionar à sua lista', 'error');
            return;
        }
        if (spotlightSaving) return;

        const prev = spotlightInList;
        setSpotlightInList(!prev);
        setSpotlightSaving(true);

        try {
            if (prev) {
                await removeFromMyList(uid, currentProfile.id, activeSpotlight.id);
                addToast('Removido da sua lista', 'success');
            } else {
                await addToMyList(uid, currentProfile.id, activeSpotlight.id);
                addToast('Adicionado à sua lista', 'success');
            }
            updateLists();
        } catch {
            setSpotlightInList(prev);
            addToast('Erro ao atualizar sua lista', 'error');
        } finally {
            setSpotlightSaving(false);
        }
    };

    // Active filter chips
    const activeChips = useMemo(() => {
        const chips: { key: string; label: string; onRemove: () => void }[] = [];
        if (selectedType !== 'All') {
            const label = TYPES.find((t) => t.value === selectedType)?.label ?? selectedType;
            chips.push({
                key: 'type',
                label: `Tipo: ${label}`,
                onRemove: () => {
                    setSelectedType('All');
                    setPage(1);
                },
            });
        }
        if (selectedCountry !== 'All') {
            const label = COUNTRIES.find((c) => c.value === selectedCountry)?.label ?? selectedCountry;
            chips.push({
                key: 'country',
                label: `País: ${label}`,
                onRemove: () => {
                    setSelectedCountry('All');
                    setPage(1);
                },
            });
        }
        if (selectedStatus !== 'All') {
            const label = STATUSES.find((s) => s.value === selectedStatus)?.label ?? selectedStatus;
            chips.push({
                key: 'status',
                label: `Status: ${label}`,
                onRemove: () => {
                    setSelectedStatus('All');
                    setPage(1);
                },
            });
        }
        if (selectedGenre !== 'All') {
            chips.push({
                key: 'genre',
                label: `Gênero: ${selectedGenre}`,
                onRemove: () => {
                    setSelectedGenre('All');
                    setPage(1);
                },
            });
        }
        if (selectedYear !== 'All') {
            chips.push({
                key: 'year',
                label: `Ano: ${selectedYear}`,
                onRemove: () => {
                    setSelectedYear('All');
                    setPage(1);
                },
            });
        }
        if (searchQuery.trim()) {
            chips.push({
                key: 'search',
                label: `Busca: "${searchQuery.trim()}"`,
                onRemove: () => {
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                    setPage(1);
                },
            });
        }
        return chips;
    }, [selectedType, selectedCountry, selectedStatus, selectedGenre, selectedYear, searchQuery]);

    const activeFilterCount = activeChips.filter((c) => c.key !== 'search').length;
    const hasActiveFilters = activeChips.length > 0 || sortBy !== 'default';

    const resetFilters = () => {
        setSelectedType('All');
        setSelectedCountry('All');
        setSelectedStatus('All');
        setSelectedGenre('All');
        setSelectedYear('All');
        setSortBy('default');
        setSearchQuery('');
        setDebouncedSearchQuery('');
        setPage(1);
    };

    const handlePageChange = (nextPage: number) => {
        if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
        setPage(nextPage);
        catalogBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
    const pageNumbers = useMemo(() => buildPaginationPages(page, totalPages), [page, totalPages]);
    const rangeStart = totalCount === 0 ? 0 : (page - 1) * LIMIT + 1;
    const rangeEnd = Math.min(totalCount, (page - 1) * LIMIT + items.length);

    const isSearching = debouncedSearchQuery.trim().length > 0;
    const spotlightGenres = parseGenres(activeSpotlight?.genre);
    const spotlightBackdrop = activeSpotlight
        ? getOptimizedImageUrl(
              activeSpotlight.banner_image || activeSpotlight.cover_image,
              'backdrop'
          )
        : '';

    return (
        <div className="min-h-screen bg-background pt-[calc(5.25rem+env(safe-area-inset-top,0px))] pb-28 md:pb-20 text-white">
            {/* Ambient subtle top gold aura */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.10),transparent_68%)]"
            />

            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Breadcrumb & Category Title Row */}
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 pt-2">
                    <div>
                        <nav
                            aria-label="Breadcrumb"
                            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400"
                        >
                            <Link to="/" className="hover:text-primary transition-colors">
                                Início
                            </Link>
                            <ChevronRight className="h-3 w-3 text-gray-600" />
                            <span className="text-primary">{meta.title}</span>
                        </nav>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                {meta.title}
                            </h1>
                            {!loading && (
                                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                    {totalCount} {totalCount === 1 ? 'obra' : 'obras'}
                                </span>
                            )}
                        </div>
                        {isSearching && (
                            <p className="mt-1 text-xs sm:text-sm text-gray-400">
                                Resultados filtrados para &ldquo;{debouncedSearchQuery.trim()}&rdquo;
                            </p>
                        )}
                    </div>
                    {!isSearching && (
                        <p className="hidden md:block max-w-md text-right text-xs text-gray-400">
                            {meta.subtitle}
                        </p>
                    )}
                </div>

                {/* Magazine Spotlight Banner (hidden while actively searching so results jump to top) */}
                {!isSearching && (
                    <section aria-label="Destaque da categoria" className="mb-6">
                        {loading && !activeSpotlight ? (
                            <div className="h-[300px] sm:h-[360px] lg:h-[395px] w-full rounded-3xl border border-white/10 bg-white/[0.04] animate-pulse" />
                        ) : activeSpotlight ? (
                            <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-[#0c0c10] shadow-[0_24px_70px_rgba(0,0,0,0.65)] min-h-[310px] sm:min-h-[365px] lg:min-h-[400px] flex items-end sm:items-center">
                                {/* Animated Backdrop */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeSpotlight.id}
                                        initial={{ opacity: 0, scale: 1.03 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.45, ease: 'easeOut' }}
                                        className="absolute inset-0"
                                    >
                                        <img
                                            src={spotlightBackdrop}
                                            alt={activeSpotlight.title}
                                            className="h-full w-full object-cover object-center sm:object-[65%_25%]"
                                        />
                                        {/* Desktop Left-to-Right Cinematic Scrim */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#07070a] via-[#07070a]/85 sm:via-[#07070a]/75 via-55% to-transparent" />
                                        {/* Bottom Vignette (especially helpful on Mobile) */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/45 to-transparent" />
                                        {/* Subtle warm gold glaze */}
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(212,175,55,0.14),transparent_50%)]" />
                                    </motion.div>
                                </AnimatePresence>

                                {/* Foreground Content */}
                                <div className="relative z-10 w-full p-5 sm:p-8 lg:p-11">
                                    <div className="max-w-2xl">
                                        {/* Eyebrow */}
                                        <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                                            {meta.isSchedule || activeSpotlight.status === 'Em andamento' ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 text-emerald-300 tracking-wider">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    Em Lançamento
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    {meta.eyebrow}
                                                </span>
                                            )}
                                            {activeSpotlight.release_year ? (
                                                <span className="text-gray-300/80">
                                                    • {activeSpotlight.release_year}
                                                </span>
                                            ) : null}
                                        </div>

                                        {/* Spotlight Title */}
                                        <h2 className="font-display text-2xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.08] tracking-tight text-white drop-shadow-md">
                                            {activeSpotlight.title}
                                        </h2>

                                        {/* Metadata Strip */}
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-gray-200">
                                            {activeSpotlight.country ? (
                                                <span>{formatCountryPt(activeSpotlight.country)}</span>
                                            ) : null}
                                            {activeSpotlight.type ? (
                                                <>
                                                    <span className="text-white/30">•</span>
                                                    <span className="text-primary/95">
                                                        {formatTypePt(activeSpotlight.type)}
                                                    </span>
                                                </>
                                            ) : null}
                                            {activeSpotlight.status ? (
                                                <>
                                                    <span className="text-white/30">•</span>
                                                    <span
                                                        className={
                                                            activeSpotlight.status === 'Em andamento'
                                                                ? 'text-emerald-300'
                                                                : 'text-gray-300'
                                                        }
                                                    >
                                                        {activeSpotlight.status}
                                                    </span>
                                                </>
                                            ) : null}
                                            {spotlightGenres.slice(0, 3).map((g) => (
                                                <span
                                                    key={g}
                                                    className="hidden sm:inline-flex rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-gray-200 backdrop-blur-md"
                                                >
                                                    {g}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Short Synopsis */}
                                        {activeSpotlight.description ? (
                                            <p className="mt-3 max-w-xl text-xs sm:text-sm text-gray-300/95 leading-relaxed line-clamp-2 sm:line-clamp-3">
                                                {activeSpotlight.description}
                                            </p>
                                        ) : null}

                                        {/* Action CTAs */}
                                        <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
                                            <Link
                                                to={`/series/${activeSpotlight.slug || activeSpotlight.id}`}
                                                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E8C868] to-[#D4AF37] px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-black shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95"
                                            >
                                                <Play className="h-4 w-4 fill-black" />
                                                Assistir Agora
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={handleToggleSpotlightList}
                                                className={`inline-flex items-center gap-2 rounded-full border px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold backdrop-blur-md transition-all active:scale-95 ${
                                                    spotlightInList
                                                        ? 'border-primary/60 bg-primary/15 text-primary hover:bg-primary/25'
                                                        : 'border-white/20 bg-white/[0.08] text-white hover:border-white/40 hover:bg-white/[0.14]'
                                                }`}
                                            >
                                                {spotlightInList ? (
                                                    <>
                                                        <Check className="h-4 w-4" />
                                                        Na Minha Lista
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="h-4 w-4" />
                                                        Minha Lista
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => openModal(activeSpotlight)}
                                                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-200 backdrop-blur-md hover:border-white/35 hover:text-white transition-all"
                                            >
                                                <Info className="h-4 w-4" />
                                                Detalhes
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Subtle Carousel Controls (when multiple spotlight candidates exist) */}
                                {spotlightPool.length > 1 && (
                                    <div className="absolute right-5 bottom-5 z-20 hidden sm:flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 mr-1">
                                            {spotlightPool.map((cand, idx) => (
                                                <button
                                                    key={cand.id}
                                                    type="button"
                                                    onClick={() => setSpotlightIndex(idx)}
                                                    aria-label={`Ver destaque ${idx + 1}: ${cand.title}`}
                                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                                        idx === spotlightIndex
                                                            ? 'w-6 bg-primary'
                                                            : 'w-1.5 bg-white/30 hover:bg-white/60'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSpotlightIndex(
                                                    (i) => (i - 1 + spotlightPool.length) % spotlightPool.length
                                                )
                                            }
                                            aria-label="Destaque anterior"
                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 backdrop-blur-md hover:border-primary/60 hover:text-primary transition-colors"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSpotlightIndex((i) => (i + 1) % spotlightPool.length)
                                            }
                                            aria-label="Próximo destaque"
                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 backdrop-blur-md hover:border-primary/60 hover:text-primary transition-colors"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </section>
                )}

                {/* Anchor for pagination smooth scroll */}
                <div ref={catalogBarRef} className="scroll-mt-24" />

                {/* Floating Frosted Glass Filter Bar (Sticky on Scroll) */}
                <div className="sticky top-[calc(5rem+env(safe-area-inset-top,0px)+0.5rem)] z-30 mb-5">
                    <div className="rounded-2xl border border-white/12 bg-[#0e0e13]/85 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.58)] supports-[not_(backdrop-filter:blur(1px))]:bg-[#0e0e13]/95">
                        {/* Desktop Floating Glass Toolbar */}
                        <div className="hidden md:flex flex-wrap lg:flex-nowrap items-center gap-2 p-2.5">
                            {/* Search Input */}
                            <div className="relative flex-1 min-w-[180px] lg:max-w-[260px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={meta.searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-black/45 py-2 pl-9 pr-8 text-xs text-white placeholder-gray-500 focus:border-primary/70 focus:outline-none transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setDebouncedSearchQuery('');
                                            setPage(1);
                                        }}
                                        aria-label="Limpar busca"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="hidden lg:block h-6 w-px bg-white/10 shrink-0" />

                            {/* Compact Pill Dropdowns */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {/* Type */}
                                <FilterSelectPill
                                    prefix="Tipo"
                                    value={selectedType}
                                    isActive={selectedType !== 'All'}
                                    onChange={(val) => {
                                        setSelectedType(val);
                                        setPage(1);
                                    }}
                                    options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
                                />

                                {/* Country */}
                                <FilterSelectPill
                                    prefix="País"
                                    value={selectedCountry}
                                    isActive={selectedCountry !== 'All'}
                                    onChange={(val) => {
                                        setSelectedCountry(val);
                                        setPage(1);
                                    }}
                                    options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
                                />

                                {/* Status */}
                                <FilterSelectPill
                                    prefix="Status"
                                    value={selectedStatus}
                                    isActive={selectedStatus !== 'All'}
                                    onChange={(val) => {
                                        setSelectedStatus(val);
                                        setPage(1);
                                    }}
                                    options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                                />

                                {/* Genre */}
                                <FilterSelectPill
                                    prefix="Gênero"
                                    value={selectedGenre}
                                    isActive={selectedGenre !== 'All'}
                                    onChange={(val) => {
                                        setSelectedGenre(val);
                                        setPage(1);
                                    }}
                                    options={GENRES.map((g) => ({
                                        value: g,
                                        label: g === 'All' ? 'Todos' : g,
                                    }))}
                                />

                                {/* Year */}
                                <FilterSelectPill
                                    prefix="Ano"
                                    value={selectedYear}
                                    isActive={selectedYear !== 'All'}
                                    onChange={(val) => {
                                        setSelectedYear(val);
                                        setPage(1);
                                    }}
                                    options={YEARS.map((y) => ({
                                        value: y,
                                        label: y === 'All' ? 'Todos' : y,
                                    }))}
                                />
                            </div>

                            {/* Right Controls: Sort + Grid/List + Count */}
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                                <label
                                    className={`relative inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer select-none transition-colors ${
                                        sortBy !== 'default'
                                            ? 'border-primary/50 bg-primary/12 text-primary'
                                            : 'border-white/10 bg-white/[0.04] text-gray-200 hover:border-white/25 hover:text-white'
                                    }`}
                                >
                                    <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 opacity-75 shrink-0" />
                                    <span className="font-semibold whitespace-nowrap">
                                        {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Padrão'}
                                    </span>
                                    <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70 shrink-0" />
                                    <select
                                        aria-label="Ordenar resultados"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    >
                                        {SORT_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div
                                    role="group"
                                    aria-label="Modo de visualização"
                                    className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        title="Visualização em grade"
                                        aria-label="Visualização em grade"
                                        className={`rounded-lg p-1.5 transition-colors ${
                                            viewMode === 'grid'
                                                ? 'bg-primary text-black'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        title="Visualização em lista"
                                        aria-label="Visualização em lista"
                                        className={`rounded-lg p-1.5 transition-colors ${
                                            viewMode === 'list'
                                                ? 'bg-primary text-black'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <LayoutList className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {!loading && (
                                    <span className="hidden xl:inline-block pl-1 text-xs font-semibold text-gray-400 whitespace-nowrap">
                                        {totalCount} obras
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Mobile Floating Glass Bar */}
                        <div className="flex md:hidden items-center gap-2 p-2">
                            <div className="relative flex-1 min-w-0">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={meta.searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-black/50 py-2 pl-9 pr-8 text-xs text-white placeholder-gray-500 focus:border-primary/70 focus:outline-none"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setDebouncedSearchQuery('');
                                            setPage(1);
                                        }}
                                        aria-label="Limpar busca"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setMobileDrawerOpen(true)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors shrink-0 ${
                                    activeFilterCount > 0
                                        ? 'border-primary/60 bg-primary/15 text-primary'
                                        : 'border-white/15 bg-white/[0.06] text-white'
                                }`}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Filtros
                                {activeFilterCount > 0 && (
                                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-black">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
                                aria-label="Alternar visualização Grade ou Lista"
                                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-gray-200"
                            >
                                {viewMode === 'grid' ? (
                                    <LayoutList className="h-4 w-4" />
                                ) : (
                                    <LayoutGrid className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Filter Chips & Result Range Row */}
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        {!loading && totalCount > 0 && (
                            <span className="text-xs font-medium text-gray-400 mr-1">
                                Mostrando{' '}
                                <strong className="text-gray-200">
                                    {rangeStart}–{rangeEnd}
                                </strong>{' '}
                                de <strong className="text-gray-200">{totalCount}</strong> obras
                            </span>
                        )}

                        {activeChips.map((chip) => (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={chip.onRemove}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                            >
                                {chip.label}
                                <X className="h-3 w-3" />
                            </button>
                        ))}
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-primary transition-colors"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Limpar tudo
                        </button>
                    )}
                </div>

                {/* Catalog Results Grid / List */}
                {loading ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                            {Array.from({ length: 18 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="aspect-[2/3] w-full rounded-2xl border border-white/5 bg-white/[0.04] animate-pulse"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-32 w-full rounded-2xl border border-white/5 bg-white/[0.04] animate-pulse"
                                />
                            ))}
                        </div>
                    )
                ) : sortedItems.length === 0 ? (
                    <div className="py-20 px-6 text-center rounded-3xl border border-white/10 bg-[#0e0e13]/70">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            <Film className="h-7 w-7 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Nenhum conteúdo encontrado</h3>
                        <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-400">
                            Tente remover alguns filtros ou buscar por outro título.
                        </p>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E8C868] to-[#D4AF37] px-5 py-2.5 text-xs font-bold text-black hover:brightness-110 transition-all"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Limpar Filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <motion.div
                            key={`${viewMode}-${page}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                            className={
                                viewMode === 'grid'
                                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5'
                                    : 'flex flex-col gap-3'
                            }
                        >
                            {sortedItems.map((item) => (
                                <CatalogCard
                                    key={item.id}
                                    item={item}
                                    viewMode={viewMode}
                                    onOpenModal={openModal}
                                />
                            ))}
                        </motion.div>

                        {/* Numbered Pagination */}
                        {totalPages > 1 && (
                            <nav
                                aria-label="Paginação do catálogo"
                                className="mt-12 flex items-center justify-center"
                            >
                                <div className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-[#0e0e13]/85 p-1.5 backdrop-blur-md shadow-xl">
                                    <button
                                        type="button"
                                        disabled={page === 1}
                                        onClick={() => handlePageChange(page - 1)}
                                        aria-label="Página anterior"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>

                                    {pageNumbers.map((entry, idx) =>
                                        entry === '...' ? (
                                            <span
                                                key={`ellipsis-${idx}`}
                                                className="px-2 text-xs font-semibold text-gray-500 select-none"
                                            >
                                                ...
                                            </span>
                                        ) : (
                                            <button
                                                key={entry}
                                                type="button"
                                                onClick={() => handlePageChange(entry)}
                                                aria-current={entry === page ? 'page' : undefined}
                                                className={`h-9 min-w-9 rounded-xl px-2.5 text-xs font-bold transition-all ${
                                                    entry === page
                                                        ? 'bg-gradient-to-r from-[#E8C868] to-[#D4AF37] text-black shadow-md'
                                                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {entry}
                                            </button>
                                        )
                                    )}

                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={() => handlePageChange(page + 1)}
                                        aria-label="Próxima página"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </nav>
                        )}
                    </>
                )}
            </div>

            {/* Mobile Filter Bottom-Sheet Drawer */}
            <AnimatePresence>
                {mobileDrawerOpen && (
                    <div className="fixed inset-0 z-[70] md:hidden flex items-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileDrawerOpen(false)}
                            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className="relative z-10 flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t border-white/15 bg-[#101015] shadow-2xl"
                        >
                            {/* Drag Handle & Header */}
                            <div className="flex flex-col items-center border-b border-white/10 px-5 pt-3 pb-3.5">
                                <div className="mb-3 h-1 w-10 rounded-full bg-white/20" />
                                <div className="flex w-full items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <SlidersHorizontal className="h-4 w-4 text-primary" />
                                        <h3 className="text-sm font-bold text-white">
                                            Filtros & Ordenação
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMobileDrawerOpen(false)}
                                        aria-label="Fechar filtros"
                                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-gray-300"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Filter Groups */}
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                                {/* Type */}
                                <MobilePillGroup
                                    label="Tipo"
                                    value={selectedType}
                                    options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
                                    onSelect={(val) => {
                                        setSelectedType(val);
                                        setPage(1);
                                    }}
                                />

                                {/* Status */}
                                <MobilePillGroup
                                    label="Status"
                                    value={selectedStatus}
                                    options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                                    onSelect={(val) => {
                                        setSelectedStatus(val);
                                        setPage(1);
                                    }}
                                />

                                {/* Country */}
                                <MobilePillGroup
                                    label="País"
                                    value={selectedCountry}
                                    options={COUNTRIES.map((c) => ({
                                        value: c.value,
                                        label: c.value === 'All' ? 'Todos' : c.fullLabel,
                                    }))}
                                    onSelect={(val) => {
                                        setSelectedCountry(val);
                                        setPage(1);
                                    }}
                                />

                                {/* Year */}
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                        Ano de Lançamento
                                    </p>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => {
                                            setSelectedYear(e.target.value);
                                            setPage(1);
                                        }}
                                        className="w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-xs font-medium text-white focus:border-primary focus:outline-none"
                                    >
                                        {YEARS.map((y) => (
                                            <option key={y} value={y} className="bg-neutral-900">
                                                {y === 'All' ? 'Todos os Anos' : y}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Genre */}
                                <MobilePillGroup
                                    label="Gênero / Tag"
                                    value={selectedGenre}
                                    options={GENRES.map((g) => ({
                                        value: g,
                                        label: g === 'All' ? 'Todos' : g,
                                    }))}
                                    onSelect={(val) => {
                                        setSelectedGenre(val);
                                        setPage(1);
                                    }}
                                />

                                {/* Sort */}
                                <MobilePillGroup
                                    label="Ordenar página por"
                                    value={sortBy}
                                    options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                                    onSelect={(val) => setSortBy(val as SortOption)}
                                />
                            </div>

                            {/* Sticky Drawer Footer */}
                            <div className="flex items-center gap-3 border-t border-white/10 bg-[#0d0d11] px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-gray-300"
                                >
                                    Limpar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileDrawerOpen(false)}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-[#E8C868] to-[#D4AF37] py-2.5 text-xs font-bold text-black shadow-lg"
                                >
                                    Ver {loading ? '...' : `${totalCount} resultados`}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface FilterSelectPillProps {
    prefix: string;
    value: string;
    isActive: boolean;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}

function FilterSelectPill({
    prefix,
    value,
    isActive,
    options,
    onChange,
}: FilterSelectPillProps) {
    const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

    return (
        <label
            className={`relative inline-flex items-center rounded-xl border px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                isActive
                    ? 'border-primary/50 bg-primary/12 text-primary'
                    : 'border-white/10 bg-white/[0.04] text-gray-300 hover:border-white/25 hover:text-white'
            }`}
        >
            <span className="mr-1 text-gray-400 font-medium">{prefix}:</span>
            <span className="font-semibold max-w-[110px] truncate">{selectedLabel}</span>
            <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70 shrink-0" />
            <select
                aria-label={`Filtrar por ${prefix}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

interface MobilePillGroupProps {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onSelect: (value: string) => void;
}

function MobilePillGroup({ label, value, options, onSelect }: MobilePillGroupProps) {
    return (
        <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {label}
            </p>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const active = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onSelect(opt.value)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                                active
                                    ? 'border-primary bg-primary text-black'
                                    : 'border-white/12 bg-white/[0.04] text-gray-300'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
