import type { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

/**
 * Per-user data in Firestore. The catalog (series, episodes, actors) stays in
 * the FastAPI backend — Firestore holds only what belongs to a signed-in user,
 * under users/{uid}/..., which is exactly what firestore.rules guards.
 *
 * The Firestore SDK (~330KB) is loaded lazily on first call so anonymous
 * visitors browsing the public catalog never pay its download/parse cost.
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

async function loadFs() {
    const [fs, { getFirestoreDb }] = await Promise.all([
        import('firebase/firestore'),
        import('./firebase'),
    ]);
    const db = await getFirestoreDb();
    return { fs, db };
}

// ---------------------------------------------------------------- user doc

/** Creates or refreshes users/{uid}. Safe to call on every sign-in. */
export async function ensureUserDoc(user: User): Promise<void> {
    const { fs, db } = await loadFs();
    const ref = fs.doc(db, 'users', user.uid);
    const snap = await fs.getDoc(ref);
    const displayName = user.displayName || user.email?.split('@')[0] || 'Usuario';

    if (!snap.exists()) {
        await fs.setDoc(ref, {
            email: user.email ?? '',
            displayName,
            ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
            createdAt: fs.serverTimestamp(),
            updatedAt: fs.serverTimestamp(),
        });
        return;
    }
    // email and createdAt are immutable per the security rules, so they are
    // deliberately re-sent unchanged rather than omitted.
    await fs.setDoc(ref, {
        email: snap.data().email,
        displayName,
        ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
        createdAt: snap.data().createdAt,
        updatedAt: fs.serverTimestamp(),
    });
}

// ---------------------------------------------------------------- profiles

export const DEFAULT_PROFILE_ID = 'default';

// Singleflight cache to prevent concurrent bootstrap calls for the same UID in this client runtime
const bootstrapInFlight = new Map<string, Promise<UserProfile[]>>();

export async function listProfiles(uid: string): Promise<UserProfile[]> {
    const { fs, db } = await loadFs();
    const profilesCol = fs.collection(db, 'users', uid, 'profiles');
    const snap = await fs.getDocs(fs.query(profilesCol, fs.orderBy('createdAt', 'asc')));
    return snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        avatarUrl: d.data().avatarUrl ?? null,
    }));
}

/**
 * Returns existing profiles or safely bootstraps a default profile without duplication.
 *
 * Employs:
 * 1. Singleflight map per UID to coalesce simultaneous in-app calls.
 * 2. Deterministic default profile ID ('default') and Firestore transaction
 *    to prevent concurrent multi-device race conditions.
 * 3. Never deletes, alters, or hides existing profiles.
 */
export async function listOrCreateProfiles(user: User): Promise<UserProfile[]> {
    const uid = user.uid;
    const inflight = bootstrapInFlight.get(uid);
    if (inflight) {
        return inflight;
    }

    const task = (async () => {
        try {
            const existing = await listProfiles(uid);
            if (existing.length > 0) {
                return existing;
            }

            const { fs, db } = await loadFs();
            const defaultRef = fs.doc(db, 'users', uid, 'profiles', DEFAULT_PROFILE_ID);
            const defaultName = user.displayName || user.email?.split('@')[0] || 'Principal';
            const defaultAvatar = user.photoURL || DEFAULT_AVATAR;

            await fs.runTransaction(db, async (txn) => {
                const snap = await txn.get(defaultRef);
                if (!snap.exists()) {
                    txn.set(defaultRef, {
                        name: defaultName,
                        avatarUrl: defaultAvatar,
                        createdAt: fs.serverTimestamp(),
                    });
                }
            });

            const refreshed = await listProfiles(uid);
            if (refreshed.length > 0) {
                return refreshed;
            }
            return [{
                id: DEFAULT_PROFILE_ID,
                name: defaultName,
                avatarUrl: defaultAvatar,
            }];
        } finally {
            bootstrapInFlight.delete(uid);
        }
    })();

    bootstrapInFlight.set(uid, task);
    return task;
}

export async function createProfile(
    uid: string,
    data: { name: string; avatarUrl?: string | null },
): Promise<UserProfile> {
    const existing = await listProfiles(uid);
    if (existing.length >= MAX_PROFILES) {
        throw new Error('Maximo de ' + MAX_PROFILES + ' perfis por conta');
    }
    const { fs, db } = await loadFs();
    const ref = fs.doc(fs.collection(db, 'users', uid, 'profiles'));
    await fs.setDoc(ref, {
        name: data.name,
        avatarUrl: data.avatarUrl || DEFAULT_AVATAR,
        createdAt: fs.serverTimestamp(),
    });
    return { id: ref.id, name: data.name, avatarUrl: data.avatarUrl || DEFAULT_AVATAR };
}

