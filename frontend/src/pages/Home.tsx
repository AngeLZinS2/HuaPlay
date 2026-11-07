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
} from '../services/catalogCache';

export default function Home() {
    const { uid, isAuthenticated, currentProfile, myListIds, myLikeIds } = useAuth();
    const [myListRow, setMyListRow] = useState<any[]>([]);
    const [recommended, setRecommended] = useState<any[]>([]);
    const [becauseYouWatched, setBecauseYouWatched] = useState<{ base: any; list: any[] } | null>(null);
    const [isPersonalized, setIsPersonalized] = useState(false);

    // Initial state restored from limited TTL public cache for instantaneous route transitions
    const initialCached = getCachedPublicCatalog();
    const [loading, setLoading] = useState(!initialCached);
    const [heroFeatured, setHeroFeatured] = useState<any | null | undefined>(
        initialCached?.data.heroFeatured !== undefined ? initialCached.data.heroFeatured : undefined
    );
    const [managedRows, setManagedRows] = useState(initialCached?.data.managedRows ?? []);
    const [hasManagedHome, setHasManagedHome] = useState(initialCached?.data.hasManagedHome ?? false);
    const [trending, setTrending] = useState(initialCached?.data.trending ?? []);
    const [newReleases, setNewReleases] = useState(initialCached?.data.newReleases ?? []);
    const [wuxiaRow, setWuxiaRow] = useState(initialCached?.data.wuxiaRow ?? []);
    const heroPromiseRef = useRef<Promise<any> | null>(null);
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
            }

            const fetchPromise = fetchPublicCatalogWithDedup(controller.signal);
            heroPromiseRef.current = fetchPromise
                .then((c) => c.heroFeatured)
                .catch(() => null);

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

        fetchRecommendations();

        return () => {
            isCancelled = true;
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-2 md:pb-20 overflow-x-hidden">
            <Hero initialFeatured={heroFeatured} featuredPromise={heroPromiseRef.current} />

            <div className="relative z-10 mt-2 md:-mt-12 space-y-8 md:space-y-12">
                {/* 0. Minha Lista (Exibido apenas se o usuário estiver logado e possuir conteúdos salvos) */}
                {isAuthenticated && myListRow.length > 0 && (
                    <SeriesRow
                        title="Minha Lista"
                        series={myListRow}
                        onOpenModal={handleOpenModal}
                    />
                )}

                {/* 1. Main Recommendation Row (ML Personalized or Dynamic Cold Start) */}
                {recommended.length > 0 && (
                    <SeriesRow
                        title={isPersonalized ? "Recomendados para Você" : "Recomendações em Destaque"}
                        series={recommended}
                        onOpenModal={handleOpenModal}
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
                {managedRows.map((row) => row.items.length > 0 && (
                    <SeriesRow
                        key={row.id}
                        title={row.title}
                        series={row.items}
                        onOpenModal={handleOpenModal}
                    />
                ))}

                {/* Compatibilidade: fileiras antigas enquanto a Home não foi configurada */}
                {!hasManagedHome && trending.length > 0 && (
                    <SeriesRow
                        title="Em Alta no HuaPlay"
                        series={trending}
                        onOpenModal={handleOpenModal}
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
