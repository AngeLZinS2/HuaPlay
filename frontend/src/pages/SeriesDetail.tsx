import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Download, Star, Share2, Check, History } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import api from '../services/api';
import { getSeriesProgress, recordWatch, type WatchEntry } from '../services/userData';
import { useAuth } from '../context/AuthContext';
import type { Episode, Series } from '../types/models';
import { isPixeldrainUrl } from '../utils/pixeldrain';
import { PREFER_NATIVE_PIXELDRAIN } from '../config';
import { useVisibleElapsed } from '../hooks/useVisibleElapsed';
import { getYouTubeEmbedUrl } from '../utils/youtube';
import { getOptimizedImageUrl } from '../utils/image';

export default function SeriesDetail() {
    const { id } = useParams();
    const [series, setSeries] = useState<Series | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
    const [useAlternativeLink, setUseAlternativeLink] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeSource, setActiveSource] = useState<string>('');
    const { uid, currentProfile, isAuthenticated } = useAuth();
    const playerRef = useRef<HTMLDivElement>(null);

    const [progress, setProgress] = useState<Record<number, WatchEntry>>({});
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const { elapsed, reset: resetElapsed } = useVisibleElapsed();
    const trackedEpisodeRef = useRef<Episode | null>(null);

    // Fire-and-forget: a failed history write must never block playback.
    // Anonymous visitors are skipped — a 401 here would trigger the global
    // interceptor in api.ts and bounce them to /login mid-episode.
    const recordHistory = (ep: Episode | null, seconds = 0, completed = false, isEstimated = false) => {
        if (!isAuthenticated || !uid || !currentProfile || !ep?.id || !series?.id) return;
        const entry: Omit<WatchEntry, 'updatedAt'> = {
            episodeId: ep.id,
            seriesId: series.id,
            episodeNumber: ep.episode_number,
            timestampSeconds: seconds,
            completed,
            isEstimated,
        };
        // Optimistic: the UI must not wait on a round trip to Firestore to show
        // the marker, and a failed write is logged rather than surfaced mid-episode.
        setProgress((prev) => ({ ...prev, [ep.id]: entry }));
        recordWatch(uid, currentProfile.id, entry).catch((err) =>
            console.error('Failed to record watch history:', err),
        );
    };

    // Helper to transform common file host links to embeddable versions
    const transformToEmbed = (url: string | null | undefined, type: 'drive' | 'pixeldrain' | 'mega' | 'youtube') => {
        if (!url) return '';
        if (type === 'drive') {
            const idMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) {
                return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
            }
            if (url.includes('/view')) return url.replace('/view', '/preview');
            return url;
        }
        if (type === 'pixeldrain') {
            return url;
        }
        if (type === 'mega') {
            if (url.includes('/file/')) return url.replace('/file/', '/embed/');
            return url;
        }
        if (type === 'youtube' || url.includes('youtu')) {
            const embed = getYouTubeEmbedUrl(url);
            if (embed) return `${embed}?origin=${window.location.origin}`;
            return url;
        }
        return url;
    };

    const getBestEmbedSource = (ep: Episode | null) => {
        if (!ep) return '';
        // Pixeldrain plays through the native <video>, which is the only source
        // that gives resume and watched markers for the bulk of the catalog.
        if (PREFER_NATIVE_PIXELDRAIN && ep.pixeldrain_link) {
            return transformToEmbed(ep.pixeldrain_link, 'pixeldrain');
        }
        if (ep.embed_url_1) {
            if (ep.embed_url_1.includes('youtu')) return transformToEmbed(ep.embed_url_1, 'youtube');
            return ep.embed_url_1;
        }
        if (ep.embed_url_2) return ep.embed_url_2;
        if (ep.youtube_link) return transformToEmbed(ep.youtube_link, 'youtube');
        if (ep.drive_link) return transformToEmbed(ep.drive_link, 'drive');
        if (ep.pixeldrain_link) return transformToEmbed(ep.pixeldrain_link, 'pixeldrain');
        if (ep.mega_link) return transformToEmbed(ep.mega_link, 'mega');
        return '';
    };

    useEffect(() => {
        const fetchSeriesData = async () => {
            try {
                const seriesRes = await api.get(`/series/${id}`);
                setSeries(seriesRes.data);

                const episodesRes = await api.get(`/series/${id}/episodes`);
                setEpisodes(episodesRes.data);

                if (episodesRes.data.length > 0) {
                    const firstEp = episodesRes.data[0];
                    setSelectedEpisode(firstEp);
                    setSelectedSeason(firstEp.season_number ?? 1);
                    setActiveSource(getBestEmbedSource(firstEp));
                }
            } catch (error) {
                console.error("Failed to fetch series data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchSeriesData();
        }
    }, [id]);

    // For sources with no player API, persist the estimated position every 30s
    // and once more on the way out. YouTube reports real positions instead, so
    // it opts out of the estimator entirely.
    useEffect(() => {
        if (!isAuthenticated) return;
        const exact = activeSource.includes('youtube.com/embed/');
        if (exact) return;

        const flush = () => {
            const ep = trackedEpisodeRef.current;
            if (!ep) return;
            const seconds = elapsed();
            if (seconds > 30) recordHistory(ep, seconds, false, true);
        };
        const timer = setInterval(flush, 30_000);
        return () => {
            clearInterval(timer);
            flush();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, activeSource, selectedEpisode?.id]);

    // Saved positions drive the resume point and the watched markers.
    useEffect(() => {
        if (!isAuthenticated || !uid || !currentProfile || !series?.id) {
            setProgress({});
            return;
        }
        getSeriesProgress(uid, currentProfile.id, series.id)
            .then((rows) => setProgress(Object.fromEntries(rows.map((r) => [r.episodeId, r]))))
            .catch((err) => console.error('Failed to load watch progress:', err));
    }, [isAuthenticated, uid, currentProfile, series?.id]);

    /** "23min" or "1h05" — deliberately coarse, since most values are estimates. */
    const formatPosition = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}min`;
        return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
    };

    // Most recently touched episode of this series, for the resume banner.
    const lastWatched = Object.values(progress).sort((a, b) =>
        (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0),
    )[0];

    // Seasons of one show used to be separate series records; they are now one
    // record with season_number on each episode. 0 is reserved for specials.
    const seasons = [...new Set(episodes.map((e) => e.season_number ?? 1))].sort(
        (a, b) => (a === 0 ? 1 : b === 0 ? -1 : 0) || a - b,
    );
    const activeSeason = selectedSeason ?? seasons[0] ?? 1;
    const visibleEpisodes = episodes.filter((e) => (e.season_number ?? 1) === activeSeason);
    const seasonLabel = (n: number) => (n === 0 ? 'Especiais' : `Temporada ${n}`);

    // Resume where the viewer stopped. YouTube honours ?start=; other providers
    // have no equivalent, so they simply restart from the beginning.
    /** Seconds to resume from, or 0. Consumed by the native player. */
    const resumeSecondsFor = (ep: Episode | null) => {
        const saved = ep ? progress[ep.id] : undefined;
        if (!saved || saved.completed || saved.timestampSeconds < 10) return 0;
        return saved.timestampSeconds;
    };

    const withResume = (url: string, ep: Episode | null) => {
        const saved = ep ? progress[ep.id] : undefined;
        if (!url || !saved || saved.completed || saved.timestampSeconds < 10) return url;
        if (!url.includes('youtube.com/embed/')) return url;
        try {
            const parsed = new URL(url);
            parsed.searchParams.set('start', String(saved.timestampSeconds));
            return parsed.toString();
        } catch {
            return url;
        }
    };

    // Reset source when episode changes
    const handleEpisodeSelect = (ep: Episode) => {
        setSelectedEpisode(ep);
        setSelectedSeason(ep.season_number ?? 1);
        setUseAlternativeLink(false);
        setActiveSource(getBestEmbedSource(ep));
        trackedEpisodeRef.current = ep;
        resetElapsed(progress[ep.id]?.completed ? 0 : progress[ep.id]?.timestampSeconds ?? 0);
        recordHistory(ep);
        playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // "Assistir" starts the currently selected episode (the first one by default).
    const handleWatch = () => {
        if (!selectedEpisode) return;
        recordHistory(selectedEpisode);
        playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!series) {
        return <div className="min-h-screen flex items-center justify-center text-white">Série não encontrada.</div>;
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Cinematic Banner */}
            <div className="relative min-h-[85vh] md:min-h-[75vh] w-full flex items-end pt-28">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${getOptimizedImageUrl(series.banner_image || series.cover_image, 'backdrop')})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-10" />
                </div>

                <div className="relative z-20 w-full max-w-7xl mx-auto p-6 md:p-8 flex flex-col md:flex-row gap-8 items-end">
                    <motion.img
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        src={getOptimizedImageUrl(series.cover_image || series.banner_image, 'poster')}
                        alt={series.title}
                        className="w-48 lg:w-64 rounded-lg shadow-2xl hidden md:block object-cover"
                    />

                    <div className="space-y-4 mb-4">
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-3xl md:text-5xl lg:text-7xl font-bold text-white leading-tight"
                        >
                            {series.title}
                        </motion.h1>

                        <div className="flex flex-wrap gap-4 text-xs md:text-sm text-gray-300">
                            {/* Static rating for now as it's not in DB yet, or use defaults */}
                            <span className="flex items-center gap-1 text-green-400"><Star className="w-4 h-4 fill-current" /> 9.8</span>
                            <span>{series.release_year}</span>
                            <span>{series.genre}</span>
                            <span>{series.country}</span>
                        </div>

                        <p className="max-w-2xl text-gray-300 leading-relaxed line-clamp-4 md:line-clamp-none text-sm md:text-base">
                            {series.description}
                        </p>

                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={handleWatch}
                                disabled={!selectedEpisode}
                                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-primary text-white rounded-full font-semibold transition-colors"
                            >
                                <Play className="w-4 h-4" /> Assistir
                            </button>
                            <button className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors border border-white/20">
                                <Share2 className="w-4 h-4" /> Compartilhar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Player */}
                <div ref={playerRef} className="lg:col-span-2 space-y-6 scroll-mt-24">
                    {lastWatched && lastWatched.episodeId !== selectedEpisode?.id && (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                            <History className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm text-gray-200">
                                Você parou no <strong>Episódio {lastWatched.episodeNumber}</strong>
                                {lastWatched.completed
                                    ? ' (assistido até o fim)'
                                    : lastWatched.timestampSeconds > 60
                                        ? `, ${lastWatched.isEstimated ? 'por volta de ' : 'em '}${formatPosition(lastWatched.timestampSeconds)}`
                                        : ''}
                            </span>
                            <button
                                onClick={() => {
                                    const ep = episodes.find((e) => e.id === lastWatched.episodeId);
                                    if (ep) handleEpisodeSelect(ep);
                                }}
                                className="ml-auto px-4 py-1.5 rounded-full bg-primary text-black text-xs font-bold hover:brightness-110 transition-all"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {selectedEpisode ? (
                        <>
                            <h2 className="text-2xl font-bold">Assistir: {selectedEpisode.episode_number}. {selectedEpisode.title || `Episódio ${selectedEpisode.episode_number}`}</h2>
                            <VideoPlayer
                                embedUrl={withResume(
                                    useAlternativeLink
                                        ? (selectedEpisode.embed_url_2 || activeSource)
                                        : activeSource,
                                    selectedEpisode,
                                )}
                                placeholder="Este episódio não tem reprodutor embutido. Utilize os links abaixo para assistir ou baixar."
                                resumeAt={resumeSecondsFor(selectedEpisode)}
                                onProgress={(seconds) => recordHistory(selectedEpisode, seconds)}
                                onEnded={() => recordHistory(selectedEpisode, 0, true)}
                            />
                        </>
                    ) : (
                        <div className="text-gray-400">Nenhum episódio disponível.</div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-surface p-4 rounded-lg">
                        {/* Play Actions (Instead of Download) */}
                        {selectedEpisode?.drive_link && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(false);
                                    setActiveSource(transformToEmbed(selectedEpisode.drive_link, 'drive'));
                                }}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-sm transition-all font-display font-medium tracking-wide w-full ${activeSource.includes('drive.google')
                                    ? 'bg-primary text-black shadow-[0_0_15px_rgba(212,175,55,0.4)] font-bold'
                                    : 'bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 text-gray-300 hover:text-primary'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${activeSource.includes('drive.google') ? 'fill-black' : 'fill-current'}`} />
                                DRIVE
                            </button>
                        )}
                        {selectedEpisode?.mega_link && (
                            <a href={selectedEpisode.mega_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-gray-300 hover:text-red-400 rounded-sm transition-all font-display font-medium tracking-wide w-full">
                                <Download className="w-4 h-4" /> MEGA
                            </a>
                        )}
                        {selectedEpisode?.pixeldrain_link && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(false);
                                    setActiveSource(transformToEmbed(selectedEpisode.pixeldrain_link, 'pixeldrain'));
                                }}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-sm transition-all font-display font-medium tracking-wide w-full ${isPixeldrainUrl(activeSource)
                                    ? 'bg-[#F69220] text-black shadow-[0_0_15px_rgba(246,146,32,0.4)] font-bold'
                                    : 'bg-white/5 border border-white/10 hover:border-[#F69220]/50 hover:bg-[#F69220]/10 text-gray-300 hover:text-[#F69220]'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${isPixeldrainUrl(activeSource) ? 'fill-black' : 'fill-current'}`} />
                                PIXELDRAIN
                            </button>
                        )}
                        {selectedEpisode?.youtube_link && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(false);
                                    setActiveSource(transformToEmbed(selectedEpisode.youtube_link, 'youtube'));
                                }}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-sm transition-all font-display font-medium tracking-wide w-full ${activeSource.includes('youtube')
                                    ? 'bg-[#FF0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.4)] font-bold'
                                    : 'bg-white/5 border border-white/10 hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10 text-gray-300 hover:text-[#FF0000]'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${activeSource.includes('youtube') ? 'fill-white' : 'fill-current'}`} />
                                YOUTUBE
                            </button>
                        )}

                        {/* Mediafire - Always Download */}
                        {selectedEpisode?.mediafire_link && (
                            <a href={selectedEpisode.mediafire_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 text-gray-300 hover:text-blue-400 rounded-sm transition-all font-display font-medium tracking-wide w-full">
                                <Download className="w-4 h-4" /> MEDIAFIRE
                            </a>
                        )}

                        {/* Generic Download Fallback */}
                        {!selectedEpisode?.drive_link && !selectedEpisode?.mega_link && !selectedEpisode?.mediafire_link && !selectedEpisode?.pixeldrain_link && selectedEpisode?.download_link && (
                            <a href={selectedEpisode.download_link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors w-full p-3">
                                <Download className="w-4 h-4" /> Download
                            </a>
                        )}

                        {/* Alternative Player Toggle */}
                        {selectedEpisode?.embed_url_2 && (
                            <button
                                onClick={() => {
                                    setUseAlternativeLink(!useAlternativeLink);
                                    if (!useAlternativeLink) setActiveSource(selectedEpisode.embed_url_2 || '');
                                    else setActiveSource(selectedEpisode.embed_url_1 || '');
                                }}
                                className={`col-span-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm w-full ${useAlternativeLink
                                    ? 'bg-primary text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {useAlternativeLink ? 'Usando Player Alternativo' : 'Problemas? Link Alternativo'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Episode List */}
                <div className="bg-surface rounded-lg p-6 h-fit sticky top-24">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-xl font-bold">Episódios</h3>
                        {seasons.length > 1 && (
                            <select
                                value={activeSeason}
                                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                aria-label="Selecionar temporada"
                                className="bg-background border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:border-primary focus:outline-none cursor-pointer"
                            >
                                {seasons.map((n) => (
                                    <option key={n} value={n} className="bg-neutral-900">
                                        {seasonLabel(n)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    {seasons.length > 1 && (
                        <p className="text-xs text-gray-500 mb-3">
                            {visibleEpisodes.length} episódio{visibleEpisodes.length !== 1 ? 's' : ''} nesta temporada
                        </p>
                    )}
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {visibleEpisodes.map((ep) => (
                            <motion.div
                                key={ep.id}
                                whileHover={{ x: 4 }}
                                onClick={() => handleEpisodeSelect(ep)}
                                className={`p-4 rounded-lg cursor-pointer transition-colors flex justify-between items-center ${selectedEpisode?.id === ep.id
                                    ? 'bg-primary/20 border border-primary/50'
                                    : 'bg-background hover:bg-gray-800'
                                    }`}
                            >
                                <div>
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        Episódio {ep.episode_number}
                                        {progress[ep.id]?.completed && (
                                            <Check className="w-3.5 h-3.5 text-green-400" aria-label="Assistido" />
                                        )}
                                    </h4>
                                    <p className="text-xs text-gray-400">{ep.title || `Episódio ${ep.episode_number}`}</p>
                                    {!progress[ep.id]?.completed && (progress[ep.id]?.timestampSeconds ?? 0) > 60 && (
                                        <p
                                            className="text-[11px] text-primary mt-0.5"
                                            title={progress[ep.id].isEstimated
                                                ? 'Posição aproximada, estimada pelo tempo com o episódio aberto'
                                                : 'Posição exata informada pelo player'}
                                        >
                                            Parou em {progress[ep.id].isEstimated ? '~' : ''}
                                            {formatPosition(progress[ep.id].timestampSeconds)}
                                        </p>
                                    )}
                                </div>
                                <Play className={`w-4 h-4 ${selectedEpisode?.id === ep.id ? 'text-primary' : 'text-gray-500'}`} />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
