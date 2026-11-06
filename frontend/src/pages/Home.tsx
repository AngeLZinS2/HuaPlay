import { useEffect, useState, useCallback, useRef } from 'react';
import Hero from '../components/Hero';
import { useModal } from '../context/ModalContext';
import SeriesRow from '../components/SeriesRow';
import api, { getPersonalizedRecommendations } from '../services/api';
import { fetchMyListSeries } from '../services/library';
import { getRecentlyWatched } from '../services/userData';
import { useAuth } from '../context/AuthContext';
import { useHomeInactivityRedirect } from '../hooks/useHomeInactivityRedirect';

export default function Home() {
    const { uid, isAuthenticated, currentProfile, myListIds, myLikeIds } = useAuth();
    const [myListRow, setMyListRow] = useState<any[]>([]);
    const [recommended, setRecommended] = useState<any[]>([]);
    const [becauseYouWatched, setBecauseYouWatched] = useState<{ base: any; list: any[] } | null>(null);
    const [isPersonalized, setIsPersonalized] = useState(false);
    const [trending, setTrending] = useState<any[]>([]);
    const [newReleases, setNewReleases] = useState<any[]>([]);
    const [wuxiaRow, setWuxiaRow] = useState<any[]>([]);
    const [managedRows, setManagedRows] = useState<Array<{ id: number; title: string; items: any[] }>>([]);
    const [hasManagedHome, setHasManagedHome] = useState(false);
    const [loading, setLoading] = useState(true);
    const [heroFeatured, setHeroFeatured] = useState<any | null | undefined>(undefined);
    const heroPromiseRef = useRef<Promise<any> | null>(null);
    const { openModal } = useModal();

    useHomeInactivityRedirect(isAuthenticated && Boolean(currentProfile));

    const formatSeries = (items: any[]) => {
        return (items || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            cover_image: item.cover_image,
            image: item.cover_image || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
            banner_image: item.banner_image,
            banner: item.banner_image,
            match: `${Math.floor(Math.random() * 8 + 92)}% Relevante`,
            duration: `${item.release_year || '2024'}`,
            genre: item.genre || 'Dorama',
            description: item.description,
            trailer_url: item.trailer_url,
            release_year: item.release_year,
            cast: item.cast || "Elenco não informado",
            moods: "Envolvente, Emocionante",
        }));
    };

    // Updating My List or likes must not rerun the initial catalog request. That
    // used to put the whole page back into its full-screen loading state, which
    // looked like a browser refresh after every click.
    useEffect(() => {
        const controller = new AbortController();
        let isCancelled = false;

        // Start hero request alongside sections (fresh controller per effect setup, no duplicate request)
        const heroPromise = api.get('/series/hero-featured', { signal: controller.signal })
            .then((res) => {
                if (!isCancelled) {
                    setHeroFeatured(res.data || null);
                }
                return res.data;
            })
            .catch((err: any) => {
                if (!isCancelled && err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
                    console.error("Failed to fetch hero featured series:", err);
                    setHeroFeatured(null);
                }
                return null;
            });

        heroPromiseRef.current = heroPromise;

        const fetchCatalogRows = async () => {
            try {
                let sections: any[] = [];
                try {
                    const homeSectionsRes = await api.get('/home/sections', { signal: controller.signal });
                    if (Array.isArray(homeSectionsRes.data)) {
                        sections = homeSectionsRes.data;
                    }
                } catch (err: any) {
                    if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
                        console.error("Failed to fetch home sections:", err);
                    }
                }

                if (isCancelled) return;

                if (sections.length > 0) {
                    setHasManagedHome(true);
                    setManagedRows(sections.map((section: any) => ({
                        id: section.id,
                        title: section.title,
                        items: formatSeries(section.items || []),
                    })));
                } else {
                    // Fetch catalog/wuxia only if sections empty or failed
                    try {
                        const [allRes, wuxiaRes] = await Promise.all([
                            api.get('/series/?limit=40', { signal: controller.signal }),
                            api.get('/series/?genre=Wuxia&limit=20', { signal: controller.signal }),
                        ]);

                        if (isCancelled) return;

                        const allItems = formatSeries(allRes.data || []);
                        const shuffledTrending = [...allItems].sort(() => 0.5 - Math.random());
                        setTrending(shuffledTrending.slice(0, 18));

                        const sortedNew = [...allItems].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
                        setNewReleases(sortedNew.slice(0, 18));
                        setWuxiaRow(formatSeries(wuxiaRes.data || []));
                        setHasManagedHome(false);
                    } catch (fallbackError: any) {
                        if (fallbackError?.name !== 'AbortError' && fallbackError?.name !== 'CanceledError') {
                            console.error("Fallback catalog fetch failed:", fallbackError);
                        }
                    }
                }
            } catch (error: any) {
                if (error?.name !== 'AbortError' && error?.name !== 'CanceledError') {
                    console.error("Failed to fetch homepage catalog:", error);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchCatalogRows();

        return () => {
            isCancelled = true;
            controller.abort();
            heroPromiseRef.current = null;
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let isCancelled = false;

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

                setIsPersonalized(recData.is_personalized || false);
                setRecommended(formatSeries(recData.recommendations || []));

                if (recData.because_you_watched) {
                    setBecauseYouWatched({
                        base: recData.because_you_watched.base_series,
                        list: formatSeries(recData.because_you_watched.recommendations)
                    });
                } else {
                    setBecauseYouWatched(null);
                }
            } catch (error: any) {
                if (error?.name !== 'AbortError' && error?.name !== 'CanceledError') {
                    console.error("Failed to fetch homepage recommendations:", error);
                }
            }
        };

        fetchRecommendations();

        return () => {
            isCancelled = true;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, currentProfile?.id, myLikeIds, myListIds]);

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
                setMyListRow(formatSeries(listData || []));
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
    }, [isAuthenticated, currentProfile, uid, myListIds]);

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
