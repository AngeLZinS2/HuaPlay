import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Pause,
    Download,
    Star,
    Share2,
    Check,
    CheckCircle2,
    History,
    AlertTriangle,
    X,
    Plus,
    Heart,
    Film,
    ChevronLeft,
    ChevronRight,
    Search,
    LayoutList,
    LayoutGrid,
    Maximize2,
    Minimize2,
    Clock,
    Globe,
    Calendar,
    Layers,
    Tv,
    Users,
    Sparkles,
    RotateCcw,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import VideoPlayer from '../components/VideoPlayer';
import api from '../services/api';
import {
    addToMyList,
    getSeriesProgress,
    likeSeries,
    recordWatch,
    removeFromMyList,
    unlikeSeries,
    type WatchEntry,
} from '../services/userData';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Episode, Series } from '../types/models';
import { isPixeldrainUrl, toPixeldrainEmbed } from '../utils/pixeldrain';
import { PREFER_NATIVE_PIXELDRAIN } from '../config';
import { useVisibleElapsed } from '../hooks/useVisibleElapsed';
import { getYouTubeEmbedUrl } from '../utils/youtube';
import { getTrailerEmbed } from '../utils/trailer';
import { getOptimizedImageUrl } from '../utils/image';

const TYPE_LABELS: Record<string, string> = {
    Movie: 'Filme',
    Anime: 'Anime',
    Donghua: 'Donghua',
    Series: 'Série',
    Drama: 'Drama',
};

const formatPosition = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds));
    if (s < 60) return `${s}s`;
    const mins = Math.floor(s / 60);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
};

const formatClock = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/** Returns a meaningful episode subtitle, omitting generic duplicates like "Episódio 01". */
const getCleanEpisodeSubtitle = (ep: Episode): string | null => {
    const raw = ep.title?.trim();
    if (!raw) return null;
    const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
    const n = ep.episode_number;
    const padded = String(n).padStart(2, '0');
    const genericSet = new Set([
        `episódio ${n}`,
        `episodio ${n}`,
        `episódio ${padded}`,
        `episodio ${padded}`,
        `ep ${n}`,
        `ep ${padded}`,
        `ep. ${n}`,
        `ep. ${padded}`,
        `episode ${n}`,
        `episode ${padded}`,
        `${n}`,
        padded,
    ]);
    return genericSet.has(normalized) ? null : raw;
};

const getEntryUpdatedMs = (entry?: WatchEntry): number => {
    if (!entry?.updatedAt) return 0;
    try {
        return entry.updatedAt.toMillis();
    } catch {
        return 0;
    }
};

