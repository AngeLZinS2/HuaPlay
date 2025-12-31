import api from './api';

export interface Series {
    id: number;
    title: string;
    description: string;
    cover_image: string;
    banner_image: string;
    genre: string;
    type: string;
    country: string;
    status: string;
    release_year: number;
    trailer_url: string;
    is_featured: boolean;
}

export const getSeries = async (search?: string) => {
    const params = search ? { search } : {};
    const response = await api.get<Series[]>('/series/', { params });
    return response.data;
};

export const getSeriesById = async (id: number) => {
    const response = await api.get<Series>(`/series/${id}`);
    return response.data;
};
