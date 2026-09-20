import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit as fsLimit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

/**
 * Per-user data in Firestore. The catalog (series, episodes, actors) stays in
 * the FastAPI backend — Firestore holds only what belongs to a signed-in user,
 * under users/{uid}/..., which is exactly what firestore.rules guards.
 */

export interface UserProfile {
    id: string;
    name: string;
    avatarUrl?: string | null;
}

export interface WatchEntry {
    episodeId: number;
    seriesId: number;
    episodeNumber: number;
    timestampSeconds: number;
    completed: boolean;
    isEstimated: boolean;
    updatedAt?: Timestamp | null;
}

const DEFAULT_AVATAR =
    'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg';

export const MAX_PROFILES = 3;

const profilesCol = (uid: string) => collection(db, 'users', uid, 'profiles');
const profileDoc = (uid: string, profileId: string) => doc(db, 'users', uid, 'profiles', profileId);
const subCol = (uid: string, profileId: string, name: string) =>
    collection(db, 'users', uid, 'profiles', profileId, name);
const subDoc = (uid: string, profileId: string, name: string, id: string | number) =>
    doc(db, 'users', uid, 'profiles', profileId, name, String(id));

// ---------------------------------------------------------------- user doc

/** Creates or refreshes users/{uid}. Safe to call on every sign-in. */
export async function ensureUserDoc(user: User): Promise<void> {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const displayName = user.displayName || user.email?.split('@')[0] || 'Usuario';

    if (!snap.exists()) {
        await setDoc(ref, {
            email: user.email ?? '',
            displayName,
            ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return;
    }
    // email and createdAt are immutable per the security rules, so they are
    // deliberately re-sent unchanged rather than omitted.
    await setDoc(ref, {
        email: snap.data().email,
        displayName,
        ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
        createdAt: snap.data().createdAt,
        updatedAt: serverTimestamp(),
    });
}

// ---------------------------------------------------------------- profiles

export async function listProfiles(uid: string): Promise<UserProfile[]> {
    const snap = await getDocs(query(profilesCol(uid), orderBy('createdAt', 'asc')));
    return snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        avatarUrl: d.data().avatarUrl ?? null,
    }));
}

/** Returns the existing profiles, creating a default one when there are none. */
export async function listOrCreateProfiles(user: User): Promise<UserProfile[]> {
    const existing = await listProfiles(user.uid);
    if (existing.length > 0) return existing;
    const created = await createProfile(user.uid, {
        name: user.displayName || user.email?.split('@')[0] || 'Principal',
        avatarUrl: user.photoURL || DEFAULT_AVATAR,
    });
    return [created];
}

export async function createProfile(
    uid: string,
    data: { name: string; avatarUrl?: string | null },
): Promise<UserProfile> {
    const existing = await listProfiles(uid);
    if (existing.length >= MAX_PROFILES) {
        throw new Error('Maximo de ' + MAX_PROFILES + ' perfis por conta');
    }
    const ref = doc(profilesCol(uid));
    await setDoc(ref, {
        name: data.name,
        avatarUrl: data.avatarUrl || DEFAULT_AVATAR,
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, name: data.name, avatarUrl: data.avatarUrl || DEFAULT_AVATAR };
}

export async function updateProfile(
    uid: string,
    profileId: string,
    data: { name?: string; avatarUrl?: string | null },
): Promise<void> {
    const snap = await getDoc(profileDoc(uid, profileId));
    if (!snap.exists()) throw new Error('Perfil nao encontrado');
    const current = snap.data();
    // The rules validate the whole document on update, so resend every field.
    await setDoc(profileDoc(uid, profileId), {
        name: data.name ?? current.name,
        avatarUrl: data.avatarUrl ?? current.avatarUrl ?? DEFAULT_AVATAR,
        createdAt: current.createdAt,
    });
}

export async function deleteProfile(uid: string, profileId: string): Promise<void> {
    await deleteDoc(profileDoc(uid, profileId));
}

// ---------------------------------------------------- likes and my list

async function listSeriesIds(uid: string, profileId: string, name: string): Promise<number[]> {
    const snap = await getDocs(subCol(uid, profileId, name));
    return snap.docs.map((d) => d.data().seriesId as number).filter((n) => Number.isFinite(n));
}

async function addSeriesRef(uid: string, profileId: string, name: string, seriesId: number) {
    await setDoc(subDoc(uid, profileId, name, seriesId), {
        seriesId,
        createdAt: serverTimestamp(),
    });
}

export const listLikes = (uid: string, profileId: string) => listSeriesIds(uid, profileId, 'likes');
export const likeSeries = (uid: string, profileId: string, seriesId: number) =>
    addSeriesRef(uid, profileId, 'likes', seriesId);
export const unlikeSeries = (uid: string, profileId: string, seriesId: number) =>
    deleteDoc(subDoc(uid, profileId, 'likes', seriesId));

export const listMyList = (uid: string, profileId: string) =>
    listSeriesIds(uid, profileId, 'myList');
export const addToMyList = (uid: string, profileId: string, seriesId: number) =>
    addSeriesRef(uid, profileId, 'myList', seriesId);
export const removeFromMyList = (uid: string, profileId: string, seriesId: number) =>
    deleteDoc(subDoc(uid, profileId, 'myList', seriesId));

// ------------------------------------------------------------ watch history

export async function recordWatch(
    uid: string,
    profileId: string,
    entry: Omit<WatchEntry, 'updatedAt'>,
): Promise<void> {
    await setDoc(subDoc(uid, profileId, 'watchHistory', entry.episodeId), {
        episodeId: entry.episodeId,
        seriesId: entry.seriesId,
        episodeNumber: entry.episodeNumber,
        timestampSeconds: Math.max(0, Math.min(86400, Math.floor(entry.timestampSeconds))),
        completed: entry.completed,
        isEstimated: entry.isEstimated,
        updatedAt: serverTimestamp(),
    });
}

const toEntry = (data: Record<string, unknown>): WatchEntry => ({
    episodeId: data.episodeId as number,
    seriesId: data.seriesId as number,
    episodeNumber: (data.episodeNumber as number) ?? 0,
    timestampSeconds: (data.timestampSeconds as number) ?? 0,
    completed: Boolean(data.completed),
    isEstimated: Boolean(data.isEstimated),
    updatedAt: (data.updatedAt as Timestamp) ?? null,
});

/** Progress for one series. Single-field filter, so no composite index needed. */
export async function getSeriesProgress(
    uid: string,
    profileId: string,
    seriesId: number,
): Promise<WatchEntry[]> {
    const snap = await getDocs(
        query(subCol(uid, profileId, 'watchHistory'), where('seriesId', '==', seriesId)),
    );
    return snap.docs.map((d) => toEntry(d.data()));
}

/** Most recently touched episodes, newest first — the "continue watching" feed. */
export async function getRecentlyWatched(
    uid: string,
    profileId: string,
    max = 20,
): Promise<WatchEntry[]> {
    const snap = await getDocs(
        query(subCol(uid, profileId, 'watchHistory'), orderBy('updatedAt', 'desc'), fsLimit(max)),
    );
    return snap.docs.map((d) => toEntry(d.data()));
}
