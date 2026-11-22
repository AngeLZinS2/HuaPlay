import { useEffect, useState, useCallback, useRef } from 'react';
import Hero from '../components/Hero';
import { useModal } from '../context/ModalContext';
import SeriesRow from '../components/SeriesRow';
import api, { getPersonalizedRecommendations } from '../services/api';
import { fetchMyListSeries } from '../services/library';
import { getRecentlyWatched } from '../services/userData';
import { useAuth } from '../context/AuthContext';
import { useHomeInactivityRedirect } from '../hooks/useHomeInactivityRedirect';
import {
    getCachedPublicCatalog,
    fetchPublicCatalogWithDedup,
    formatSeriesList,
    getHeroFeaturedEarly,
    getInitialSsrHero,
} from '../services/catalogCache';

export default function Home() {
    const { uid, isAuthenticated, currentProfile, myListIds, myLikeIds } = useAuth();
    const [myListRow, setMyListRow] = useState<any[]>([]);
    const [recommended, setRecommended] = useState<any[]>([]);
    const [becauseYouWatched, setBecauseYouWatched] = useState<{ base: any; list: any[] } | null>(null);
    const [isPersonalized, setIsPersonalized] = useState(false);

    // Initial state restored from limited TTL public cache or SSI-inlined Hero for instant Frame-0 LCP
    const initialCached = getCachedPublicCatalog();
    const initialSsrHero = getInitialSsrHero();
    const [loading, setLoading] = useState(!initialCached);
    const [heroFeatured, setHeroFeatured] = useState<any | null | undefined>(
        initialCached?.data.heroFeatured !== undefined
            ? initialCached.data.heroFeatured
            : (initialSsrHero ?? undefined)
    );
    const [managedRows, setManagedRows] = useState(initialCached?.data.managedRows ?? []);
    const [hasManagedHome, setHasManagedHome] = useState(initialCached?.data.hasManagedHome ?? false);
    const [trending, setTrending] = useState(initialCached?.data.trending ?? []);
    const [newReleases, setNewReleases] = useState(initialCached?.data.newReleases ?? []);
    const [wuxiaRow, setWuxiaRow] = useState(initialCached?.data.wuxiaRow ?? []);
    const heroPromiseRef = useRef<Promise<any> | null>(
        initialCached?.data.heroFeatured ? null : getHeroFeaturedEarly()
    );
    const { openModal } = useModal();

    useHomeInactivityRedirect(isAuthenticated && Boolean(currentProfile));

    // Public catalog & Hero lifecycle with deduplication and stale-while-revalidate
    useEffect(() => {
        const controller = new AbortController();
        let isCancelled = false;

        const currentCached = getCachedPublicCatalog();
        const shouldFetch = !currentCached || currentCached.isStale;

        if (shouldFetch) {
            if (!currentCached) {
                setLoading(true);
                // Resolve Hero ASAP without blocking on the larger /home/sections payload
                const earlyHero = getHeroFeaturedEarly(controller.signal);
                heroPromiseRef.current = earlyHero;
                earlyHero.then((hero) => {
                    if (!isCancelled && hero) {
                        setHeroFeatured(hero);
                    }
                }).catch(() => {});
            }

            const fetchPromise = fetchPublicCatalogWithDedup(controller.signal);
            if (!heroPromiseRef.current) {
                heroPromiseRef.current = fetchPromise
                    .then((c) => c.heroFeatured)
                    .catch(() => null);
            }

            fetchPromise
                .then((catalog) => {
                    if (isCancelled) return;
                    setHeroFeatured(catalog.heroFeatured);
                    setHasManagedHome(catalog.hasManagedHome);
                    setManagedRows(catalog.managedRows);
                    setTrending(catalog.trending);
                    setNewReleases(catalog.newReleases);
                    setWuxiaRow(catalog.wuxiaRow);
                })
                .catch((err: any) => {
                    if (isCancelled || err?.name === 'AbortError' || err?.name === 'CanceledError') {
                        return;
                    }
                    console.error("Failed to load homepage public catalog:", err);
                })
                .finally(() => {
                    if (!isCancelled) {
                        setLoading(false);
                    }
                });
        } else {
            setLoading(false);
        }

        return () => {
            isCancelled = true;
            controller.abort();
            heroPromiseRef.current = null;
        };
    }, []);

    // Personal recommendations: strictly scoped per uid and currentProfile to prevent data leaks between profiles
    useEffect(() => {
        const controller = new AbortController();
        let isCancelled = false;

        // Immediately isolate/reset personal recommendations on account or profile switch
        if (!uid || !currentProfile) {
            setRecommended([]);
            setBecauseYouWatched(null);
            setIsPersonalized(false);
        }

        const fetchRecommendations = async () => {
            try {
                let recData;
                if (uid && currentProfile) {
                    const history = await getRecentlyWatched(uid, currentProfile.id, 40);
                    if (isCancelled) return;
                    const watchedIds = [...new Set(history.map((h) => h.seriesId))];
                    recData = await getPersonalizedRecommendations({
                        watched_ids: watchedIds,
                        liked_ids: myLikeIds,
                        listed_ids: myListIds,
                        recent_series_id: watchedIds[0] ?? null,
                    });
                } else {
                    recData = (await api.get('/series/recommendations', { signal: controller.signal })).data;
                }

                if (isCancelled) return;

                setIsPersonalized(recData?.is_personalized || false);
                setRecommended(formatSeriesList(recData?.recommendations || []));

                if (recData?.because_you_watched) {
                    setBecauseYouWatched({
                        base: recData.because_you_watched.base_series,
                        list: formatSeriesList(recData.because_you_watched.recommendations || []),
                    });
                } else {
                    setBecauseYouWatched(null);
                }
            } catch (error: any) {
                if (!isCancelled && error?.name !== 'AbortError' && error?.name !== 'CanceledError') {
                    console.error("Failed to fetch homepage recommendations:", error);
                }
            }
        };

        const recTimer = window.setTimeout(() => {
            if (!isCancelled) {
                void fetchRecommendations();
            }
        }, 1200);

        return () => {
            isCancelled = true;
            window.clearTimeout(recTimer);
            controller.abort();
        };
    }, [uid, currentProfile?.id, myLikeIds, myListIds]);

    // My List: strictly per profile and uid
    useEffect(() => {
        let isCancelled = false;

        const fetchMyList = async () => {
            if (!isAuthenticated || !currentProfile || !uid) {
                setMyListRow([]);
                return;
            }
            try {
                const listData = await fetchMyListSeries(uid, currentProfile.id);
                if (isCancelled) return;
                setMyListRow(formatSeriesList(listData || []));
            } catch (err) {
                if (!isCancelled) {
                    console.error("Failed to fetch My List for homepage:", err);
                    setMyListRow([]);
                }
            }
        };

        fetchMyList();

        return () => {
            isCancelled = true;
        };
    }, [isAuthenticated, currentProfile?.id, uid, myListIds]);

    const handleOpenModal = useCallback((seriesItem: any) => {
        openModal(seriesItem);
    }, [openModal]);

    const hasAnyRows =
        (isAuthenticated && myListRow.length > 0) ||
        recommended.length > 0 ||
        Boolean(becauseYouWatched && becauseYouWatched.list.length > 0) ||
        managedRows.some((row) => row.items.length > 0) ||
        (!hasManagedHome && (trending.length > 0 || newReleases.length > 0 || wuxiaRow.length > 0));

    return (
        <div className="min-h-screen pb-2 md:pb-20 overflow-x-clip">
            <Hero initialFeatured={heroFeatured} featuredPromise={heroPromiseRef.current} />

            <div className="relative z-10 mt-2 md:-mt-12 space-y-8 md:space-y-12">
                {loading && !hasAnyRows && (
                    <div className="space-y-8 px-4 sm:px-6 lg:px-8 pt-4" aria-busy="true" aria-label="Carregando catálogo">
                        {[0, 1].map((rowIdx) => (
                            <div key={rowIdx} className="space-y-3">
                                <div className="h-6 w-48 rounded bg-white/10 animate-pulse" />
                                <div className="flex gap-3 overflow-hidden">
                                    {[0, 1, 2, 3, 4, 5].map((cardIdx) => (
                                        <div
                                            key={cardIdx}
                                            className="flex-none w-[140px] md:w-[200px] h-[210px] md:h-[300px] rounded-md bg-white/[0.06] animate-pulse"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* 0. Minha Lista (Exibido apenas se o usuário estiver logado e possuir conteúdos salvos) */}
                {isAuthenticated && myListRow.length > 0 && (
                    <SeriesRow
                        title="Minha Lista"
                        series={myListRow}
                        onOpenModal={handleOpenModal}
                        eager
                    />
                )}

                {/* 1. Main Recommendation Row (ML Personalized or Dynamic Cold Start) */}
                {recommended.length > 0 && (
                    <SeriesRow
                        title={isPersonalized ? "Recomendados para Você" : "Recomendações em Destaque"}
                        series={recommended}
                        onOpenModal={handleOpenModal}
                        eager
                    />
                )}

                {/* 2. Because You Watched X (Conditional ML Row) */}
                {becauseYouWatched && becauseYouWatched.list.length > 0 && (
                    <SeriesRow
                        title={`Porque você assistiu "${becauseYouWatched.base.title}"`}
                        series={becauseYouWatched.list}
                        onOpenModal={handleOpenModal}
                    />
                )}

                {/* Fileiras editoriais configuradas no Painel Admin */}
                {managedRows.map((row, idx) => row.items.length > 0 && (
                    <SeriesRow
                        key={row.id}
                        title={row.title}
                        series={row.items}
                        onOpenModal={handleOpenModal}
                        eager={idx < 2}
                    />
                ))}

                {/* Compatibilidade: fileiras antigas enquanto a Home não foi configurada */}
                {!hasManagedHome && trending.length > 0 && (
                    <SeriesRow
                        title="Em Alta no HuaPlay"
                        series={trending}
                        onOpenModal={handleOpenModal}
                        eager
                    />
                )}

                {/* 4. Novos Lançamentos */}
                {!hasManagedHome && newReleases.length > 0 && (
                    <SeriesRow
                        title="Novos Lançamentos"
                        series={newReleases}
                        onOpenModal={handleOpenModal}
                    />
                )}

                {/* 5. Wuxia & Fantasia */}
                {!hasManagedHome && wuxiaRow.length > 0 && (
                    <SeriesRow
                        title="Dramas de Época, Wuxia & Xianxia"
                        series={wuxiaRow}
                        onOpenModal={handleOpenModal}
                    />
                )}
            </div>
        </div>
    );
}
