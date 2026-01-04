import axios from 'axios';

const api = axios.create({
    baseURL: `http://${window.location.hostname}:8000`,
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const profileId = localStorage.getItem('current_profile_id');
        if (profileId) {
            config.headers['X-Profile-ID'] = profileId;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;

export const getActors = async (gender?: string) => {
    const response = await api.get('/actors/', { params: { gender } });
    return response.data;
};

export const createActor = async (actor: { name: string; image_url: string }) => {
    const response = await api.post('/actors/', actor);
    return response.data;
};

export const updateActor = async (id: number, actor: { name: string; image_url: string }) => {
    const response = await api.put(`/actors/${id}`, actor);
    return response.data;
};

export const deleteActor = async (id: number) => {
    await api.delete(`/actors/${id}`);
};

export const getActor = async (id: number) => {
    const response = await api.get(`/actors/${id}`);
    return response.data;
};

export const getMyList = async () => {
    const response = await api.get('/users/me/list');
    return response.data;
};

export const addToList = async (seriesId: number) => {
    const response = await api.post(`/users/me/list/${seriesId}`);
    return response.data;
};

export const removeFromList = async (seriesId: number) => {
    await api.delete(`/users/me/list/${seriesId}`);
};

export const getMyLikes = async () => {
    const response = await api.get('/users/me/likes');
    return response.data;
};

export const likeSeries = async (seriesId: number) => {
    const response = await api.post(`/users/me/likes/${seriesId}`);
    return response.data;
};

export const unlikeSeries = async (seriesId: number) => {
    await api.delete(`/users/me/likes/${seriesId}`);
};

export const getMe = async () => {
    const response = await api.get('/users/me');
    return response.data;
};

export const getAllSeries = async () => {
    const response = await api.get('/series/');
    return response.data;
};
export const updateProfile = async (id: number, profile: { name?: string; avatar_url?: string }) => {
    const response = await api.put(`/users/profiles/${id}`, profile);
    return response.data;
};
