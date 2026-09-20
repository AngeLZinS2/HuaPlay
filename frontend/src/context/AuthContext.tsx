import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile as updateAuthProfile,
    type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { getBackendIdentity } from '../services/api';
import {
    ensureUserDoc,
    listLikes,
    listMyList,
    listOrCreateProfiles,
    type UserProfile,
} from '../services/userData';

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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [myListIds, setMyListIds] = useState<number[]>([]);
    const [myLikeIds, setMyLikeIds] = useState<number[]>([]);

    const uid = user?.uid ?? null;

    const updateLists = useCallback(async () => {
        if (!uid || !currentProfile) {
            setMyListIds([]);
            setMyLikeIds([]);
            return;
        }
        try {
            const [list, likes] = await Promise.all([
                listMyList(uid, currentProfile.id),
                listLikes(uid, currentProfile.id),
            ]);
            setMyListIds(list);
            setMyLikeIds(likes);
        } catch (error) {
            console.error('Failed to load list/likes from Firestore', error);
        }
    }, [uid, currentProfile]);

    const fetchProfiles = useCallback(async () => {
        if (!user) return;
        try {
            const list = await listOrCreateProfiles(user);
            setProfiles(list);

            const storedId = localStorage.getItem(PROFILE_KEY);
            const selected = list.find((p) => p.id === storedId) ?? list[0] ?? null;
            setCurrentProfile(selected);
            if (selected) localStorage.setItem(PROFILE_KEY, selected.id);
        } catch (error) {
            console.error('Failed to load profiles from Firestore', error);
        }
    }, [user]);

    // Firebase owns the session: it restores it from storage and refreshes the
    // ID token on its own, so there is no token handling left in this app.
    useEffect(() => {
        return onAuthStateChanged(auth, async (fbUser) => {
            setUser(fbUser);
            if (!fbUser) {
                setIsAdmin(false);
                setProfiles([]);
                setCurrentProfile(null);
                setMyListIds([]);
                setMyLikeIds([]);
                localStorage.removeItem(PROFILE_KEY);
                setIsLoading(false);
                return;
            }
            try {
                await ensureUserDoc(fbUser);
            } catch (error) {
                console.error('Failed to create the Firestore user document', error);
            }
            try {
                // Only the catalog backend can say whether this identity is an
                // admin — never a client-held value, which the user could edit.
                const identity = await getBackendIdentity();
                setIsAdmin(identity.is_admin);
            } catch (error) {
                console.error('Failed to resolve admin status', error);
                setIsAdmin(false);
            } finally {
                setIsLoading(false);
            }
        });
    }, []);

    useEffect(() => {
        if (user) void fetchProfiles();
    }, [user, fetchProfiles]);

    useEffect(() => {
        void updateLists();
    }, [updateLists]);

    const signInWithEmail = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
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
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
            await updateAuthProfile(cred.user, { displayName: fullName });
        }
        await seedUserDoc(cred.user);
    };

    const signInWithGoogle = async () => {
        const result = await signInWithPopup(auth, googleProvider);
        GoogleAuthProvider.credentialFromResult(result);
        await seedUserDoc(result.user);
    };

    const logout = async () => {
        await signOut(auth);
    };

    const selectProfile = (profile: UserProfile) => {
        setCurrentProfile(profile);
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