export async function updateProfile(
    uid: string,
    profileId: string,
    data: { name?: string; avatarUrl?: string | null },
): Promise<void> {
    const { fs, db } = await loadFs();
    const ref = fs.doc(db, 'users', uid, 'profiles', profileId);
    const snap = await fs.getDoc(ref);
    if (!snap.exists()) throw new Error('Perfil nao encontrado');
    const current = snap.data();
    // The rules validate the whole document on update, so resend every field.
    await fs.setDoc(ref, {
        name: data.name ?? current.name,
        avatarUrl: data.avatarUrl ?? current.avatarUrl ?? DEFAULT_AVATAR,
        createdAt: current.createdAt,
    });
}

export async function deleteProfile(uid: string, profileId: string): Promise<void> {
    const { fs, db } = await loadFs();
    await fs.deleteDoc(fs.doc(db, 'users', uid, 'profiles', profileId));
}

// ---------------------------------------------------- likes and my list

async function listSeriesIds(uid: string, profileId: string, name: string): Promise<number[]> {
    const { fs, db } = await loadFs();
    const snap = await fs.getDocs(fs.collection(db, 'users', uid, 'profiles', profileId, name));
    return snap.docs.map((d) => d.data().seriesId as number).filter((n) => Number.isFinite(n));
}

async function addSeriesRef(uid: string, profileId: string, name: string, seriesId: number) {
    const { fs, db } = await loadFs();
    await fs.setDoc(fs.doc(db, 'users', uid, 'profiles', profileId, name, String(seriesId)), {
        seriesId,
        createdAt: fs.serverTimestamp(),
    });
}

async function deleteSeriesRef(uid: string, profileId: string, name: string, seriesId: number) {
    const { fs, db } = await loadFs();
    await fs.deleteDoc(fs.doc(db, 'users', uid, 'profiles', profileId, name, String(seriesId)));
}

export const listLikes = (uid: string, profileId: string) => listSeriesIds(uid, profileId, 'likes');
export const likeSeries = (uid: string, profileId: string, seriesId: number) =>
    addSeriesRef(uid, profileId, 'likes', seriesId);
export const unlikeSeries = (uid: string, profileId: string, seriesId: number) =>
    deleteSeriesRef(uid, profileId, 'likes', seriesId);

export const listMyList = (uid: string, profileId: string) =>
    listSeriesIds(uid, profileId, 'myList');
export const addToMyList = (uid: string, profileId: string, seriesId: number) =>
    addSeriesRef(uid, profileId, 'myList', seriesId);
export const removeFromMyList = (uid: string, profileId: string, seriesId: number) =>
    deleteSeriesRef(uid, profileId, 'myList', seriesId);

// ------------------------------------------------------------ watch history

export async function recordWatch(
    uid: string,
    profileId: string,
    entry: Omit<WatchEntry, 'updatedAt'>,
): Promise<void> {
    const { fs, db } = await loadFs();
    await fs.setDoc(fs.doc(db, 'users', uid, 'profiles', profileId, 'watchHistory', String(entry.episodeId)), {
        episodeId: entry.episodeId,
        seriesId: entry.seriesId,
        episodeNumber: entry.episodeNumber,
        timestampSeconds: Math.max(0, Math.min(86400, Math.floor(entry.timestampSeconds))),
        completed: entry.completed,
        isEstimated: entry.isEstimated,
        updatedAt: fs.serverTimestamp(),
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
    const { fs, db } = await loadFs();
    const snap = await fs.getDocs(
        fs.query(
            fs.collection(db, 'users', uid, 'profiles', profileId, 'watchHistory'),
            fs.where('seriesId', '==', seriesId),
        ),
    );
    return snap.docs.map((d) => toEntry(d.data()));
}

/** Most recently touched episodes, newest first — the "continue watching" feed. */
export async function getRecentlyWatched(
    uid: string,
    profileId: string,
    max = 20,
): Promise<WatchEntry[]> {
    const { fs, db } = await loadFs();
    const snap = await fs.getDocs(
        fs.query(
            fs.collection(db, 'users', uid, 'profiles', profileId, 'watchHistory'),
            fs.orderBy('updatedAt', 'desc'),
            fs.limit(max),
        ),
    );
    return snap.docs.map((d) => toEntry(d.data()));
}
