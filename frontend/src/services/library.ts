import { getSeriesByIds } from './api';
import {
    getRecentlyWatched,
    listLikes,
    listMyList,
} from './userData';
import type { Series } from '../types/models';

/**
 * Joins the two halves of the app: the ids a profile owns in Firestore and the
 * catalog rows that live in the FastAPI backend.
 */

export async function fetchMyListSeries(uid: string, profileId: string): Promise<Series[]> {
    return getSeriesByIds(await listMyList(uid, profileId));
}

export async function fetchLikedSeries(uid: string, profileId: string): Promise<Series[]> {
    return getSeriesByIds(await listLikes(uid, profileId));
}

/** Distinct series from the watch history, most recently watched first. */
export async function fetchContinueWatching(uid: string, profileId: string): Promise<Series[]> {
    const entries = await getRecentlyWatched(uid, profileId, 40);
    const seen = new Set<number>();
    const ordered: number[] = [];
    for (const entry of entries) {
        if (!seen.has(entry.seriesId)) {
            seen.add(entry.seriesId);
            ordered.push(entry.seriesId);
        }
    }
    return getSeriesByIds(ordered);
}
