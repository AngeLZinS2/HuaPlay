import axios from 'axios';
import { auth } from './firebase';
import type {
    Actor,
    ActorCreate,
    Episode,
    EpisodeCreate,
    Recommendations,
    Series,
    SeriesCreate,
    SeriesStats,
} from '../types/models';

// In a Capacitor native app, window.location.hostname is "localhost" (inside WebView),
// so we fall back to the known server IP set via VITE_API_URL env variable.
// For local dev APK, set VITE_API_URL=http://192.168.0.18:8000 in .env
// For production, set VITE_API_URL=https://your-server.com
const getBaseURL = () => {
  // Prefer explicit env variable (e.g., for APK builds)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Web: use the host the page was served from
  const hostname = window.location.hostname;
  // If running inside Capacitor (native WebView) — hostname is 'localhost'
  // but the backend is not on the device itself, so use the default dev IP.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://192.168.0.36:8000';
  }
  return `http://${hostname}:8000`;
};

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 10000, // 10s timeout — prevents hanging when backend is restarting
});

// Attach the Firebase ID token. getIdToken() serves a cached token and only
// hits the network when it is close to expiring, so this is cheap per request.
api.interceptors.request.use(
    async (config) => {
        const user = auth.currentUser;
        if (user) {
            try {
                config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
            } catch (error) {
                console.error('Failed to attach Firebase ID token', error);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// A 401 from the catalog API means this backend rejected the Firebase token.
// Firebase itself refreshes tokens, so the session is not torn down here — the
// caller decides what to do, and a stale token resolves on the next refresh.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('Catalog API rejected the Firebase ID token');
        }
        return Promise.reject(error);
    }
);

export default api;

export const getActors = async (gender?: string): Promise<Actor[]> => {
    const response = await api.get<Actor[]>('/actors/', { params: { gender } });
    return response.data;
};

export const getActor = async (id: number): Promise<Actor> => {
    const response = await api.get<Actor>(`/actors/${id}`);
    return response.data;
};

export const createActor = async (actor: ActorCreate): Promise<Actor> => {
    const response = await api.post<Actor>('/actors/', actor);
    return response.data;
};

export const updateActor = async (id: number, actor: ActorCreate): Promise<Actor> => {
    const response = await api.put<Actor>(`/actors/${id}`, actor);
    return response.data;
};

export const deleteActor = async (id: number): Promise<void> => {
    await api.delete(`/actors/${id}`);
};










export interface SeriesQuery {
    skip?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    country?: string;
    release_year?: number;
    genre?: string;
    is_featured?: boolean;
}

export const getSeries = async (params?: SeriesQuery): Promise<Series[]> => {
    const response = await api.get<Series[]>('/series/', { params });
    return response.data;
};

/** Same query, but also returns the X-Total-Count the backend already sends. */
export const getSeriesPage = async (params?: SeriesQuery): Promise<{ items: Series[]; total: number }> => {
    const response = await api.get<Series[]>('/series/', { params });
    const total = Number(response.headers['x-total-count'] ?? response.data.length);
    return { items: response.data, total: Number.isNaN(total) ? response.data.length : total };
};

export const getAllSeries = async (): Promise<Series[]> => {
    const response = await api.get<Series[]>('/series/');
    return response.data;
};

export const getSeriesById = async (ident: number | string): Promise<Series> => {
    const response = await api.get<Series>(`/series/${ident}`);
    return response.data;
};

export const createSeries = async (series: SeriesCreate): Promise<Series> => {
    const response = await api.post<Series>('/series/', series);
    return response.data;
};

export const updateSeries = async (id: number, series: SeriesCreate): Promise<Series> => {
    const response = await api.put<Series>(`/series/${id}`, series);
    return response.data;
};

export const deleteSeries = async (id: number): Promise<void> => {
    await api.delete(`/series/${id}`);
};

export const getEpisodes = async (ident: number | string): Promise<Episode[]> => {
    const response = await api.get<Episode[]>(`/series/${ident}/episodes`);
    return response.data;
};

export const createEpisode = async (seriesId: number, episode: EpisodeCreate): Promise<Episode> => {
    const response = await api.post<Episode>(`/series/${seriesId}/episodes`, episode);
    return response.data;
};

export const updateEpisode = async (episodeId: number, episode: EpisodeCreate): Promise<Episode> => {
    const response = await api.put<Episode>(`/series/episodes/${episodeId}`, episode);
    return response.data;
};

export const deleteEpisode = async (episodeId: number): Promise<void> => {
    await api.delete(`/series/episodes/${episodeId}`);
};

export const getStats = async (): Promise<SeriesStats> => {
    const response = await api.get<SeriesStats>('/series/stats');
    return response.data;
};

export const getRecommendations = async (): Promise<Recommendations> => {
    const response = await api.get<Recommendations>('/series/recommendations');
    return response.data;
};




/**
 * Hydrate several catalog series in one request.
 *
 * Firestore stores only ids for likes / my-list / history, so they must be
 * resolved against the catalog. This endpoint does not bump views_count, unlike
 * fetching each series individually would.
 */
export const getSeriesByIds = async (ids: number[]): Promise<Series[]> => {
    const unique = [...new Set(ids)].filter((n) => Number.isFinite(n));
    if (unique.length === 0) return [];
    const response = await api.get<Series[]>('/series/by-ids', {
        params: { ids: unique.join(',') },
    });
    return response.data;
};

export interface BackendIdentity {
    uid: string;
    email: string | null;
    name: string | null;
    email_verified: boolean;
    is_admin: boolean;
}

/**
 * Ask the catalog backend who it thinks we are. The Firebase SDK already knows
 * the identity; what it cannot know is whether THIS backend grants admin, which
 * is decided server-side and never from anything the client holds.
 */
export const getBackendIdentity = async (): Promise<BackendIdentity> => {
    const response = await api.get<BackendIdentity>('/auth/me');
    return response.data;
};

export interface RecommendationSignals {
    watched_ids: number[];
    liked_ids: number[];
    listed_ids: number[];
    recent_series_id?: number | null;
}

export const getPersonalizedRecommendations = async (
    signals: RecommendationSignals,
): Promise<Recommendations> => {
    const response = await api.post<Recommendations>('/series/recommendations', signals);
    return response.data;
};
