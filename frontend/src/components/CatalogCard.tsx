import { memo, useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Info, Play, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { addToMyList, removeFromMyList } from '../services/userData';
import type { Series } from '../types/models';
import { getOptimizedImageUrl } from '../utils/image';

const COUNTRY_PT_LABELS: Record<string, string> = {
    China: 'China',
    'South Korea': 'Coreia do Sul',
    Thailand: 'Tailândia',
    Japan: 'Japão',
    Taiwan: 'Taiwan',
    Philippines: 'Filipinas',
    Vietnam: 'Vietnã',
    Turkey: 'Turquia',
};

const TYPE_PT_LABELS: Record<string, string> = {
    Series: 'Série',
    Drama: 'Drama',
    Movie: 'Filme',
    Donghua: 'Donghua',
    Anime: 'Anime',
};

export function formatCountryPt(country?: string | null): string {
    if (!country) return '';
    return COUNTRY_PT_LABELS[country] ?? country;
}

export function formatTypePt(type?: string | null): string {
    if (!type) return '';
    return TYPE_PT_LABELS[type] ?? type;
}

export function parseGenres(genre?: string | null): string[] {
    if (!genre) return [];
    return genre
        .split(/[,/|]/)
        .map((g) => g.trim())
        .filter(Boolean);
}

interface CatalogCardProps {
    item: Series;
    viewMode: 'grid' | 'list';
    onOpenModal: (series: Series) => void;
}

function CatalogCard({ item, viewMode, onOpenModal }: CatalogCardProps) {
    const { uid, currentProfile, isAuthenticated, myListIds, updateLists } = useAuth();
    const { addToast } = useToast();

    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isInList, setIsInList] = useState(false);
    const [savingList, setSavingList] = useState(false);

    useEffect(() => {
        setIsInList(Boolean(myListIds?.includes(item.id)));
    }, [myListIds, item.id]);

    const detailPath = `/series/${item.slug || item.id}`;
    const posterSrc = imageError
        ? getOptimizedImageUrl(item.banner_image, 'poster')
        : getOptimizedImageUrl(item.cover_image, 'poster');

    const genres = parseGenres(item.genre);
    const primaryGenre = genres[0] ?? '';
    const countryLabel = formatCountryPt(item.country);
    const typeLabel = formatTypePt(item.type);
    const isOngoing = item.status === 'Em andamento';
    const currentYear = new Date().getFullYear();
    const isRecent = Boolean(item.release_year && item.release_year >= currentYear - 1);

    const handleToggleList = async (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated || !uid || !currentProfile) {
            addToast('Faça login para adicionar à sua lista', 'error');
            return;
        }
        if (savingList) return;

        const prev = isInList;
        setIsInList(!prev);
        setSavingList(true);

        try {
            if (prev) {
                await removeFromMyList(uid, currentProfile.id, item.id);
                addToast('Removido da sua lista', 'success');
            } else {
                await addToMyList(uid, currentProfile.id, item.id);
                addToast('Adicionado à sua lista', 'success');
            }
            updateLists();
        } catch {
            setIsInList(prev);
            addToast('Erro ao atualizar sua lista', 'error');
        } finally {
            setSavingList(false);
        }
    };

    const handleOpenModalClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenModal(item);
    };

    if (viewMode === 'list') {
        return (
            <Link
                to={detailPath}
                className="group flex items-center gap-3.5 sm:gap-5 rounded-2xl border border-white/[0.08] bg-[#101014]/85 p-3 sm:p-4 transition-all duration-300 hover:border-primary/45 hover:bg-[#14141a] hover:shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
            >
                {/* Poster Thumbnail */}
                <div className="relative w-20 sm:w-24 aspect-[2/3] shrink-0 overflow-hidden rounded-xl bg-neutral-900 border border-white/10">
                    {!imageLoaded && (
                        <div className="absolute inset-0 bg-neutral-900 animate-pulse" />
                    )}
                    <img
                        src={posterSrc}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setImageLoaded(true)}
                        onError={() => {
                            setImageError(true);
                            setImageLoaded(true);
                        }}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {isOngoing && (
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 backdrop-blur-md border border-emerald-400/25">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Ativo
                        </span>
                    )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-400">
                        {isOngoing ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Em andamento
                            </span>
                        ) : (
                            <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-gray-300">
                                Concluído
                            </span>
                        )}
                        {item.release_year ? <span>{item.release_year}</span> : null}
                        {countryLabel ? (
                            <>
                                <span className="text-white/25">•</span>
                                <span>{countryLabel}</span>
                            </>
                        ) : null}
                        {typeLabel ? (
                            <>
                                <span className="text-white/25">•</span>
                                <span className="text-primary/90">{typeLabel}</span>
                            </>
                        ) : null}
                    </div>

                    <h3 className="mt-1.5 text-base sm:text-lg font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                        {item.title}
                    </h3>

                    {item.description ? (
                        <p className="mt-1 text-xs sm:text-sm text-gray-400 line-clamp-2 leading-relaxed">
                            {item.description}
                        </p>
                    ) : null}

                    {genres.length > 0 && (
                        <div className="mt-2.5 hidden sm:flex flex-wrap gap-1.5">
                            {genres.slice(0, 4).map((g) => (
                                <span
                                    key={g}
                                    className="rounded-full bg-white/[0.05] border border-white/10 px-2.5 py-0.5 text-[11px] text-gray-300"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#E5C158] to-[#D4AF37] px-4 py-2 text-xs font-bold text-black shadow-md transition-transform group-hover:scale-[1.03]">
                        <Play className="h-3.5 w-3.5 fill-black" />
                        Assistir
                    </span>
                    <button
                        type="button"
                        onClick={handleToggleList}
                        title={isInList ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
                        aria-label={isInList ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                            isInList
                                ? 'border-primary/60 bg-primary/15 text-primary'
                                : 'border-white/15 bg-white/[0.05] text-gray-300 hover:border-white/40 hover:text-white'
                        }`}
                    >
                        {isInList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenModalClick}
                        title="Detalhes rápidos"
                        aria-label="Detalhes rápidos"
                        className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-gray-300 hover:border-white/40 hover:text-white transition-all"
                    >
                        <Info className="h-4 w-4" />
                    </button>
                </div>
            </Link>
        );
    }

    // Magazine Grid Poster Card
    return (
        <Link
            to={detailPath}
            className="group relative block w-full aspect-[2/3] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#121216] shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_18px_40px_rgba(212,175,55,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            {/* Skeleton while loading */}
            {!imageLoaded && (
                <div className="absolute inset-0 bg-neutral-900 animate-pulse" />
            )}

            {/* Poster Image */}
            <img
                src={posterSrc}
                alt={item.title}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                    setImageError(true);
                    setImageLoaded(true);
                }}
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />

            {/* Top Left Status / Release Badge */}
            <div className="absolute top-2.5 left-2.5 right-12 z-10 flex flex-wrap items-center gap-1.5 pointer-events-none">
                {isOngoing ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/75 border border-emerald-400/35 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-md shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Em andamento
                    </span>
                ) : isRecent ? (
                    <span className="inline-flex items-center rounded-full bg-black/75 border border-primary/40 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary backdrop-blur-md shadow-sm">
                        {item.release_year}
                    </span>
                ) : typeLabel && typeLabel !== 'Série' ? (
                    <span className="inline-flex items-center rounded-full bg-black/70 border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-gray-200 backdrop-blur-md">
                        {typeLabel}
                    </span>
                ) : null}
            </div>

            {/* Top Right Quick Actions */}
            <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1.5">
                <button
                    type="button"
                    onClick={handleToggleList}
                    title={isInList ? 'Na Minha Lista' : 'Adicionar à Minha Lista'}
                    aria-label={isInList ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                        isInList
                            ? 'border-primary/70 bg-black/80 text-primary opacity-100'
                            : 'border-white/20 bg-black/65 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:border-primary hover:text-primary'
                    }`}
                >
                    {isInList ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
                <button
                    type="button"
                    onClick={handleOpenModalClick}
                    title="Detalhes rápidos"
                    aria-label="Detalhes rápidos"
                    className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white opacity-0 group-hover:opacity-100 hover:border-primary hover:text-primary backdrop-blur-md transition-all duration-200"
                >
                    <Info className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Center Gold Play Medallion (Desktop hover) */}
            <div className="pointer-events-none absolute inset-0 z-10 hidden sm:flex items-center justify-center">
                <div className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-gradient-to-br from-[#F1D279] to-[#D4AF37] text-black opacity-0 shadow-[0_0_28px_rgba(212,175,55,0.55)] transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                    <Play className="h-5 w-5 fill-black pl-0.5" />
                </div>
            </div>

            {/* Bottom Integrated Magazine Metadata Scrim */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/85 via-55% to-transparent px-3 pt-16 pb-3">
                <h3 className="text-[13px] sm:text-sm font-bold text-white leading-snug line-clamp-2 drop-shadow-sm transition-colors group-hover:text-primary">
                    {item.title}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-300/90 truncate">
                    {item.release_year ? <span>{item.release_year}</span> : null}
                    {countryLabel ? (
                        <>
                            {item.release_year ? <span className="text-white/30">•</span> : null}
                            <span className="truncate">{countryLabel}</span>
                        </>
                    ) : null}
                    {primaryGenre ? (
                        <>
                            {(item.release_year || countryLabel) ? <span className="text-white/30">•</span> : null}
                            <span className="truncate text-gray-400">{primaryGenre}</span>
                        </>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}

export default memo(CatalogCard);
