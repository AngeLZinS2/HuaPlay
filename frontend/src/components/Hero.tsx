import { useState, useEffect, lazy, Suspense } from 'react';
import { Play, Plus, Check, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { addToMyList, removeFromMyList } from '../services/userData';
import { useToast } from '../context/ToastContext';
import { getYouTubeVideoId } from '../utils/youtube';
import { getOptimizedImageUrl } from '../utils/image';
import { useHeroDeviceMode, type HeroDeviceMode } from '../hooks/useHeroDeviceMode';

const CompactHeroTrailer = lazy(() => import('./CompactHeroTrailer'));

export interface FeaturedSeries {
    id: number | string;
    title: string;
    slug?: string;
    type?: string;
    genre?: string;
    release_year?: number | string;
    status?: string;
    description?: string;
    cover_image?: string;
    banner_image?: string;
    trailer_url?: string;
    feature_type?: 'BANNER' | 'TRAILER' | string;
}

interface HeroProps {
    initialFeatured?: FeaturedSeries | null;
    featuredPromise?: Promise<FeaturedSeries | null> | null;
}

interface CompactHeroCardProps {
    featured: FeaturedSeries;
    heroMode: HeroDeviceMode;
    mobileTags: string[];
    mobilePlayLabel: string;
    isInList: boolean;
    onToggleList: () => void;
    onNavigate: () => void;
}

/**
 * Componente isolado do Cartão Compacto.
 * Recebe key única combinando modo + featured.id + trailer_url no parent, garantindo que
 * ao alternar o Fold ou trocar de conteúdo, o estado monte com player limpo e MUTED,
 * sem vazamento de estado e sem efeito tardio de setState.
 */
function CompactHeroCard({
    featured,
    heroMode,
    mobileTags,
    mobilePlayLabel,
    isInList,
    onToggleList,
    onNavigate,
}: CompactHeroCardProps) {
    const [isCompactMuted, setIsCompactMuted] = useState(true);
    const [compactTrailerPlaying, setCompactTrailerPlaying] = useState(false);
    const [compactTrailerFailed, setCompactTrailerFailed] = useState(false);
    const [compactTrailerReady, setCompactTrailerReady] = useState(false);

    useEffect(() => {
        if (heroMode !== 'tablet-fold') return;
        const timer = window.setTimeout(() => setCompactTrailerReady(true), 4000);
        return () => window.clearTimeout(timer);
    }, [heroMode]);

    const youtubeId = featured.trailer_url ? getYouTubeVideoId(featured.trailer_url) : null;
    const shouldMountCompactTrailer = Boolean(
        compactTrailerReady &&
        heroMode === 'tablet-fold' &&
        youtubeId &&
        featured.feature_type !== 'BANNER' &&
        !compactTrailerFailed
    );

    const compactImageSrc = heroMode === 'tablet-fold' && featured.banner_image
        ? getOptimizedImageUrl(featured.banner_image, 'backdrop')
        : getOptimizedImageUrl(featured.cover_image || featured.banner_image, 'poster');

    // Regra de altura do cartão:
    // Limite de altura SOMENTE no compacto quando largura < 768 (onde o bottomnav existe),
    // usando max-height de viewport disponível descontando 80px (header) + env(safe-top) + 68px (nav) + max(16px, env(safe-bottom)) + folga ~48px para o título da primeira fileira.
    // Em telas >= 768 (tablet/desktop), conserva o cartão atual sem alteração (md:max-h-[620px] e md:min-h-[460px]).
    // Para celulares paisagem < 768 (ex: 667x375), permite min-h-[220px] para caber no viewport sem corte.
    const cardHeightClass = heroMode === 'tablet-fold'
        ? 'h-[72vh] min-h-[220px] md:min-h-[460px] max-h-[calc(100svh-196px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))] md:max-h-[620px]'
        : 'h-[74vh] min-h-[220px] md:min-h-[300px] max-h-[calc(100svh-196px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))] md:max-h-[580px]';

    return (
        /* outerHero compacto: pt-[calc(5rem+env(safe-area-inset-top,0px))] garante que o card
           fique perfeitamente alinhado abaixo do header de 80px (5rem).
           Compensação md:pb-16 neutraliza o md:-mt-12 aplicado pela Home nas fileiras em >= 768px. */
        <div className="w-full px-3.5 sm:px-6 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-3 md:pb-16">
            <div
                className={`relative w-full ${cardHeightClass} rounded-2xl overflow-hidden border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.85)] bg-neutral-950 flex flex-col justify-end`}
            >
                {/* Capa estática de fundo: sempre presente para evitar flash e LCP imediato */}
                <img
                    src={compactImageSrc}
                    alt={featured.title}
                    fetchPriority="high"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-top select-none pointer-events-none z-0"
                />

                {/* Trailer Inline de alta fidelidade: apenas em tablet-fold com YouTube compatível */}
                {shouldMountCompactTrailer && youtubeId && (
                    <Suspense fallback={null}>
                        <CompactHeroTrailer
                            videoId={youtubeId}
                            title={featured.title}
                            isMuted={isCompactMuted}
                            onPlayingChange={(playing) => setCompactTrailerPlaying(playing)}
                            onMuteChange={(muted) => setIsCompactMuted(muted)}
                            onFallback={() => {
                                setCompactTrailerFailed(true);
                                setCompactTrailerPlaying(false);
                            }}
                        />
                    </Suspense>
                )}

                {/* Botão discreto de som: SÓ visível se o trailer compacto estiver efetivamente reproduzindo */}
                {compactTrailerPlaying && (
                    <button
                        type="button"
                        onClick={() => setIsCompactMuted((prev) => !prev)}
                        aria-label={isCompactMuted ? 'Ativar som do trailer' : 'Silenciar trailer'}
                        aria-pressed={!isCompactMuted}
                        title={isCompactMuted ? 'Ativar som' : 'Silenciar'}
                        className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white/90 border border-white/15 backdrop-blur-md transition-all shadow-lg"
                    >
                        {isCompactMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                )}

                {/* Vinheta sutil no topo do cartão */}
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-10" />

                {/* Gradiente escuro na base para legibilidade máxima dos títulos e botões */}
                <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 via-45% to-transparent pointer-events-none z-10" />

                {/* Conteúdo flutuante dentro do cartão */}
                <div className="relative z-10 px-4 pb-4 pt-4 sm:pt-6 flex flex-col items-center text-center">
                    {/* Título */}
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide [text-shadow:0_2px_10px_rgba(0,0,0,0.9)] line-clamp-2 leading-tight max-w-[92%]">
                        {featured.title}
                    </h1>

                    {/* Gêneros/Tags mínimos: UMA linha truncada sem quebras */}
                    <div className="flex items-center justify-center flex-nowrap overflow-hidden max-w-[92%] truncate text-xs text-gray-200 font-medium tracking-wide mt-1.5 mb-3 sm:mt-2 sm:mb-4 [text-shadow:0_1px_4px_rgba(0,0,0,0.85)]">
                        {mobileTags.map((tag, idx) => (
                            <span key={idx} className="flex items-center gap-2 shrink-0">
                                <span className="truncate">{tag}</span>
                                {idx < mobileTags.length - 1 && (
                                    <span className="text-gray-400 text-[10px] select-none shrink-0">•</span>
                                )}
                            </span>
                        ))}
                    </div>

                    {/* Botões de Ação verticais no estilo HuaPlay */}
                    <div className="w-full max-w-md flex flex-col gap-2 sm:gap-2.5">
                        {/* Botão Primário: Assistir */}
                        <button
                            type="button"
                            onClick={onNavigate}
                            className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 active:bg-neutral-300 active:scale-[0.98] text-black font-semibold text-sm rounded-md flex items-center justify-center gap-2 transition-all shadow-md"
                        >
                            <Play className="w-4 h-4 fill-black text-black" />
                            <span>{mobilePlayLabel}</span>
                        </button>

                        {/* Botão Secundário: Minha Lista */}
                        <button
                            type="button"
                            onClick={onToggleList}
                            className="w-full py-2.5 px-4 bg-[#262626]/90 hover:bg-[#333333] active:bg-[#404040] active:scale-[0.98] text-white font-medium text-sm rounded-md flex items-center justify-center gap-2 border border-white/10 transition-all"
                        >
                            {isInList ? (
                                <>
                                    <Check className="w-4 h-4 text-white" />
                                    <span>Minha lista</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 text-white" />
                                    <span>Minha lista</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Hero({ initialFeatured, featuredPromise }: HeroProps = {}) {
    const [featured, setFeatured] = useState<FeaturedSeries | null>(initialFeatured ?? null);
    const [loading, setLoading] = useState<boolean>(
        initialFeatured !== undefined ? !initialFeatured : true
    );
    const [desktopMuted, setDesktopMuted] = useState(true);
    const [desktopPlaying, setDesktopPlaying] = useState(false);
    const [desktopTrailerFailed, setDesktopTrailerFailed] = useState(false);
    const [desktopTrailerReady, setDesktopTrailerReady] = useState(false);

    const navigate = useNavigate();
    const heroMode = useHeroDeviceMode();
    const { uid, currentProfile, myListIds, updateLists, isAuthenticated } = useAuth();
    const { addToast } = useToast();

    // Reset de estados desktop ao mudar conteúdo ou modo + defer do iframe YouTube após LCP/interação
    useEffect(() => {
        setDesktopMuted(true);
        setDesktopPlaying(false);
        setDesktopTrailerFailed(false);
        setDesktopTrailerReady(false);

        if (heroMode !== 'desktop') return;
        let triggered = false;
        const activate = () => {
            if (triggered) return;
            triggered = true;
            setDesktopTrailerReady(true);
            cleanup();
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', activate);
            window.removeEventListener('scroll', activate);
            window.removeEventListener('keydown', activate);
            window.clearTimeout(timer);
        };
        window.addEventListener('pointermove', activate, { once: true, passive: true });
        window.addEventListener('scroll', activate, { once: true, passive: true });
        window.addEventListener('keydown', activate, { once: true, passive: true });
        const timer = window.setTimeout(activate, 7500);
        return cleanup;
    }, [featured?.id, featured?.trailer_url, heroMode]);

    const isInList = featured ? myListIds.includes(Number(featured.id)) : false;

    const handleToggleList = async () => {
        if (!featured) return;
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        try {
            if (!uid || !currentProfile) return;
            if (isInList) {
                await removeFromMyList(uid, currentProfile.id, Number(featured.id));
                addToast('Removido da sua lista', 'info');
            } else {
                await addToMyList(uid, currentProfile.id, Number(featured.id));
                addToast('Adicionado à sua lista', 'success');
            }
            await updateLists();
        } catch (error) {
            console.error("Failed to update list", error);
            addToast('Erro ao atualizar lista', 'error');
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        let isCancelled = false;

        const loadFeatured = async () => {
            try {
                let data: FeaturedSeries | null = null;
                if (initialFeatured) {
                    data = initialFeatured;
                } else if (featuredPromise !== undefined) {
                    data = featuredPromise ? await featuredPromise : null;
                } else if (initialFeatured !== undefined) {
                    data = initialFeatured;
                } else {
                    const res = await api.get('/series/hero-featured', { signal: controller.signal });
                    data = res.data;
                }

                if (isCancelled) return;

                if (data) {
                    setFeatured(data);
                    setLoading(false);
                    return;
                }

                // If hero data is null/empty or failed, trigger fallback
                const fallbackRes = await api.get('/series/?limit=30', { signal: controller.signal });
                if (isCancelled) return;
                const pool = (fallbackRes.data || []).filter((s: FeaturedSeries) => s.banner_image);
                if (pool.length > 0) {
                    // Stable fallback banner ensures image decode reuse and avoids constant redownloads
                    setFeatured(pool[0]);
                }
            } catch (error: unknown) {
                const err = error as { name?: string };
                if (isCancelled || err?.name === 'AbortError' || err?.name === 'CanceledError') {
                    return;
                }
                console.error("Failed to fetch hero featured series:", error);
                try {
                    const fallbackRes = await api.get('/series/?limit=30', { signal: controller.signal });
                    if (isCancelled) return;
                    const pool = (fallbackRes.data || []).filter((s: FeaturedSeries) => s.banner_image);
                    if (pool.length > 0) {
                        setFeatured(pool[0]);
                    }
                } catch (fallbackError: unknown) {
                    const fbErr = fallbackError as { name?: string };
                    if (!isCancelled && fbErr?.name !== 'AbortError' && fbErr?.name !== 'CanceledError') {
                        console.error("Fallback featured failed:", fallbackError);
                    }
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        loadFeatured();

        return () => {
            isCancelled = true;
            controller.abort();
        };
    }, [initialFeatured, featuredPromise]);

    if (loading) {
        if (heroMode === 'desktop') {
            return <div className="relative h-screen w-full bg-black" />;
        }
        const skeletonHeightClass = heroMode === 'tablet-fold'
            ? 'h-[72vh] min-h-[220px] md:min-h-[460px] max-h-[calc(100svh-196px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))] md:max-h-[620px]'
            : 'h-[74vh] min-h-[220px] md:min-h-[300px] max-h-[calc(100svh-196px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))] md:max-h-[580px]';
        return (
            <div className="w-full px-3.5 sm:px-6 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-3 md:pb-16">
                <div className={`relative w-full ${skeletonHeightClass} rounded-2xl border border-white/10 bg-neutral-950 animate-pulse`} />
            </div>
        );
    }

    if (!featured) {
        return (
            <div className="relative h-screen w-full overflow-hidden bg-black">
                <div className="absolute inset-0 select-none pointer-events-none">
                    <img
                        src="/banner-wei.webp"
                        alt="HuaPlay"
                        fetchPriority="high"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                </div>
                <div className="relative h-full w-full px-4 flex flex-col items-center justify-end pb-40">
                    <div className="text-center">
                        <p className="text-xl md:text-2xl text-gray-200 font-light tracking-widest uppercase drop-shadow-lg bg-black/30 backdrop-blur-sm py-2 px-6 rounded-full border border-white/10">
                            O melhor do entretenimento asiático para você
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const typeLabel = featured.type === 'Movie'
        ? 'Filme'
        : featured.type === 'Anime'
        ? 'Anime'
        : featured.type === 'Donghua'
        ? 'Donghua'
        : 'Série';

    const genreList = featured.genre
        ? featured.genre
              .split(/[,/]+/)
              .map((g: string) => g.trim())
              .filter((g: string) => Boolean(g) && g.toLowerCase() !== typeLabel.toLowerCase())
              .slice(0, 3)
        : ['Romance', 'Drama'];

    const mobileTags = [typeLabel, ...genreList];
    const mobilePlayLabel = featured.type === 'Movie' ? 'Assistir ao filme' : 'Assistir à série';

    // RENDERIZAÇÃO CONDICIONAL NO REACT: APENAS ÁRVORE COMPACTA OU DESKTOP
    if (heroMode === 'desktop') {
        const desktopYoutubeId = featured.trailer_url ? getYouTubeVideoId(featured.trailer_url) : null;
        const shouldMountDesktopTrailer = Boolean(
            desktopTrailerReady &&
            desktopYoutubeId &&
            featured.feature_type !== 'BANNER' &&
            !desktopTrailerFailed
        );

        return (
            <div className="relative h-screen w-full overflow-hidden">
                {/* Background Video/Image: banner img SEMPRE como base com prioridade LCP */}
                <div className="absolute inset-0 select-none pointer-events-none">
                    <img
                        src={getOptimizedImageUrl(featured.banner_image || featured.cover_image, 'backdrop')}
                        alt={featured.title}
                        fetchPriority="high"
                        decoding="async"
                        className="w-full h-full object-cover"
                    />

                    {shouldMountDesktopTrailer && desktopYoutubeId && (
                        <Suspense fallback={null}>
                            <CompactHeroTrailer
                                key={`${featured.id}-${featured.trailer_url}`}
                                videoId={desktopYoutubeId}
                                title={featured.title}
                                isMuted={desktopMuted}
                                onPlayingChange={(playing) => setDesktopPlaying(playing)}
                                onMuteChange={(muted) => setDesktopMuted(muted)}
                                onFallback={() => {
                                    setDesktopTrailerFailed(true);
                                    setDesktopPlaying(false);
                                }}
                            />
                        </Suspense>
                    )}

                    {/* Cinematic Gradient Overlays */}
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/40 to-transparent" />
                    <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#050505] to-transparent" />
                </div>

                {/* Content */}
                <div className="relative h-full w-full px-6 md:px-12 lg:px-20 flex items-center pt-16 md:pt-20 lg:pt-24 pb-12">
                    <div className="max-w-4xl space-y-4 md:space-y-6 lg:space-y-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-[2px] w-8 md:w-12 bg-primary"></div>
                            <span className="text-primary font-display font-bold tracking-[0.2em] text-xs md:text-sm uppercase glow-text">
                                Destaque Semanal
                            </span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-2xl max-w-4xl">
                            {featured.title}
                        </h1>

                        <div className="flex items-center gap-3 md:gap-6 text-gray-200 font-sans text-sm md:text-lg tracking-wide border-l-2 border-primary pl-4">
                            <span className="text-primary font-bold">98% Match</span>
                            <span>{featured.release_year}</span>
                            <span className="px-2 py-0.5 border border-white/20 rounded text-xs bg-black/40 backdrop-blur-sm">{featured.status}</span>
                            <span className="px-2 py-0.5 border border-white/20 rounded text-xs bg-black/40 backdrop-blur-sm">HD</span>
                        </div>

                        <p className="text-gray-300 text-sm md:text-lg max-w-xl md:max-w-2xl line-clamp-3 font-light leading-relaxed drop-shadow-md">
                            {featured.description || "Uma história envolvente que vai prender sua atenção do início ao fim. Descubra os segredos e emoções desta incrível produção asiática."}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 pt-4 md:pt-6">
                            <button
                                type="button"
                                onClick={() => navigate(`/series/${featured.slug || featured.id}`)}
                                className="group flex items-center gap-2 md:gap-3 px-6 py-3 md:px-10 md:py-4 bg-gradient-to-r from-primary to-[#b8860b] text-black rounded-sm font-display font-bold text-base md:text-xl hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] w-full md:w-auto justify-center"
                            >
                                <Play className="w-5 h-5 md:w-6 md:h-6 fill-black group-hover:fill-current transition-colors" />
                                ASSISTIR AGORA
                            </button>

                            <button
                                type="button"
                                onClick={handleToggleList}
                                className={`flex items-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 border border-white/30 backdrop-blur-md rounded-sm font-display font-bold text-base md:text-xl transition-all hover:bg-black/60 hover:border-primary hover:text-primary hover:scale-105 active:scale-95 w-full md:w-auto justify-center ${isInList ? 'bg-primary/20 text-primary border-primary' : 'bg-black/40 text-white'}`}
                            >
                                {isInList ? <Check className="w-5 h-5 md:w-6 md:h-6" /> : <Plus className="w-5 h-5 md:w-6 md:h-6" />}
                                {isInList ? 'NA LISTA' : 'MINHA LISTA'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mute toggle for Desktop Trailer: somente quando reproduzindo */}
                {desktopPlaying && (
                    <button
                        onClick={() => setDesktopMuted(!desktopMuted)}
                        aria-label={desktopMuted ? 'Ativar som do trailer' : 'Silenciar trailer'}
                        title={desktopMuted ? 'Ativar som' : 'Silenciar'}
                        className="hidden md:flex absolute bottom-28 right-6 md:right-12 lg:right-20 z-20 items-center justify-center p-4 border border-white/10 rounded-full text-gray-400 hover:text-primary hover:border-primary/50 bg-black/60 backdrop-blur-md transition-all"
                    >
                        {desktopMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                )}
            </div>
        );
    }

    // ÁRVORE COMPACTA: keyed por heroMode + featured.id + trailer_url
    return (
        <CompactHeroCard
            key={`${heroMode}-${featured.id}-${featured.trailer_url || ''}`}
            featured={featured}
            heroMode={heroMode}
            mobileTags={mobileTags}
            mobilePlayLabel={mobilePlayLabel}
            isInList={isInList}
            onToggleList={handleToggleList}
            onNavigate={() => navigate(`/series/${featured.slug || featured.id}`)}
        />
    );
}