export default function SeriesDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        uid,
        currentProfile,
        isAuthenticated,
        isLoading: authLoading,
        myListIds,
        myLikeIds,
        updateLists,
    } = useAuth();
    const { addToast } = useToast();

    const [series, setSeries] = useState<Series | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [relatedSeries, setRelatedSeries] = useState<Series[]>([]);
    const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
    const [useAlternativeLink, setUseAlternativeLink] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeSource, setActiveSource] = useState<string>('');
    const [playbackMode, setPlaybackMode] = useState<'exact' | 'estimated'>('estimated');

    // UI states — Proposta 1 (Cinema Imersivo)
    const [cinemaMode, setCinemaMode] = useState(false);
    const [isStageFullscreen, setIsStageFullscreen] = useState(false);
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const [episodeViewMode, setEpisodeViewMode] = useState<'list' | 'grid'>('list');
    const [episodeSearch, setEpisodeSearch] = useState('');
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const [activeInfoTab, setActiveInfoTab] = useState<'overview' | 'cast' | 'related'>('overview');
    const [trailerOpen, setTrailerOpen] = useState(false);

    // Report modal state
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('video_not_playing');
    const [reportDescription, setReportDescription] = useState('');
    const [reporting, setReporting] = useState(false);
    const [reportSent, setReportSent] = useState(false);
    const [reportError, setReportError] = useState(false);

    // Watch progress & tracking state
    const [progress, setProgress] = useState<Record<number, WatchEntry>>({});
    const [progressLoaded, setProgressLoaded] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [liveSeconds, setLiveSeconds] = useState(0);

    const playerRef = useRef<HTMLDivElement>(null);
    const playerStageRef = useRef<HTMLDivElement>(null);
    const trackedEpisodeRef = useRef<Episode | null>(null);
    const seriesRef = useRef<Series | null>(null);
    const progressRef = useRef<Record<number, WatchEntry>>({});
    const playbackModeRef = useRef<'exact' | 'estimated'>('estimated');
    const lastFlushedRef = useRef<{ episodeId: number; seconds: number }>({ episodeId: 0, seconds: -1 });
    const hasAutoRestoredRef = useRef(false);

    useEffect(() => {
        seriesRef.current = series;
    }, [series]);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        playbackModeRef.current = playbackMode;
    }, [playbackMode]);

    // Track browser/WebView fullscreen state and unlock orientation on exit.
    useEffect(() => {
        const handleFullscreenChange = () => {
            const doc = document as Document & { webkitFullscreenElement?: Element | null };
            const active = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
            setIsStageFullscreen(active);
            if (!active) {
                try {
                    const orient = screen.orientation as ScreenOrientation & { unlock?: () => void };
                    orient?.unlock?.();
                } catch {
                    // Orientation unlock not supported on this platform
                }
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    const handleToggleStageFullscreen = async () => {
        if (isPseudoFullscreen) {
            setIsPseudoFullscreen(false);
            return;
        }
        const doc = document as Document & {
            webkitFullscreenElement?: Element | null;
            webkitExitFullscreen?: () => Promise<void> | void;
        };
        if (document.fullscreenElement || doc.webkitFullscreenElement) {
            try {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
            } catch {
                // Ignore fullscreen exit error
            }
            return;
        }

        const el = playerStageRef.current as
            | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
            | null;
        if (!el) return;

        try {
            if (el.requestFullscreen) {
                await el.requestFullscreen();
                try {
                    const orient = screen.orientation as ScreenOrientation & {
                        lock?: (orientation: string) => Promise<void>;
                    };
                    await orient?.lock?.('landscape');
                } catch {
                    // Orientation lock optional
                }
                return;
            }
            if (el.webkitRequestFullscreen) {
                await el.webkitRequestFullscreen();
                return;
            }
        } catch {
            // Fall back to full-viewport overlay (e.g. iOS Safari)
        }
        setIsPseudoFullscreen(true);
    };

    // Safe history writer: preserves optimistic Timestamp for sorting and prevents
    // accidental 0-second overwrites when clicking "Assistir" or switching back to an episode.
    const recordHistory = useCallback(
        (
            ep: Episode | null,
            seconds = 0,
            completed = false,
            isEstimated = false,
            options?: { forceOverwrite?: boolean },
        ) => {
            const currentSeries = seriesRef.current;
            if (!isAuthenticated || !uid || !currentProfile || !ep?.id || !currentSeries?.id) return;

            const existing = progressRef.current[ep.id];
            const force = Boolean(options?.forceOverwrite);
            const safeSeconds = Math.max(0, Math.min(86400, Math.floor(seconds)));

            const resolvedCompleted = force ? completed : completed || Boolean(existing?.completed);
            let resolvedSeconds = safeSeconds;
            let resolvedEstimated = isEstimated;

            if (!force && existing && !resolvedCompleted) {
                if (safeSeconds === 0 && existing.timestampSeconds > 0) {
                    resolvedSeconds = existing.timestampSeconds;
                    resolvedEstimated = existing.isEstimated;
                } else if (isEstimated && !existing.isEstimated && safeSeconds <= existing.timestampSeconds) {
                    // Never overwrite a higher exact timestamp with a lower estimated one.
                    resolvedSeconds = existing.timestampSeconds;
                    resolvedEstimated = false;
                }
            }

            const payload: Omit<WatchEntry, 'updatedAt'> = {
                episodeId: ep.id,
                seriesId: currentSeries.id,
                episodeNumber: ep.episode_number,
                timestampSeconds: resolvedCompleted ? 0 : resolvedSeconds,
                completed: resolvedCompleted,
                isEstimated: resolvedCompleted ? false : resolvedEstimated,
            };

            const optimistic: WatchEntry = {
                ...payload,
                updatedAt: Timestamp.now(),
            };

            progressRef.current = { ...progressRef.current, [ep.id]: optimistic };
            setProgress((prev) => ({ ...prev, [ep.id]: optimistic }));
            lastFlushedRef.current = { episodeId: ep.id, seconds: payload.timestampSeconds };

            recordWatch(uid, currentProfile.id, payload).catch((err) =>
                console.error('Failed to record watch history:', err),
            );
        },
        [isAuthenticated, uid, currentProfile],
    );

    const flushEstimatedRef = useRef<(secondsOverride?: number, force?: boolean) => void>(() => {});

    const {
        elapsed,
        start: startElapsed,
        pause: pauseElapsed,
        reset: resetElapsed,
        syncFloor: syncElapsedFloor,
        isRunning: isElapsedRunning,
    } = useVisibleElapsed({
        maxSeconds: 3 * 60 * 60,
        onPauseFlush: (seconds) => {
            flushEstimatedRef.current(seconds, true);
        },
    });

    const flushEstimated = useCallback(
        (secondsOverride?: number, force = false) => {
            if (!isAuthenticated || playbackModeRef.current === 'exact') return;
            const ep = trackedEpisodeRef.current;
            if (!ep) return;
            const existing = progressRef.current[ep.id];
            if (existing?.completed) return;

            const seconds = typeof secondsOverride === 'number' ? secondsOverride : elapsed();
            if (seconds < 15) return;

            const sameEpisode = lastFlushedRef.current.episodeId === ep.id;
            if (!force && sameEpisode && Math.abs(seconds - lastFlushedRef.current.seconds) < 10) {
                return;
            }

            recordHistory(ep, seconds, false, true);
        },
        [elapsed, isAuthenticated, recordHistory],
    );

    useEffect(() => {
        flushEstimatedRef.current = flushEstimated;
    }, [flushEstimated]);

    const armEstimatedTracking = useCallback(
        (ep: Episode | null, forceRestartFromSaved = false) => {
            if (!ep) return;
            trackedEpisodeRef.current = ep;
            if (!isAuthenticated || playbackModeRef.current === 'exact') return;

            const saved = progressRef.current[ep.id];
            if (saved?.completed) {
                setIsTracking(false);
                setLiveSeconds(0);
                return;
            }

            const baseSeconds = saved?.timestampSeconds ?? 0;
            if (!isElapsedRunning() || forceRestartFromSaved) {
                startElapsed(baseSeconds);
                setLiveSeconds(baseSeconds);
                setIsTracking(true);
            } else {
                syncElapsedFloor(baseSeconds);
            }
        },
        [isAuthenticated, isElapsedRunning, startElapsed, syncElapsedFloor],
    );

    // Helper to transform common file host links to embeddable versions
    const transformToEmbed = useCallback(
        (url: string | null | undefined, type: 'drive' | 'pixeldrain' | 'mega' | 'youtube') => {
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
                return toPixeldrainEmbed(url) || url;
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
        },
        [],
    );

    const getBestEmbedSource = useCallback(
        (ep: Episode | null) => {
            if (!ep) return '';
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
        },
        [transformToEmbed],
    );

    // Fetch series + episodes whenever route :id changes
    useEffect(() => {
        let cancelled = false;
        const fetchSeriesData = async () => {
            setLoading(true);
            setProgress({});
            progressRef.current = {};
            setProgressLoaded(false);
            setSelectedEpisode(null);
            setActiveSource('');
            setRelatedSeries([]);
            setEpisodeSearch('');
            setSynopsisExpanded(false);
            setCinemaMode(false);
            setIsTracking(false);
            setLiveSeconds(0);
            trackedEpisodeRef.current = null;
            hasAutoRestoredRef.current = false;
            lastFlushedRef.current = { episodeId: 0, seconds: -1 };
            resetElapsed(0, false);

            try {
                const [seriesRes, episodesRes] = await Promise.all([
                    api.get<Series>(`/series/${id}`),
                    api.get<Episode[]>(`/series/${id}/episodes`),
                ]);
                if (cancelled) return;

                const fetchedSeries = seriesRes.data;
                const fetchedEpisodes = episodesRes.data || [];
                setSeries(fetchedSeries);
                seriesRef.current = fetchedSeries;
                setEpisodes(fetchedEpisodes);

                if (fetchedEpisodes.length > 0) {
                    const firstEp = fetchedEpisodes[0];
                    setSelectedEpisode(firstEp);
                    setSelectedSeason(firstEp.season_number ?? 1);
                    setActiveSource(getBestEmbedSource(firstEp));
                    // Always register Ep. 1 as the tracked episode right on load so
                    // it counts progress as soon as the viewer watches it.
                    trackedEpisodeRef.current = firstEp;
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch series data:', error);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        if (id) {
            fetchSeriesData();
        }
        return () => {
            cancelled = true;
        };
    }, [id, getBestEmbedSource, resetElapsed]);

    // Fetch related titles for the editorial "Similares" tab
    useEffect(() => {
        if (!series?.id) return;
        let cancelled = false;
        const fetchRelated = async () => {
            try {
                const primaryGenre = series.genre
                    ?.split(/[,/]+/)
                    .map((g) => g.trim())
                    .filter(Boolean)[0];

                let list: Series[] = [];
                if (primaryGenre) {
                    const res = await api.get<Series[]>('/series/', {
                        params: { genre: primaryGenre, limit: 12 },
                    });
                    list = (res.data || []).filter((s) => s.id !== series.id);
                }
                if (list.length < 4) {
                    const fallback = await api.get<Series[]>('/series/', {
                        params: { type: series.type, limit: 12 },
                    });
                    const seen = new Set(list.map((s) => s.id));
                    for (const item of fallback.data || []) {
                        if (item.id !== series.id && !seen.has(item.id)) {
                            seen.add(item.id);
                            list.push(item);
                        }
                    }
                }
                if (!cancelled) setRelatedSeries(list.slice(0, 8));
            } catch {
                // Non-critical enhancement
            }
        };
        fetchRelated();
        return () => {
            cancelled = true;
        };
    }, [series?.id, series?.genre, series?.type]);

    // Load saved watch progress from Firestore (waiting for Firebase auth & profile bootstrap on cold loads)
    useEffect(() => {
        if (authLoading) return;
        if (isAuthenticated && !currentProfile) return;

        if (!isAuthenticated || !uid || !currentProfile || !series?.id) {
            setProgress({});
            progressRef.current = {};
            setProgressLoaded(true);
            return;
        }
        let cancelled = false;
        hasAutoRestoredRef.current = false;
        setProgressLoaded(false);
        getSeriesProgress(uid, currentProfile.id, series.id)
            .then((rows) => {
                if (cancelled) return;
                const map = Object.fromEntries(rows.map((r) => [r.episodeId, r]));
                progressRef.current = map;
                setProgress(map);

                const activeEp = trackedEpisodeRef.current;
                if (activeEp) {
                    const saved = map[activeEp.id];
                    if (saved && !saved.completed && saved.timestampSeconds > 0) {
                        syncElapsedFloor(saved.timestampSeconds);
                        setLiveSeconds((prev) => Math.max(prev, saved.timestampSeconds));
                    }
                }
                setProgressLoaded(true);
            })
            .catch((err) => {
                console.error('Failed to load watch progress:', err);
                if (!cancelled) setProgressLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [authLoading, isAuthenticated, uid, currentProfile, series?.id, syncElapsedFloor]);

    // Auto-restore where the viewer left off once both episodes and Firestore progress have loaded.
    useEffect(() => {
        if (hasAutoRestoredRef.current || !progressLoaded || episodes.length === 0) return;
        hasAutoRestoredRef.current = true;

        const entries = Object.values(progressRef.current);
        if (entries.length === 0) {
            // No history yet — Ep. 1 stays selected & ready to track from 0s
            const firstEp = episodes[0];
            trackedEpisodeRef.current = firstEp;
            return;
        }

        const latest = [...entries].sort((a, b) => getEntryUpdatedMs(b) - getEntryUpdatedMs(a))[0];
        if (!latest) return;

        const latestIdx = episodes.findIndex((e) => e.id === latest.episodeId);
        if (latestIdx === -1) return;

        // If the last watched episode is still in progress, resume directly on it.
        // If it was completed, suggest the next episode in sequence.
        let targetEp = episodes[latestIdx];
        let initialSeconds = latest.completed ? 0 : latest.timestampSeconds;

        if (latest.completed && latestIdx + 1 < episodes.length) {
            targetEp = episodes[latestIdx + 1];
            const nextSaved = progressRef.current[targetEp.id];
            initialSeconds = nextSaved && !nextSaved.completed ? nextSaved.timestampSeconds : 0;
        }

        // If the user already started watching Ep. 1 before Firestore responded,
        // don't yank them away — just sync Ep. 1's floor and let the Resume Banner offer the jump.
        if (isElapsedRunning() && selectedEpisode?.id !== targetEp.id) {
            const currentSaved = selectedEpisode ? progressRef.current[selectedEpisode.id] : undefined;
            if (currentSaved && !currentSaved.completed && currentSaved.timestampSeconds > 0) {
                syncElapsedFloor(currentSaved.timestampSeconds);
                setLiveSeconds(elapsed());
            }
            return;
        }

        if (selectedEpisode?.id !== targetEp.id) {
            setSelectedEpisode(targetEp);
            setSelectedSeason(targetEp.season_number ?? 1);
            setUseAlternativeLink(false);
            setActiveSource(getBestEmbedSource(targetEp));
        }

        trackedEpisodeRef.current = targetEp;
        if (isElapsedRunning()) {
            syncElapsedFloor(initialSeconds);
            setLiveSeconds(elapsed());
        } else {
            resetElapsed(initialSeconds, false);
            setLiveSeconds(initialSeconds);
        }
    }, [progressLoaded, episodes, selectedEpisode, getBestEmbedSource, isElapsedRunning, syncElapsedFloor, elapsed, resetElapsed]);

    // Periodic Firestore persistence (every 15s) + flush on episode/source change or unmount.
    useEffect(() => {
        if (!isAuthenticated || playbackMode === 'exact' || !selectedEpisode?.id) return;

        const persistTimer = window.setInterval(() => {
            if (isElapsedRunning()) {
                flushEstimated(undefined, false);
            }
        }, 15_000);

        return () => {
            window.clearInterval(persistTimer);
            if (isElapsedRunning()) {
                flushEstimated(undefined, true);
            }
        };
    }, [isAuthenticated, playbackMode, activeSource, selectedEpisode?.id, isElapsedRunning, flushEstimated]);

    // Lightweight 1s local UI ticker so the user sees live progress on iframe sources.
    useEffect(() => {
        if (!isTracking || playbackMode === 'exact') return;
        const uiTimer = window.setInterval(() => {
            setLiveSeconds(elapsed());
        }, 1000);
        return () => window.clearInterval(uiTimer);
    }, [isTracking, playbackMode, elapsed]);

    // Mobile & passive-viewer safety net: if the player is >= 50% visible on screen
    // for 4 continuous seconds (e.g. mobile user scrolled down and tapped Play inside
    // a cross-origin Drive iframe that doesn't fire window.blur), arm Ep. 1 tracking automatically.
    useEffect(() => {
        if (!isAuthenticated || !selectedEpisode || !activeSource || playbackMode === 'exact' || isTracking) {
            return;
        }
        const el = playerRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;

        let armTimeout: number | undefined;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    if (armTimeout === undefined) {
                        armTimeout = window.setTimeout(() => {
                            armEstimatedTracking(selectedEpisode);
                        }, 4000);
                    }
                } else if (armTimeout !== undefined) {
                    window.clearTimeout(armTimeout);
                    armTimeout = undefined;
                }
            },
            { threshold: [0.5] },
        );

        observer.observe(el);
        return () => {
            observer.disconnect();
            if (armTimeout !== undefined) window.clearTimeout(armTimeout);
        };
    }, [isAuthenticated, selectedEpisode, activeSource, playbackMode, isTracking, armEstimatedTracking]);

    // Derived values
    const isInList = series ? myListIds.includes(series.id) : false;
    const isLiked = series ? myLikeIds.includes(series.id) : false;

    const genreList = useMemo(() => {
        if (!series?.genre) return [];
        return series.genre
            .split(/[,/]+/)
            .map((g) => g.trim())
            .filter(Boolean);
    }, [series?.genre]);

    const castList = useMemo(() => {
        if (!series?.cast) return [];
        return series.cast
            .split(/[,;\n]+/)
            .map((c) => c.trim())
            .filter(Boolean);
    }, [series?.cast]);

    const trailerEmbed = useMemo(
        () =>
            getTrailerEmbed(series?.trailer_url, {
                autoplay: true,
                muted: false,
                loop: false,
                controls: true,
                hd: true,
            }),
        [series?.trailer_url],
    );

    const lastWatched = useMemo(() => {
        return Object.values(progress).sort((a, b) => getEntryUpdatedMs(b) - getEntryUpdatedMs(a))[0];
    }, [progress]);

    const typicalDurationSeconds = useMemo(() => {
        const t = (series?.type || '').toLowerCase();
        if (t === 'movie' || t === 'filme') return 95 * 60;
        if (t === 'anime' || t === 'donghua') return 24 * 60;
        return 45 * 60;
    }, [series?.type]);

    const getEpisodeProgressPercent = useCallback(
        (epId: number) => {
            const entry = progress[epId];
            if (entry?.completed) return 100;
            const liveVal =
                selectedEpisode?.id === epId && isTracking && playbackMode === 'estimated'
                    ? liveSeconds
                    : 0;
            const sec = Math.max(entry?.timestampSeconds ?? 0, liveVal);
            if (sec < 15) return 0;
            return Math.min(95, Math.max(6, Math.round((sec / typicalDurationSeconds) * 100)));
        },
        [progress, selectedEpisode?.id, isTracking, playbackMode, liveSeconds, typicalDurationSeconds],
    );

    // Seasons & visible episodes
    const seasons = useMemo(() => {
        return [...new Set(episodes.map((e) => e.season_number ?? 1))].sort(
            (a, b) => (a === 0 ? 1 : b === 0 ? -1 : 0) || a - b,
        );
    }, [episodes]);
    const activeSeason = selectedSeason ?? seasons[0] ?? 1;

    const visibleEpisodes = useMemo(() => {
        return episodes.filter((e) => (e.season_number ?? 1) === activeSeason);
    }, [episodes, activeSeason]);

    const filteredEpisodes = useMemo(() => {
        const q = episodeSearch.trim().toLowerCase();
        if (!q) return visibleEpisodes;
        return visibleEpisodes.filter(
            (ep) =>
                String(ep.episode_number).includes(q) ||
                String(ep.episode_number).padStart(2, '0').includes(q) ||
                (ep.title || '').toLowerCase().includes(q),
        );
    }, [visibleEpisodes, episodeSearch]);

    const seasonLabel = (n: number) => (n === 0 ? 'Especiais' : `Temporada ${n}`);

    const currentEpisodeIndex = useMemo(
        () => (selectedEpisode ? episodes.findIndex((e) => e.id === selectedEpisode.id) : -1),
        [episodes, selectedEpisode],
    );
    const prevEpisode = currentEpisodeIndex > 0 ? episodes[currentEpisodeIndex - 1] : null;
    const nextEpisode =
        currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1
            ? episodes[currentEpisodeIndex + 1]
            : null;

    const watchedCount = useMemo(
        () => episodes.filter((e) => progress[e.id]?.completed).length,
        [episodes, progress],
    );

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

    // Select an episode cleanly: flush previous episode first, never wipe the new episode's saved timestamp!
    const handleEpisodeSelect = useCallback(
        (ep: Episode, shouldScroll = true) => {
            // 1. Flush outgoing episode progress before switching
            if (trackedEpisodeRef.current && trackedEpisodeRef.current.id !== ep.id && isElapsedRunning()) {
                flushEstimated(undefined, true);
            }

            const existing = progressRef.current[ep.id];
            const savedSeconds = existing && !existing.completed ? existing.timestampSeconds : 0;

            setSelectedEpisode(ep);
            setSelectedSeason(ep.season_number ?? 1);
            setUseAlternativeLink(false);
            const nextSource = getBestEmbedSource(ep);
            setActiveSource(nextSource);

            const willBeExact =
                nextSource.includes('youtube.com/embed/') ||
                (PREFER_NATIVE_PIXELDRAIN && isPixeldrainUrl(nextSource));
            const shouldAutoTrack = Boolean(isAuthenticated && nextSource && !willBeExact && !existing?.completed);

            trackedEpisodeRef.current = ep;
            lastFlushedRef.current = { episodeId: ep.id, seconds: savedSeconds };

            if (existing?.completed) {
                resetElapsed(0, false);
                setIsTracking(false);
                setLiveSeconds(0);
            } else {
                // Carry saved progress forward — never wipe to 0
                resetElapsed(savedSeconds, shouldAutoTrack);
                setIsTracking(shouldAutoTrack);
                setLiveSeconds(savedSeconds);
            }

            if (shouldScroll) {
                playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        },
        [flushEstimated, getBestEmbedSource, isAuthenticated, isElapsedRunning, resetElapsed],
    );

    // Hero primary CTA: starts or resumes the selected episode cleanly without zeroing its progress.
    const handleWatch = () => {
        if (!selectedEpisode) return;
        armEstimatedTracking(selectedEpisode);
        playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleToggleWatched = (ep: Episode, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        const currentlyCompleted = Boolean(progressRef.current[ep.id]?.completed);
        if (currentlyCompleted) {
            recordHistory(ep, 0, false, false, { forceOverwrite: true });
            if (selectedEpisode?.id === ep.id) {
                resetElapsed(0, false);
                setIsTracking(false);
                setLiveSeconds(0);
            }
            addToast(`Progresso do Episódio ${ep.episode_number} reiniciado`, 'info');
        } else {
            recordHistory(ep, 0, true, false, { forceOverwrite: true });
            if (selectedEpisode?.id === ep.id) {
                pauseElapsed();
                setIsTracking(false);
                setLiveSeconds(0);
            }
            addToast(`Episódio ${ep.episode_number} marcado como assistido`, 'success');
        }
    };

    const handleToggleTrackingPause = () => {
        if (!selectedEpisode || playbackMode === 'exact') return;
        if (isTracking) {
            const total = pauseElapsed();
            setIsTracking(false);
            setLiveSeconds(total);
            flushEstimated(total, true);
            addToast('Contagem de progresso pausada', 'info');
        } else {
            armEstimatedTracking(selectedEpisode);
            addToast('Contagem de progresso retomada', 'success');
        }
    };

    const handleToggleList = async () => {
        if (!series) return;
        if (!isAuthenticated || !uid || !currentProfile) {
            navigate('/login');
            return;
        }
        try {
            if (isInList) {
                await removeFromMyList(uid, currentProfile.id, series.id);
                addToast('Removido da sua lista', 'info');
            } else {
                await addToMyList(uid, currentProfile.id, series.id);
                addToast('Adicionado à sua lista', 'success');
            }
            await updateLists();
        } catch (error) {
            console.error(error);
            addToast('Erro ao atualizar lista', 'error');
        }
    };

    const handleToggleLike = async () => {
        if (!series) return;
        if (!isAuthenticated || !uid || !currentProfile) {
            navigate('/login');
            return;
        }
        try {
            if (isLiked) {
                await unlikeSeries(uid, currentProfile.id, series.id);
                addToast('Curtida removida', 'info');
            } else {
                await likeSeries(uid, currentProfile.id, series.id);
                addToast('Você curtiu este título!', 'success');
            }
            await updateLists();
        } catch (error) {
            console.error(error);
            addToast('Erro ao atualizar curtida', 'error');
        }
    };

    const handleShare = async () => {
        if (!series) return;
        const shareUrl = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `${series.title} — HuaPlay`,
                    text: `Assista ${series.title} no HuaPlay!`,
                    url: shareUrl,
                });
                return;
            }
        } catch {
            // User canceled native share or unsupported; fall through to clipboard
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
            addToast('Link copiado para a área de transferência!', 'success');
        } catch {
            addToast('Não foi possível copiar o link.', 'error');
        }
    };

    const submitPlaybackReport = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!series?.id || !selectedEpisode?.id) return;
        setReporting(true);
        setReportError(false);
        try {
            await api.post('/reports', {
                series_id: series.id,
                episode_id: selectedEpisode.id,
                reason: reportReason,
                description: reportDescription.trim() || null,
                source_url: activeSource || null,
            });
            setReportSent(true);
            setReportDescription('');
        } catch (error) {
            console.error('Failed to report playback problem:', error);
            setReportError(true);
        } finally {
            setReporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!series) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-white bg-background px-4">
                <p className="text-lg text-gray-300">Série não encontrada.</p>
                <Link
                    to="/"
                    className="px-5 py-2.5 rounded-full bg-primary text-black text-sm font-bold hover:brightness-110 transition"
                >
                    Voltar ao Início
                </Link>
            </div>
        );
    }

    const typeLabel = TYPE_LABELS[series.type] || series.type || 'Série';
    const selectedProgress = selectedEpisode ? progress[selectedEpisode.id] : undefined;
    const displayCurrentSeconds = Math.max(
        selectedProgress && !selectedProgress.completed ? selectedProgress.timestampSeconds : 0,
        isTracking && playbackMode === 'estimated' ? liveSeconds : 0,
    );
    const selectedSubtitle = selectedEpisode ? getCleanEpisodeSubtitle(selectedEpisode) : null;
    const isSelectedResuming = Boolean(selectedProgress && !selectedProgress.completed && selectedProgress.timestampSeconds >= 15);

    const hasDrive = Boolean(selectedEpisode?.drive_link);
    const hasPixeldrain = Boolean(selectedEpisode?.pixeldrain_link);
    const hasYoutube = Boolean(selectedEpisode?.youtube_link);
    const hasEmbed1 = Boolean(selectedEpisode?.embed_url_1 && !hasDrive && !hasPixeldrain && !hasYoutube);
    const hasEmbed2 = Boolean(selectedEpisode?.embed_url_2);
    const hasMega = Boolean(selectedEpisode?.mega_link);
    const hasMediafire = Boolean(selectedEpisode?.mediafire_link);
    const hasGenericDownload = Boolean(
        !hasDrive && !hasMega && !hasMediafire && !hasPixeldrain && selectedEpisode?.download_link,
    );
    const hasAnyStreaming = hasDrive || hasPixeldrain || hasYoutube || hasEmbed1 || hasEmbed2;
    const hasAnyDownload = hasMega || hasMediafire || hasGenericDownload;

    const thumbFallback = getOptimizedImageUrl(series.banner_image || series.cover_image, 'thumbnail');

    return (
        <div className="min-h-screen bg-background text-white pb-28 md:pb-20">
            {/* ================= FULL-BLEED CINEMATIC HERO (PROPOSTA 1) ================= */}
            <section
                className={`relative w-full overflow-hidden transition-all duration-500 ${
                    cinemaMode ? 'opacity-25 blur-[1px]' : 'opacity-100'
                }`}
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 5.5rem)' }}
            >
                {/* Atmospheric Backdrop */}
                <div
                    className="absolute inset-0 bg-cover bg-center scale-[1.02]"
                    style={{
                        backgroundImage: `url(${getOptimizedImageUrl(series.banner_image || series.cover_image, 'backdrop')})`,
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 md:via-background/65 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/35" />
                    <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/90 via-black/45 to-transparent" />
                </div>

                {/* Editorial Hero Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 md:pt-12 md:pb-14">
                    <div className="max-w-3xl space-y-5">
                        {/* Top Eyebrow Badges */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="flex flex-wrap items-center gap-2"
                        >
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.16em] uppercase bg-primary/20 text-primary border border-primary/40 backdrop-blur-sm">
                                {typeLabel}
                            </span>
                            {series.status && (
                                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
                                    {series.status}
                                    {episodes.length > 0 ? ` • ${episodes.length} Eps` : ''}
                                </span>
                            )}
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-gray-200 border border-white/10 backdrop-blur-sm">
                                HD 1080p
                            </span>
                            {watchedCount > 0 && episodes.length > 0 && (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/50 text-primary border border-primary/25 backdrop-blur-sm">
                                    {watchedCount}/{episodes.length} assistidos
                                </span>
                            )}
                        </motion.div>

                        {/* Editorial Serif Title */}
                        <motion.h1
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.45, delay: 0.05 }}
                            className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-wide drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
                        >
                            {series.title}
                        </motion.h1>

                        {/* Structured Metadata + Glass Genre Pills */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.1 }}
                            className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm"
                        >
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/55 border border-emerald-500/30 text-emerald-400 font-bold backdrop-blur-sm">
                                <Star className="w-3.5 h-3.5 fill-current" /> 9.8
                            </span>
                            {series.release_year && (
                                <span className="text-gray-200 font-medium">{series.release_year}</span>
                            )}
                            {series.country && (
                                <>
                                    <span className="text-gray-600">•</span>
                                    <span className="text-gray-200 font-medium">{series.country}</span>
                                </>
                            )}
                            {genreList.length > 0 && <span className="text-gray-600 hidden sm:inline">•</span>}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {genreList.map((genre) => (
                                    <span
                                        key={genre}
                                        className="px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/12 text-gray-200 text-xs font-medium"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        </motion.div>

                        {/* Synopsis with Expand Toggle */}
                        {series.description && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.45, delay: 0.14 }}
                                className="max-w-2xl"
                            >
                                <p
                                    className={`text-sm sm:text-base text-gray-300 leading-relaxed font-light ${
                                        synopsisExpanded ? '' : 'line-clamp-3'
                                    }`}
                                >
                                    {series.description}
                                </p>
                                {series.description.length > 220 && (
                                    <button
                                        type="button"
                                        onClick={() => setSynopsisExpanded((v) => !v)}
                                        className="mt-1.5 text-xs font-semibold text-primary hover:underline"
                                    >
                                        {synopsisExpanded ? 'Mostrar menos' : 'Ler sinopse completa'}
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {/* Complete Action CTA Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.18 }}
                            className="flex flex-wrap items-center gap-3 pt-2"
                        >
                            <button
                                type="button"
                                onClick={handleWatch}
                                disabled={!selectedEpisode}
                                className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-3 rounded-full bg-gradient-to-r from-[#E6C767] via-primary to-[#B88B1A] text-black font-bold text-sm shadow-[0_8px_30px_rgba(212,175,55,0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
                            >
                                <Play className="w-4 h-4 fill-black" />
                                {selectedEpisode
                                    ? isSelectedResuming && selectedProgress
                                        ? `Continuar Ep. ${String(selectedEpisode.episode_number).padStart(2, '0')} (${
                                              selectedProgress.isEstimated ? '~' : ''
                                          }${formatPosition(selectedProgress.timestampSeconds)})`
                                        : `Assistir Ep. ${String(selectedEpisode.episode_number).padStart(2, '0')}`
                                    : 'Assistir'}
                            </button>

                            <button
                                type="button"
                                onClick={handleToggleList}
                                className={`inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold backdrop-blur-md border transition-all cursor-pointer ${
                                    isInList
                                        ? 'bg-primary/20 border-primary/60 text-primary'
                                        : 'bg-white/[0.08] border-white/15 text-white hover:bg-white/15'
                                }`}
                            >
                                {isInList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {isInList ? 'Na Minha Lista' : 'Minha Lista'}
                            </button>

                            <button
                                type="button"
                                onClick={handleToggleLike}
                                aria-label={isLiked ? 'Remover curtida' : 'Curtir título'}
                                title={isLiked ? 'Remover curtida' : 'Curtir'}
                                className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${
                                    isLiked
                                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-400'
                                        : 'bg-white/[0.08] border-white/15 text-gray-200 hover:bg-white/15 hover:text-white'
                                }`}
                            >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                            </button>

                            {trailerEmbed && (
                                <button
                                    type="button"
                                    onClick={() => setTrailerOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold bg-white/[0.08] hover:bg-white/15 text-gray-100 backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                                >
                                    <Film className="w-4 h-4 text-primary" />
                                    Trailer
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleShare}
                                aria-label="Compartilhar"
                                title="Compartilhar"
                                className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/15 text-gray-200 hover:text-white backdrop-blur-md border border-white/15 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <Share2 className="w-4 h-4" />
                            </button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ================= MAIN CINEMA STAGE + EPISODES SIDEBAR ================= */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 space-y-10">
                {/* Resume Banner when last watched episode differs from the currently selected one */}
                {lastWatched && lastWatched.episodeId !== selectedEpisode?.id && (
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/35 bg-primary/10 backdrop-blur-md px-4 py-3.5">
                        <History className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm text-gray-200">
                            Você parou no <strong>Episódio {String(lastWatched.episodeNumber).padStart(2, '0')}</strong>
                            {lastWatched.completed
                                ? ' (assistido até o fim)'
                                : lastWatched.timestampSeconds >= 15
                                    ? `, ${lastWatched.isEstimated ? 'por volta de ' : 'em '}${formatPosition(
                                          lastWatched.timestampSeconds,
                                      )}`
                                    : ''}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                const ep = episodes.find((e) => e.id === lastWatched.episodeId);
                                if (ep) handleEpisodeSelect(ep);
                            }}
                            className="ml-auto px-4 py-1.5 rounded-full bg-primary text-black text-xs font-bold hover:brightness-110 transition cursor-pointer"
                        >
                            Retomar
                        </button>
                    </div>
                )}

                {/* 70/30 Player + Episodes Grid (expands to 100% in Cinema Mode) */}
                <div
                    className={`grid grid-cols-1 gap-6 items-start ${
                        cinemaMode ? '' : 'lg:grid-cols-12'
                    }`}
                >
                    {/* LEFT: Player + Two-Row Unified Control Deck */}
                    <div
                        ref={playerRef}
                        className={`${cinemaMode ? 'w-full' : 'lg:col-span-8'} space-y-3.5 scroll-mt-24`}
                    >
                        {selectedEpisode ? (
                            <>
                                {/* Episode Header Strip */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="px-2.5 py-0.5 rounded-md bg-primary text-black text-xs font-bold tracking-wider shrink-0">
                                            EP {String(selectedEpisode.episode_number).padStart(2, '0')}
                                        </span>
                                        <h2 className="text-base sm:text-xl font-bold text-white truncate">
                                            {selectedSubtitle || `Episódio ${String(selectedEpisode.episode_number).padStart(2, '0')}`}
                                        </h2>
                                    </div>

                                    {/* Live Progress / Watched Indicator */}
                                    {isAuthenticated && (
                                        <div className="flex items-center gap-2">
                                            {selectedProgress?.completed ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Assistido
                                                </span>
                                            ) : playbackMode === 'estimated' && (isTracking || displayCurrentSeconds >= 15) ? (
                                                <button
                                                    type="button"
                                                    onClick={handleToggleTrackingPause}
                                                    title={
                                                        isTracking
                                                            ? 'Registrando tempo aproximado automaticamente — clique para pausar'
                                                            : 'Contagem pausada — clique para retomar'
                                                    }
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                                                        isTracking
                                                            ? 'bg-primary/15 border-primary/40 text-primary'
                                                            : 'bg-white/[0.05] border-white/10 text-gray-400 hover:text-white'
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            isTracking ? 'bg-primary animate-pulse' : 'bg-gray-500'
                                                        }`}
                                                    />
                                                    <span className="font-mono">~{formatClock(displayCurrentSeconds)}</span>
                                                    {isTracking ? (
                                                        <Pause className="w-3 h-3 opacity-80" />
                                                    ) : (
                                                        <Play className="w-3 h-3 opacity-80" />
                                                    )}
                                                </button>
                                            ) : playbackMode === 'exact' && displayCurrentSeconds >= 15 ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/30">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Salvo em {formatPosition(displayCurrentSeconds)}
                                                </span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>

                                {/* Video Player Stage (supports native Fullscreen + iOS overlay fallback) */}
                                <div
                                    ref={playerStageRef}
                                    className={
                                        isPseudoFullscreen
                                            ? 'fixed inset-0 z-[250] bg-black flex flex-col justify-center'
                                            : isStageFullscreen
                                                ? 'w-full h-full bg-black flex flex-col justify-center'
                                                : 'relative'
                                    }
                                >
                                    {isPseudoFullscreen && (
                                        <button
                                            type="button"
                                            onClick={() => setIsPseudoFullscreen(false)}
                                            aria-label="Sair da tela cheia"
                                            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
                                            className="absolute right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 border border-white/20 text-xs font-semibold text-white backdrop-blur-md"
                                        >
                                            <X className="w-4 h-4" /> Sair
                                        </button>
                                    )}
                                    <VideoPlayer
                                        embedUrl={withResume(
                                            useAlternativeLink
                                                ? selectedEpisode.embed_url_2 || activeSource
                                                : activeSource,
                                            selectedEpisode,
                                        )}
                                        placeholder="Este episódio não tem reprodutor embutido. Utilize os links de download abaixo."
                                        resumeAt={resumeSecondsFor(selectedEpisode)}
                                        cinemaMode={cinemaMode}
                                        isFullscreen={isStageFullscreen || isPseudoFullscreen}
                                        onPlaybackModeChange={(mode) => {
                                            setPlaybackMode(mode);
                                            if (mode === 'exact' && isElapsedRunning()) {
                                                pauseElapsed();
                                                setIsTracking(false);
                                            }
                                        }}
                                        onUserInteract={() => {
                                            armEstimatedTracking(selectedEpisode);
                                        }}
                                        onProgress={(seconds) => recordHistory(selectedEpisode, seconds, false, false)}
                                        onEnded={() => recordHistory(selectedEpisode, 0, true, false)}
                                    />
                                </div>

                                {/* Unified Two-Row Cinema Control Bar */}
                                <div className="bg-[#0d0d11] border border-white/10 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
                                    {/* Row 1: Marathon Episode Navigation + Watched + Cinema Mode + Report */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={!prevEpisode}
                                                onClick={() => prevEpisode && handleEpisodeSelect(prevEpisode, false)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                                            </button>
                                            <span className="text-xs text-gray-400 font-medium px-1">
                                                Ep. <strong className="text-white">{String(selectedEpisode.episode_number).padStart(2, '0')}</strong>
                                                {episodes.length > 0 ? ` de ${episodes.length}` : ''}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={!nextEpisode}
                                                onClick={() => nextEpisode && handleEpisodeSelect(nextEpisode, false)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                            >
                                                Próximo <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {isAuthenticated && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleWatched(selectedEpisode)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                                        selectedProgress?.completed
                                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                                                            : 'bg-white/[0.04] border-white/10 text-gray-300 hover:border-primary/40 hover:text-primary'
                                                    }`}
                                                >
                                                    {selectedProgress?.completed ? (
                                                        <>
                                                            <RotateCcw className="w-3.5 h-3.5" /> Desmarcar
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Marcar assistido
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleToggleStageFullscreen}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                                    isStageFullscreen || isPseudoFullscreen
                                                        ? 'bg-primary/20 border-primary/50 text-primary'
                                                        : 'bg-white/[0.04] border-white/10 text-gray-300 hover:border-primary/40 hover:text-primary'
                                                }`}
                                            >
                                                {isStageFullscreen || isPseudoFullscreen ? (
                                                    <>
                                                        <Minimize2 className="w-3.5 h-3.5" /> Sair
                                                    </>
                                                ) : (
                                                    <>
                                                        <Maximize2 className="w-3.5 h-3.5" /> Tela Cheia
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setCinemaMode((v) => !v)}
                                                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                                    cinemaMode
                                                        ? 'bg-primary/20 border-primary/50 text-primary'
                                                        : 'bg-white/[0.04] border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                                                }`}
                                            >
                                                {cinemaMode ? (
                                                    <>
                                                        <Minimize2 className="w-3.5 h-3.5" /> Sair do Cinema
                                                    </>
                                                ) : (
                                                    <>
                                                        <Maximize2 className="w-3.5 h-3.5" /> Modo Cinema
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReportSent(false);
                                                    setReportError(false);
                                                    setReportOpen(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-amber-400 hover:bg-white/[0.05] transition cursor-pointer"
                                            >
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                Reportar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Row 2: Clean Split — Streaming Servers vs. Downloads */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        {/* Streaming Servers */}
                                        {hasAnyStreaming && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 mr-1">
                                                    Streaming:
                                                </span>

                                                {selectedEpisode.drive_link && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUseAlternativeLink(false);
                                                            setActiveSource(transformToEmbed(selectedEpisode.drive_link, 'drive'));
                                                            armEstimatedTracking(selectedEpisode);
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                                                            activeSource.includes('drive.google')
                                                                ? 'bg-primary text-black shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                                                                : 'bg-white/[0.05] border border-white/10 text-gray-300 hover:border-primary/50 hover:text-primary'
                                                        }`}
                                                    >
                                                        <Play
                                                            className={`w-3.5 h-3.5 ${
                                                                activeSource.includes('drive.google') ? 'fill-black' : 'fill-current'
                                                            }`}
                                                        />
                                                        DRIVE
                                                    </button>
                                                )}

                                                {selectedEpisode.pixeldrain_link && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUseAlternativeLink(false);
                                                            setActiveSource(
                                                                transformToEmbed(selectedEpisode.pixeldrain_link, 'pixeldrain'),
                                                            );
                                                            armEstimatedTracking(selectedEpisode);
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                                                            isPixeldrainUrl(activeSource)
                                                                ? 'bg-primary text-black shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                                                                : 'bg-white/[0.05] border border-white/10 text-gray-300 hover:border-primary/50 hover:text-primary'
                                                        }`}
                                                    >
                                                        <Play
                                                            className={`w-3.5 h-3.5 ${
                                                                isPixeldrainUrl(activeSource) ? 'fill-black' : 'fill-current'
                                                            }`}
                                                        />
                                                        PIXELDRAIN
                                                    </button>
                                                )}

                                                {selectedEpisode.youtube_link && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUseAlternativeLink(false);
                                                            setActiveSource(
                                                                transformToEmbed(selectedEpisode.youtube_link, 'youtube'),
                                                            );
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                                                            activeSource.includes('youtube')
                                                                ? 'bg-[#FF0000] text-white shadow-[0_0_18px_rgba(255,0,0,0.35)]'
                                                                : 'bg-white/[0.05] border border-white/10 text-gray-300 hover:border-red-500/50 hover:text-red-400'
                                                        }`}
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        YOUTUBE
                                                    </button>
                                                )}

                                                {hasEmbed1 && selectedEpisode.embed_url_1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUseAlternativeLink(false);
                                                            setActiveSource(
                                                                selectedEpisode.embed_url_1!.includes('youtu')
                                                                    ? transformToEmbed(selectedEpisode.embed_url_1, 'youtube')
                                                                    : selectedEpisode.embed_url_1!,
                                                            );
                                                            armEstimatedTracking(selectedEpisode);
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                                                            !useAlternativeLink && activeSource === selectedEpisode.embed_url_1
                                                                ? 'bg-primary text-black shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                                                                : 'bg-white/[0.05] border border-white/10 text-gray-300 hover:border-primary/50 hover:text-primary'
                                                        }`}
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        PLAYER 1
                                                    </button>
                                                )}

                                                {hasEmbed2 && selectedEpisode.embed_url_2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nextAlt = !useAlternativeLink;
                                                            setUseAlternativeLink(nextAlt);
                                                            setActiveSource(
                                                                nextAlt
                                                                    ? selectedEpisode.embed_url_2 || ''
                                                                    : getBestEmbedSource(selectedEpisode),
                                                            );
                                                            armEstimatedTracking(selectedEpisode);
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                                                            useAlternativeLink
                                                                ? 'bg-primary text-black shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                                                                : 'bg-white/[0.05] border border-white/10 text-gray-300 hover:border-primary/50 hover:text-primary'
                                                        }`}
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        ALTERNATIVO
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Downloads Section (Visually Separated!) */}
                                        {hasAnyDownload && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 mr-1">
                                                    Downloads:
                                                </span>

                                                {selectedEpisode.mega_link && (
                                                    <a
                                                        href={selectedEpisode.mega_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.03] border border-white/10 text-gray-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 transition-all"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        MEGA
                                                    </a>
                                                )}

                                                {selectedEpisode.mediafire_link && (
                                                    <a
                                                        href={selectedEpisode.mediafire_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.03] border border-white/10 text-gray-300 hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 transition-all"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        MEDIAFIRE
                                                    </a>
                                                )}

                                                {hasGenericDownload && selectedEpisode.download_link && (
                                                    <a
                                                        href={selectedEpisode.download_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.03] border border-white/10 text-gray-300 hover:border-white/25 hover:text-white transition-all"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        DOWNLOAD
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-12 text-center text-gray-400">
                                Nenhum episódio disponível no momento.
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Smart Episodes Sidebar (List + Numeric Grid + Search) */}
                    <aside
                        className={`${
                            cinemaMode ? 'w-full' : 'lg:col-span-4 lg:sticky lg:top-24'
                        } bg-[#0d0d11] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5`}
                    >
                        {/* Sidebar Header */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">Episódios</h3>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/[0.07] text-gray-300">
                                    {visibleEpisodes.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {seasons.length > 1 && (
                                    <select
                                        value={activeSeason}
                                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                        aria-label="Selecionar temporada"
                                        className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none cursor-pointer"
                                    >
                                        {seasons.map((n) => (
                                            <option key={n} value={n} className="bg-neutral-900">
                                                {seasonLabel(n)}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* List / Grid View Switcher */}
                                <div className="inline-flex bg-black/60 border border-white/10 rounded-xl p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setEpisodeViewMode('list')}
                                        aria-label="Visualização em lista"
                                        title="Lista detalhada"
                                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                                            episodeViewMode === 'list'
                                                ? 'bg-primary text-black'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <LayoutList className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEpisodeViewMode('grid')}
                                        aria-label="Visualização em grade"
                                        title="Grade numérica"
                                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                                            episodeViewMode === 'grid'
                                                ? 'bg-primary text-black'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Quick Search Input */}
                        {visibleEpisodes.length > 6 && (
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={episodeSearch}
                                    onChange={(e) => setEpisodeSearch(e.target.value)}
                                    placeholder="Ir para episódio (ex: 12)..."
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition"
                                />
                                {episodeSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setEpisodeSearch('')}
                                        aria-label="Limpar busca"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Episodes Scroll Area */}
                        <div className="max-h-[440px] lg:max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredEpisodes.length === 0 ? (
                                <p className="py-10 text-center text-xs text-gray-500">
                                    Nenhum episódio encontrado para "{episodeSearch}".
                                </p>
                            ) : episodeViewMode === 'grid' ? (
                                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-2">
                                    {filteredEpisodes.map((ep) => {
                                        const isActive = selectedEpisode?.id === ep.id;
                                        const epProgress = progress[ep.id];
                                        const pct = getEpisodeProgressPercent(ep.id);
                                        const epCode = String(ep.episode_number).padStart(2, '0');
                                        return (
                                            <button
                                                key={ep.id}
                                                type="button"
                                                onClick={() => handleEpisodeSelect(ep)}
                                                title={
                                                    epProgress?.completed
                                                        ? `Episódio ${epCode} — Assistido`
                                                        : epProgress && epProgress.timestampSeconds >= 15
                                                            ? `Episódio ${epCode} — Parou em ${
                                                                  epProgress.isEstimated ? '~' : ''
                                                              }${formatPosition(epProgress.timestampSeconds)}`
                                                            : `Episódio ${epCode}`
                                                }
                                                className={`relative h-12 rounded-xl text-xs font-bold border transition-all overflow-hidden flex flex-col items-center justify-center cursor-pointer ${
                                                    isActive
                                                        ? 'bg-primary text-black border-primary shadow-[0_0_18px_rgba(212,175,55,0.35)]'
                                                        : epProgress?.completed
                                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:border-emerald-400/60'
                                                            : pct > 0
                                                                ? 'bg-primary/10 text-primary border-primary/30 hover:border-primary/60'
                                                                : 'bg-white/[0.03] text-gray-300 border-white/10 hover:bg-white/[0.08] hover:text-white'
                                                }`}
                                            >
                                                <span>{epCode}</span>
                                                {isActive ? (
                                                    <span className="text-[8px] font-extrabold uppercase tracking-wider leading-none mt-0.5">
                                                        PLAY
                                                    </span>
                                                ) : epProgress?.completed ? (
                                                    <Check className="w-2.5 h-2.5 mt-0.5 text-emerald-400" />
                                                ) : null}

                                                {!isActive && pct > 0 && pct < 100 && (
                                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                                                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredEpisodes.map((ep) => {
                                        const isActive = selectedEpisode?.id === ep.id;
                                        const epProgress = progress[ep.id];
                                        const pct = getEpisodeProgressPercent(ep.id);
                                        const subtitle = getCleanEpisodeSubtitle(ep);
                                        const epCode = String(ep.episode_number).padStart(2, '0');
                                        const displaySec =
                                            isActive && isTracking && playbackMode === 'estimated'
                                                ? Math.max(epProgress?.timestampSeconds ?? 0, liveSeconds)
                                                : epProgress?.timestampSeconds ?? 0;

                                        return (
                                            <motion.div
                                                key={ep.id}
                                                whileHover={{ x: 2 }}
                                                onClick={() => handleEpisodeSelect(ep)}
                                                className={`group p-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
                                                    isActive
                                                        ? 'bg-primary/15 border-primary/60 shadow-[0_0_24px_rgba(212,175,55,0.12)]'
                                                        : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/15'
                                                }`}
                                            >
                                                {/* Mini 16:9 Thumbnail with Progress Bar */}
                                                <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                                                    <img
                                                        src={thumbFallback}
                                                        alt={`Episódio ${epCode}`}
                                                        loading="lazy"
                                                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                                                            isActive ? 'opacity-80' : 'opacity-55 group-hover:opacity-75'
                                                        }`}
                                                    />
                                                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                                        {isActive ? (
                                                            <span className="w-6 h-6 rounded-full bg-primary text-black flex items-center justify-center shadow">
                                                                <Play className="w-3 h-3 fill-black ml-0.5" />
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] font-bold text-white/90 drop-shadow">
                                                                {epCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {pct > 0 && (
                                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/70">
                                                            <div
                                                                className={`h-full transition-all ${
                                                                    epProgress?.completed ? 'bg-emerald-400' : 'bg-primary'
                                                                }`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Episode Text Info */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4
                                                            className={`text-sm font-semibold truncate ${
                                                                isActive ? 'text-primary' : 'text-white'
                                                            }`}
                                                        >
                                                            Episódio {epCode}
                                                        </h4>
                                                        {epProgress?.completed && (
                                                            <span
                                                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 shrink-0"
                                                                title="Assistido"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                            </span>
                                                        )}
                                                    </div>

                                                    {subtitle && (
                                                        <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>
                                                    )}

                                                    <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                                                        {epProgress?.completed ? (
                                                            <span className="text-emerald-400/90">Assistido até o fim</span>
                                                        ) : displaySec >= 15 ? (
                                                            <span
                                                                className="text-primary font-medium"
                                                                title={
                                                                    epProgress?.isEstimated || playbackMode === 'estimated'
                                                                        ? 'Posição aproximada baseada no tempo assistido'
                                                                        : 'Posição exata informada pelo player'
                                                                }
                                                            >
                                                                {isActive ? 'Assistindo ' : 'Parou em '}
                                                                {epProgress?.isEstimated || (isActive && playbackMode === 'estimated')
                                                                    ? '~'
                                                                    : ''}
                                                                {formatPosition(displaySec)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500">
                                                                {isActive ? 'Reproduzindo agora' : 'Disponível em HD'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quick Mark Watched Button on Hover */}
                                                {isAuthenticated && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleToggleWatched(ep, e)}
                                                        title={
                                                            epProgress?.completed
                                                                ? 'Desmarcar como assistido'
                                                                : 'Marcar como assistido'
                                                        }
                                                        className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer ${
                                                            epProgress?.completed
                                                                ? 'text-emerald-400 hover:bg-emerald-500/15'
                                                                : 'text-gray-600 opacity-70 group-hover:opacity-100 hover:text-primary hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>

                {/* ================= EDITORIAL TABS (FICHA TÉCNICA / ELENCO / SIMILARES) ================= */}
                <section
                    className={`space-y-6 pt-2 transition-opacity duration-300 ${
                        cinemaMode ? 'opacity-25' : 'opacity-100'
                    }`}
                >
                    <div className="flex items-center gap-6 border-b border-white/10 overflow-x-auto">
                        {[
                            { id: 'overview' as const, label: 'Ficha Técnica', icon: Layers },
                            { id: 'cast' as const, label: 'Elenco', icon: Users, count: castList.length },
                            {
                                id: 'related' as const,
                                label: 'Títulos Semelhantes',
                                icon: Sparkles,
                                count: relatedSeries.length,
                            },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const active = activeInfoTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveInfoTab(tab.id)}
                                    className={`relative pb-3.5 text-sm font-semibold whitespace-nowrap inline-flex items-center gap-2 transition cursor-pointer ${
                                        active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-gray-500'}`} />
                                    {tab.label}
                                    {typeof tab.count === 'number' && tab.count > 0 && (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.07] text-gray-400">
                                            {tab.count}
                                        </span>
                                    )}
                                    {active && (
                                        <motion.span
                                            layoutId="series-info-tab-indicator"
                                            className="absolute inset-x-0 bottom-0 h-0.5 bg-primary rounded-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {activeInfoTab === 'overview' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div className="p-4 rounded-2xl bg-[#0d0d11] border border-white/10 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500">
                                        <Tv className="w-3.5 h-3.5 text-primary" /> Formato
                                    </div>
                                    <div className="text-sm font-semibold text-white">{typeLabel}</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-[#0d0d11] border border-white/10 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500">
                                        <Calendar className="w-3.5 h-3.5 text-primary" /> Lançamento
                                    </div>
                                    <div className="text-sm font-semibold text-white">
                                        {series.release_year || '—'}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-[#0d0d11] border border-white/10 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500">
                                        <Globe className="w-3.5 h-3.5 text-primary" /> País
                                    </div>
                                    <div className="text-sm font-semibold text-white">
                                        {series.country || 'Ásia'}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-[#0d0d11] border border-white/10 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500">
                                        <Layers className="w-3.5 h-3.5 text-primary" /> Status &amp; Eps
                                    </div>
                                    <div className="text-sm font-semibold text-emerald-400">
                                        {series.status || 'Disponível'} • {episodes.length} ep
                                        {episodes.length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>

                            {series.description && (
                                <div className="p-5 rounded-2xl bg-[#0d0d11] border border-white/10 space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary">
                                        Sinopse Completa
                                    </h4>
                                    <p className="text-sm text-gray-300 leading-relaxed">{series.description}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeInfoTab === 'cast' && (
                        <div>
                            {castList.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {castList.map((member) => {
                                        const initials = member
                                            .split(/\s+/)
                                            .slice(0, 2)
                                            .map((p) => p[0]?.toUpperCase() || '')
                                            .join('');
                                        return (
                                            <div
                                                key={member}
                                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0d0d11] border border-white/10 hover:border-primary/40 transition"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-amber-900/40 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                    {initials || '★'}
                                                </div>
                                                <span className="text-sm font-medium text-gray-100 truncate">
                                                    {member}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 rounded-2xl bg-[#0d0d11] border border-white/10 text-center text-sm text-gray-500">
                                    Informações de elenco ainda não cadastradas para este título.
                                </div>
                            )}
                        </div>
                    )}

                    {activeInfoTab === 'related' && (
                        <div>
                            {relatedSeries.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {relatedSeries.map((item) => (
                                        <Link
                                            key={item.id}
                                            to={`/series/${item.slug || item.id}`}
                                            className="group rounded-2xl overflow-hidden bg-[#0d0d11] border border-white/10 hover:border-primary/50 transition-all hover:-translate-y-0.5 flex flex-col"
                                        >
                                            <div className="aspect-video relative overflow-hidden bg-black">
                                                <img
                                                    src={getOptimizedImageUrl(
                                                        item.banner_image || item.cover_image,
                                                        'thumbnail',
                                                    )}
                                                    alt={item.title}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-[10px] font-bold text-primary border border-primary/30">
                                                    {TYPE_LABELS[item.type] || item.type}
                                                </span>
                                            </div>
                                            <div className="p-3 space-y-1">
                                                <h4 className="text-sm font-semibold text-white group-hover:text-primary transition truncate">
                                                    {item.title}
                                                </h4>
                                                <p className="text-xs text-gray-400 truncate">
                                                    {item.release_year} • {item.country}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 rounded-2xl bg-[#0d0d11] border border-white/10 text-center text-sm text-gray-500">
                                    Nenhum título semelhante encontrado no momento.
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* ================= TRAILER LIGHTBOX MODAL ================= */}
            <AnimatePresence>
                {trailerOpen && trailerEmbed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
                        onClick={() => setTrailerOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-4xl rounded-2xl overflow-hidden border border-white/15 bg-[#0a0a0d] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Film className="w-4 h-4 text-primary shrink-0" />
                                    <h3 className="text-sm font-bold text-white truncate">
                                        Trailer — {series.title}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTrailerOpen(false)}
                                    aria-label="Fechar trailer"
                                    className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="aspect-video bg-black">
                                <iframe
                                    src={trailerEmbed.src}
                                    title={`Trailer de ${series.title}`}
                                    className="w-full h-full"
                                    frameBorder="0"
                                    allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================= PLAYBACK REPORT MODAL ================= */}
            {reportOpen && selectedEpisode && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setReportOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d11] p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Reportar problema</h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    Episódio {String(selectedEpisode.episode_number).padStart(2, '0')} · {series.title}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReportOpen(false)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer"
                                aria-label="Fechar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {reportSent ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                                <div className="flex items-center gap-2 font-semibold">
                                    <Check className="h-4 w-4" /> Relatório enviado
                                </div>
                                <p className="mt-1 text-emerald-300/75">
                                    Obrigado. A equipe poderá verificar essa fonte no painel administrativo.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setReportOpen(false)}
                                    className="mt-4 rounded-xl bg-emerald-500/20 px-4 py-2 font-medium hover:bg-emerald-500/30 transition cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submitPlaybackReport} className="space-y-4">
                                <label className="block text-sm text-gray-300">
                                    Tipo do problema
                                    <select
                                        value={reportReason}
                                        onChange={(event) => setReportReason(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white outline-none focus:border-primary/60"
                                    >
                                        <option value="video_not_playing" className="bg-neutral-900">Vídeo não abre</option>
                                        <option value="wrong_episode" className="bg-neutral-900">Episódio incorreto</option>
                                        <option value="audio_or_subtitle" className="bg-neutral-900">Áudio ou legenda incorretos</option>
                                        <option value="poor_quality" className="bg-neutral-900">Qualidade ruim</option>
                                        <option value="removed_link" className="bg-neutral-900">Link removido</option>
                                        <option value="other" className="bg-neutral-900">Outro problema</option>
                                    </select>
                                </label>
                                <label className="block text-sm text-gray-300">
                                    Detalhes <span className="text-gray-500">(opcional)</span>
                                    <textarea
                                        value={reportDescription}
                                        onChange={(event) => setReportDescription(event.target.value)}
                                        maxLength={500}
                                        rows={3}
                                        placeholder="Conte o que aconteceu…"
                                        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white placeholder:text-gray-600 outline-none focus:border-primary/60"
                                    />
                                </label>
                                {reportError && (
                                    <p className="text-sm text-red-400">
                                        Não foi possível enviar agora. Tente novamente em instantes.
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={reporting}
                                    className="w-full rounded-xl bg-primary px-4 py-2.5 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                >
                                    {reporting ? 'Enviando…' : 'Enviar relatório'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
