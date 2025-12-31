import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000',
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
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
