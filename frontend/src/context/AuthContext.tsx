import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';

interface UserProfile {
    id: number;
    name: string;
    avatar_url: string;
}

interface AuthContextType {
    user: any | null;
    profiles: UserProfile[];
    currentProfile: UserProfile | null;
    login: (token: string) => void;
    logout: () => void;
    selectProfile: (profile: UserProfile) => void;
    fetchProfiles: () => Promise<void>;
    isAuthenticated: boolean;
    isLoading: boolean;
    myListIds: number[];
    myLikeIds: number[];
    updateLists: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any | null>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [myListIds, setMyListIds] = useState<number[]>([]);
    const [myLikeIds, setMyLikeIds] = useState<number[]>([]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsAuthenticated(true);
            refreshUserData();
        } else {
            setIsLoading(false);
        }
    }, []);

    const fetchProfiles = async () => {
        try {
            const res = await api.get('/users/profiles');
            const list = res.data || [];
            setProfiles(list);

            const storedProfileId = localStorage.getItem('current_profile_id');
            let profileToSelect = null;
            if (storedProfileId && list.length > 0) {
                profileToSelect = list.find((p: any) => p.id === parseInt(storedProfileId));
            }
            if (!profileToSelect && list.length > 0) {
                profileToSelect = list[0];
            }

            if (profileToSelect) {
                setCurrentProfile(profileToSelect);
                localStorage.setItem('current_profile_id', profileToSelect.id.toString());
            }
        } catch (error) {
            console.error("Failed to fetch profiles", error);
        }
    };

    const refreshUserData = async () => {
        try {
            const userRes = await api.get('/users/me');
            setUser(userRes.data);
            await fetchProfiles();
            await updateLists();
        } catch (error: any) {
            console.error("Failed to fetch user data", error);
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                logout();
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (token: string) => {
        localStorage.setItem('token', token);
        setIsAuthenticated(true);
        await refreshUserData();
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('current_profile_id');
        setIsAuthenticated(false);
        setUser(null);
        setProfiles([]);
        setCurrentProfile(null);
        setMyListIds([]);
        setMyLikeIds([]);
    };

    const selectProfile = async (profile: UserProfile) => {
        setCurrentProfile(profile);
        localStorage.setItem('current_profile_id', profile.id.toString());
        // Reload lists for this profile
        await updateLists();
    };

    const updateLists = async () => {
        try {
            const [listRes, likesRes] = await Promise.all([
                api.get('/users/me/list'),
                api.get('/users/me/likes')
            ]);
            setMyListIds(listRes.data.map((item: any) => item.id));
            setMyLikeIds(likesRes.data.map((item: any) => item.id));
        } catch (error) {
            console.error("Failed to update lists", error);
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            profiles,
            currentProfile,
            login,
            logout,
            selectProfile,
            fetchProfiles,
            isAuthenticated,
            isLoading,
            myListIds,
            myLikeIds,
            updateLists
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

