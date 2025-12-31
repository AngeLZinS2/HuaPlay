import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ActorCard from '../components/ActorCard';
import { getActors } from '../services/api';
import type { Actor } from '../types';

export default function Actors({ gender, title }: { gender?: string, title?: string }) {
    const [actors, setActors] = useState<Actor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActors = async () => {
            try {
                const data = await getActors(gender);
                setActors(data);
            } catch (error) {
                console.error("Failed to fetch actors:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActors();
    }, [gender]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            <Navbar />

            <main className="pt-24 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-cursive text-white mb-2" style={{ fontFamily: 'Great Vibes, cursive' }}>{title || 'Atores'}</h1>
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent max-w-md mx-auto"></div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-500">Carregando...</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 justify-items-center">
                        {actors.map((actor) => (
                            <div key={actor.id} className="w-full max-w-[180px]">
                                <Link to={`/actors/${actor.id}`}>
                                    <ActorCard actor={actor} />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
