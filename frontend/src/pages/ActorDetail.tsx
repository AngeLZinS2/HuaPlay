import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getActor } from '../services/api'; // We'll add this next
import { ArrowLeft, Instagram, Twitter, Facebook, Link2 } from 'lucide-react';

interface Actor {
    id: number;
    name: string;
    real_name?: string;
    gender: string;
    image_url: string;
    bio?: string;
    birth_date?: string;
    social_media?: string; // Comma separated links
}

const ActorDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [actor, setActor] = useState<Actor | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActor = async () => {
            if (id) {
                try {
                    const data = await getActor(parseInt(id));
                    setActor(data);
                } catch (error) {
                    console.error("Failed to fetch actor", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchActor();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!actor) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
                <p>Ator não encontrado.</p>
            </div>
        );
    }

    // Helper to parse social media links (simple implementation)
    // Helper to parse social media links
    const getSocialIcon = (link: string) => {
        const iconClass = "w-5 h-5";

        if (link.includes('instagram')) return <Instagram className={iconClass} />;
        if (link.includes('twitter') || link.includes('x.com')) return <Twitter className={iconClass} />;
        if (link.includes('facebook')) return <Facebook className={iconClass} />;

        // TikTok / Douyin
        if (link.includes('tiktok') || link.includes('douyin')) {
            return (
                <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
            );
        }

        // Weibo
        if (link.includes('weibo')) {
            return (
                <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
                    <path d="M21.9 5.9c-.2-.6-.7-1-1.3-1.2-.6-.2-1.3-.1-1.8.2-.5.3-1 .7-1.4 1.2-.4.5-.8 1-1.1 1.6-.3.6-.5 1.2-.7 1.8-.1.6-.1 1.2-.1 1.8.1 4-2.8 8.1-7.4 9.1-3.6.8-7.1-1.2-7.8-4.5-.7-3.3 1.2-6.5 4.3-8.3.6-.4 1.2-.7 1.9-.9 1.1-.3 2.3-.3 3.4-.1.3.1.5.3.6.6.1.3 0 .7-.3.8-.4.2-.9.3-1.4.3-1 .1-2 .3-2.9.7-2.6 1.1-4.3 3.8-3.7 6.6.6 2.7 3.4 4.4 6.4 3.7 3.8-.8 6.1-4.2 6.1-7.5v-1.1c.1-.5.3-1 .5-1.5.3-.5.6-.9 1-1.3.4-.4.9-.7 1.5-.9.6-.2 1.2-.2 1.8 0 .6.2 1 .6 1.3 1.1zm-8.2 5.5c-.3.1-.6 0-.8-.2-.2-.2-.2-.5-.1-.8.1-.3.4-.4.7-.3.3.1.4.4.3.7-.1.3-.3.4-.5.4zm1.5-1.6c-.6.2-1.3 0-1.6-.5-.3-.5-.2-1.2.3-1.5.5-.3 1.2-.2 1.5.3.4.6.3 1.3-.2 1.7zm1.8-2.5c-.8.3-1.8 0-2.2-.8-.4-.8-.1-1.7.7-2 .8-.3 1.8 0 2.2.8.4.8.1 1.7-.7 2z" />
                </svg>
            );
        }

        // default link
        return <Link2 className={iconClass} />;
    };

    const socialLinks = actor.social_media ? actor.social_media.split(',') : [];

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-x-hidden">
            {/* Hero Section */}
            <div className="relative w-full min-h-[70vh] flex items-center pt-20 pb-12 overflow-hidden">
                {/* Atmospheric Background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-[#0a0a0a]" />
                    <img
                        src={actor.image_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-30 blur-3xl scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
                    <Link to={actor.gender === 'Male' ? '/actors' : '/actresses'} className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8 group">
                        <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Voltar
                    </Link>

                    <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-start">
                        {/* Image Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative shrink-0 w-full max-w-[300px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-white/10 group"
                        >
                            <img
                                src={actor.image_url}
                                alt={actor.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>

                        {/* Info */}
                        <div className="flex-1 pt-4">
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400"
                            >
                                {actor.name}
                            </motion.h1>

                            {actor.real_name && (
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-2xl text-purple-400 font-light mb-6"
                                >
                                    {actor.real_name}
                                </motion.p>
                            )}

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="flex flex-wrap gap-4 items-center mb-8"
                            >
                                {actor.birth_date && (
                                    <div className="px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                                        <span className="text-gray-400 text-sm block">Nascimento</span>
                                        <span className="text-white">{actor.birth_date}</span>
                                    </div>
                                )}

                                <div className="px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                                    <span className="text-gray-400 text-sm block">Gênero</span>
                                    <span className="text-white">{actor.gender === 'Female' ? 'Feminino' : 'Masculino'}</span>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="flex gap-3"
                            >
                                {socialLinks.map((link, idx) => (
                                    <a
                                        key={idx}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 rounded-full bg-white/5 hover:bg-purple-600 border border-white/10 hover:border-purple-500 transition-all group"
                                    >
                                        <div className="group-hover:scale-110 transition-transform">
                                            {getSocialIcon(link)}
                                        </div>
                                    </a>
                                ))}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Main Bio */}
                <div className="lg:col-span-2 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl font-bold mb-6 text-purple-400 border-l-4 border-purple-500 pl-4">Biografia</h2>
                        <div className="prose prose-invert prose-lg max-w-none text-gray-300 leading-relaxed space-y-4">
                            {actor.bio ? (
                                actor.bio.split('\n').map((paragraph, i) => (
                                    <p key={i}>{paragraph}</p>
                                ))
                            ) : (
                                <p className="italic text-gray-500">Biografia não disponível.</p>
                            )}
                        </div>
                    </motion.div>

                    {/* Gallery Placeholder - Could be implemented if we scraped specific images */}
                    {/* 
            <motion.div ... >
               <h2 ...>Galeria</h2>
               ...
            </motion.div>
            */}
                </div>

                {/* Sidebar Stats / Known For */}
                <div className="space-y-8">
                    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 sticky top-24">
                        <h3 className="text-xl font-bold mb-4 text-white">Mais Informações</h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li className="flex justify-between border-b border-white/5 pb-2">
                                <span>Nacionalidade</span>
                                <span className="text-white">Chinesa</span>
                            </li>
                            {/* Placeholder for future detailed stats */}
                            <li className="flex justify-between border-b border-white/5 pb-2">
                                <span>Ocupação</span>
                                <span className="text-white">Atriz / Modelo</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActorDetail;
