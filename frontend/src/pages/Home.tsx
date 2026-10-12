import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import { useModal } from '../context/ModalContext';
import SeriesRow from '../components/SeriesRow';
import api, { getPersonalizedRecommendations } from '../services/api';
import { fetchMyListSeries } from '../services/library';
import { getRecentlyWatched } from '../services/userData';
import { useAuth } from '../context/AuthContext';

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
    const { openModal } = useModal();

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
        const fetchCatalogRows = async () => {
            try {
                const [allRes, wuxiaRes, homeSectionsRes] = await Promise.all([
                    api.get('/series/?limit=40'),
                    api.get('/series/?genre=Wuxia&limit=20'),
                    api.get('/home/sections').catch(() => ({ data: [] })),
                ]);

                const allItems = formatSeries(allRes.data || []);
                const shuffledTrending = [...allItems].sort(() => 0.5 - Math.random());
                setTrending(shuffledTrending.slice(0, 18));

                const sortedNew = [...allItems].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
                setNewReleases(sortedNew.slice(0, 18));
                setWuxiaRow(formatSeries(wuxiaRes.data || []));
                const sections = Array.isArray(homeSectionsRes.data) ? homeSectionsRes.data : [];
                setHasManagedHome(sections.length > 0);
                setManagedRows(sections.map((section: any) => ({
                    id: section.id,
                    title: section.title,
                    items: formatSeries(section.items || []),
                })));
            } catch (error) {
                console.error("Failed to fetch homepage catalog:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCatalogRows();
        // The catalog rows are public and do not depend on list/profile changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                let recData;
                if (uid && currentProfile) {
                    const history = await getRecentlyWatched(uid, currentProfile.id, 40);
                    const watchedIds = [...new Set(history.map((h) => h.seriesId))];
                    recData = await getPersonalizedRecommendations({
                        watched_ids: watchedIds,
                        liked_ids: myLikeIds,
                        listed_ids: myListIds,
                        recent_series_id: watchedIds[0] ?? null,
                    });
                } else {
                    recData = (await api.get('/series/recommendations')).data;
                }

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
            } catch (error) {
                console.error("Failed to fetch homepage recommendations:", error);
            }
        };

        fetchRecommendations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, currentProfile?.id, myLikeIds, myListIds]);

    useEffect(() => {
        const fetchMyList = async () => {
            if (!isAuthenticated || !currentProfile || !uid) {
                setMyListRow([]);
                return;
            }
            try {
                const listData = await fetchMyListSeries(uid, currentProfile.id);
                setMyListRow(formatSeries(listData || []));
            } catch (err) {
                console.error("Failed to fetch My List for homepage:", err);
                setMyListRow([]);
            }
        };

        fetchMyList();
    }, [isAuthenticated, currentProfile?.id, myListIds]);

    const handleOpenModal = (seriesItem: any) => {
        openModal(seriesItem);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden">
            <Hero />

            <div className="relative z-10 -mt-12 space-y-12">
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
