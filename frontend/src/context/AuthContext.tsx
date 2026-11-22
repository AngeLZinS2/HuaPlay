import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { getBackendIdentity, registerAuthTokenProvider } from '../services/api';
import {
    ensureUserDoc,
    listLikes,
    listMyList,
    listOrCreateProfiles,
    type UserProfile,
} from '../services/userData';
import {
    getStoredDeviceToken,
    setStoredDeviceToken,
    setStoredOptIn,
    unsubscribeDeviceToken,
} from '../services/notifications';

interface AuthContextType {
    user: User | null;
    /** Firebase uid, or null when signed out. */
    uid: string | null;
    isAdmin: boolean;
    profiles: UserProfile[];
    currentProfile: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    myListIds: number[];
    myLikeIds: number[];
    signInWithEmail: (email: string, password: string) => Promise<void>;
    registerWithEmail: (email: string, password: string, fullName?: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    selectProfile: (profile: UserProfile) => void;
    fetchProfiles: () => Promise<void>;
    updateLists: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_KEY = 'current_profile_id';
const HAS_AUTH_KEY = 'huaplay_has_auth';

function shouldBootAuthImmediately(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        if (localStorage.getItem(HAS_AUTH_KEY) === '1' || localStorage.getItem(PROFILE_KEY)) {
            return true;
        }
    } catch {
        // Ignore storage errors
    }
    const p = window.location.pathname;
    return (
        p.startsWith('/admin') ||
        p.startsWith('/login') ||
        p.startsWith('/profile') ||
        p.startsWith('/my-list') ||
        p.startsWith('/series/')
    );
}

let firebaseModulesPromise: Promise<{
    auth: Auth;
    googleProvider: import('firebase/auth').GoogleAuthProvider;
    fbAuth: typeof import('firebase/auth');
}> | null = null;

function loadFirebaseAuth() {
    if (!firebaseModulesPromise) {
        firebaseModulesPromise = Promise.all([
            import('../services/firebase'),
            import('firebase/auth'),
        ]).then(([fb, fbAuth]) => {
            registerAuthTokenProvider(async () => {
                const u = fb.auth.currentUser;
                return u ? u.getIdToken() : null;
            });
            return { auth: fb.auth, googleProvider: fb.googleProvider, fbAuth };
        });
    }
    return firebaseModulesPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(shouldBootAuthImmediately);
    const [myListIds, setMyListIds] = useState<number[]>([]);
    const [myLikeIds, setMyLikeIds] = useState<number[]>([]);

    const uid = user?.uid ?? null;

    const authInstanceRef = useRef<Auth | null>(null);
    const authSeqRef = useRef(0);
    const profileSeqRef = useRef(0);
    const listSeqRef = useRef(0);

    const updateLists = useCallback(async () => {
        const currentSeq = ++listSeqRef.current;
        const targetUid = uid;
        const targetProfileId = currentProfile?.id;

        if (!targetUid || !targetProfileId) {
            setMyListIds([]);
            setMyLikeIds([]);
            return;
        }
        try {
            const [list, likes] = await Promise.all([
                listMyList(targetUid, targetProfileId),
                listLikes(targetUid, targetProfileId),
            ]);
            if (listSeqRef.current === currentSeq && authInstanceRef.current?.currentUser?.uid === targetUid) {
                setMyListIds(list);
                setMyLikeIds(likes);
            }
        } catch (error) {
            if (listSeqRef.current === currentSeq) {
                console.error('Failed to load list/likes from Firestore', error);
            }
        }
    }, [uid, currentProfile?.id]);

    const fetchProfiles = useCallback(async () => {
        if (!user) return;
        const currentSeq = ++profileSeqRef.current;
        const targetUid = user.uid;

        try {
            const list = await listOrCreateProfiles(user);
            if (profileSeqRef.current !== currentSeq || authInstanceRef.current?.currentUser?.uid !== targetUid) return;

            setProfiles(list);

            const scopedKey = `${PROFILE_KEY}_${targetUid}`;
            const storedId = localStorage.getItem(scopedKey) || localStorage.getItem(PROFILE_KEY);
            const selected = list.find((p) => p.id === storedId) ?? list[0] ?? null;
            setCurrentProfile(selected);
            if (selected) {
                localStorage.setItem(scopedKey, selected.id);
                localStorage.setItem(PROFILE_KEY, selected.id);
            }
        } catch (error) {
            if (profileSeqRef.current === currentSeq) {
                console.error('Failed to load profiles from Firestore', error);
            }
        }
    }, [user]);

    // Firebase owns the session: boot immediately for signed-in / auth routes,
    // or defer briefly for first-time anonymous visitors browsing public pages.
    useEffect(() => {
        let disposed = false;
        let unsubscribe: (() => void) | null = null;
        let deferTimer: number | null = null;

        const initAuthListener = async () => {
            try {
                const { auth, fbAuth } = await loadFirebaseAuth();
                if (disposed) return;
                authInstanceRef.current = auth;

                unsubscribe = fbAuth.onAuthStateChanged(auth, async (fbUser) => {
                    if (disposed) return;
                    const currentSeq = ++authSeqRef.current;
                    setUser(fbUser);

                    if (!fbUser) {
                        setIsAdmin(false);
                        setProfiles([]);
                        setCurrentProfile(null);
                        setMyListIds([]);
                        setMyLikeIds([]);
                        try {
                            localStorage.removeItem(PROFILE_KEY);
                            localStorage.removeItem(HAS_AUTH_KEY);
                        } catch {
                            // Ignore storage errors
                        }
                        setIsLoading(false);
                        return;
                    }

                    try {
                        localStorage.setItem(HAS_AUTH_KEY, '1');
                    } catch {
                        // Ignore storage errors
                    }

                    setProfiles([]);
                    setCurrentProfile(null);
                    setMyListIds([]);
                    setMyLikeIds([]);

                    try {
                        await ensureUserDoc(fbUser);
                    } catch (error) {
                        console.error('Failed to create the Firestore user document', error);
                    }

                    if (disposed || authSeqRef.current !== currentSeq) return;

                    try {
                        const identity = await getBackendIdentity();
                        if (!disposed && authSeqRef.current === currentSeq) {
                            setIsAdmin(identity.is_admin);
                        }
                    } catch (error) {
                        if (!disposed && authSeqRef.current === currentSeq) {
                            console.error('Failed to resolve admin status', error);
                            setIsAdmin(false);
                        }
                    } finally {
                        if (!disposed && authSeqRef.current === currentSeq) {
                            setIsLoading(false);
                        }
                    }
                });
            } catch (error) {
                console.error('Failed to initialize Firebase Auth', error);
                if (!disposed) setIsLoading(false);
            }
        };

        if (shouldBootAuthImmediately()) {
            void initAuthListener();
        } else {
            deferTimer = window.setTimeout(() => {
                void initAuthListener();
            }, 2500);
        }

        return () => {
            disposed = true;
            if (deferTimer !== null) window.clearTimeout(deferTimer);
            if (unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (user) void fetchProfiles();
    }, [user, fetchProfiles]);

    useEffect(() => {
        void updateLists();
    }, [updateLists]);

    const signInWithEmail = async (email: string, password: string) => {
        const { auth, fbAuth } = await loadFirebaseAuth();
        authInstanceRef.current = auth;
        await fbAuth.signInWithEmailAndPassword(auth, email, password);
    };

    /** Sign-in already succeeded here; a failed profile write must not undo it. */
    const seedUserDoc = async (fbUser: User) => {
        try {
            await ensureUserDoc(fbUser);
        } catch (error) {
            console.error('Firestore: failed to write the user document', error);
        }
    };

    const registerWithEmail = async (email: string, password: string, fullName?: string) => {
        const { auth, fbAuth } = await loadFirebaseAuth();
        authInstanceRef.current = auth;
        const cred = await fbAuth.createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
            await fbAuth.updateProfile(cred.user, { displayName: fullName });
        }
        await seedUserDoc(cred.user);
    };

    const signInWithGoogle = async () => {
        const { auth, googleProvider, fbAuth } = await loadFirebaseAuth();
        authInstanceRef.current = auth;

        if (import.meta.env.MODE === 'mobile' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
            const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
            const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
            const idToken = result.credential?.idToken;
            if (!idToken) {
                throw new Error('Google sign-in did not return an ID token.');
            }
            const credential = fbAuth.GoogleAuthProvider.credential(idToken);
            const userCredential = await fbAuth.signInWithCredential(auth, credential);
            await seedUserDoc(userCredential.user);
            return;
        }

        const result = await fbAuth.signInWithPopup(auth, googleProvider, fbAuth.browserPopupRedirectResolver);
        fbAuth.GoogleAuthProvider.credentialFromResult(result);
        await seedUserDoc(result.user);
    };

    const logout = async () => {
        const storedToken = getStoredDeviceToken();
        if (storedToken) {
            try {
                await unsubscribeDeviceToken(storedToken);
            } catch (err) {
                console.warn('Failed to unsubscribe device token on logout:', err);
            }
            setStoredDeviceToken(null);
            if (uid) setStoredOptIn(false, uid);
        }

        if (uid) {
            localStorage.removeItem(`${PROFILE_KEY}_${uid}`);
        }
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(HAS_AUTH_KEY);

        if (import.meta.env.MODE === 'mobile' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
            try {
                const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
                await FirebaseAuthentication.signOut();
            } catch (err) {
                console.warn('Native Google sign-out failed or ignored:', err);
            }
        }
        const { auth, fbAuth } = await loadFirebaseAuth();
        await fbAuth.signOut(auth);
    };

    const selectProfile = (profile: UserProfile) => {
        setCurrentProfile(profile);
        if (uid) {
            localStorage.setItem(`${PROFILE_KEY}_${uid}`, profile.id);
        }
        localStorage.setItem(PROFILE_KEY, profile.id);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                uid,
                isAdmin,
                profiles,
                currentProfile,
                isAuthenticated: !!user,
                isLoading,
                myListIds,
                myLikeIds,
                signInWithEmail,
                registerWithEmail,
                signInWithGoogle,
                logout,
                selectProfile,
                fetchProfiles,
                updateLists,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
