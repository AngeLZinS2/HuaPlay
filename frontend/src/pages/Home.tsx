import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import { useModal } from '../context/ModalContext'; // Import useModal
import SeriesRow from '../components/SeriesRow';
import api from '../services/api';

export default function Home() {
    const [series, setSeries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { openModal } = useModal(); // Use global modal

    useEffect(() => {
        const fetchSeries = async () => {
            try {
                const response = await api.get('/series/');
                const mappedSeries = response.data.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    image: item.cover_image || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
                    banner_image: item.banner_image,
                    banner: item.banner_image,
                    match: "98% Relevante",
                    duration: `${item.release_year}`,
                    genre: item.genre,
                    description: item.description,
                    trailer_url: item.trailer_url,
                    release_year: item.release_year,
                    cast: item.cast || "Elenco não informado",
                    moods: "Envolvente, Emocionante",
                }));
                setSeries(mappedSeries);
            } catch (error) {
                console.error("Failed to fetch series:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSeries();
    }, []);

    const handleOpenModal = (seriesItem: any) => {
        openModal(seriesItem);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden">
            <Hero />

            <div className="relative z-10 -mt-12 space-y-12">
                {series.length > 0 ? (
                    <>
                        <SeriesRow title="Em Alta" series={series} onOpenModal={handleOpenModal} />
                        <SeriesRow title="Novos Lançamentos" series={[...series].reverse()} onOpenModal={handleOpenModal} />
                        <SeriesRow title="Séries Adicionadas Recentemente" series={series} onOpenModal={handleOpenModal} />
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-20">
                        Nenhuma série encontrada. O administrador precisa adicionar conteúdo.
                    </div>
                )}
            </div>
        </div>
    );
}
