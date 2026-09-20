import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { getOptimizedImageUrl } from '../utils/image';
import {
    Film,
    PlayCircle,
    CheckCircle,
    Users,
    Tv,
    Globe,
    TrendingUp,
    ArrowUpRight,
    Clock,
} from 'lucide-react';

interface Stats {
    total: number;
    ongoing: number;
    completed: number;
    types?: Record<string, number>;
}

interface RecentSeries {
    id: number;
    title: string;
    cover_image: string;
    type: string;
    status: string;
    created_at: string;
}

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

function StatCard({
    title,
    value,
    icon: Icon,
    color,
    sub,
}: {
    title: string;
    value: number;
    icon: any;
    color: string;
    sub?: string;
}) {
    return (
        <motion.div
            variants={cardVariants}
            className="relative overflow-hidden rounded-2xl border border-white/5 p-6"
            style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #111 100%)' }}
        >
            {/* Glow */}
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 ${color}`} />

            <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${color.replace('bg-', 'bg-').replace('500', '500/10')} border ${color.replace('bg-', 'border-').replace('500', '500/20')}`}>
                    <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
                </div>
                <div className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    <span>Ativo</span>
                </div>
            </div>

            <div>
                <p className="text-3xl font-bold text-white mb-1">{value.toLocaleString()}</p>
                <p className="text-sm text-gray-400">{title}</p>
                {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
            </div>
        </motion.div>
    );
}

function TypeBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
                <span className="text-gray-400">{label}</span>
                <span className="text-white font-medium">{value} <span className="text-gray-500">({pct}%)</span></span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { addToast } = useToast();
    const [stats, setStats] = useState<Stats>({ total: 0, ongoing: 0, completed: 0, types: {} });
    const [actorCount, setActorCount] = useState(0);
    const [recentSeries, setRecentSeries] = useState<RecentSeries[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                setLoading(true);
                const [statsRes, actorsRes, seriesRes] = await Promise.all([
                    api.get('/series/stats'),
                    api.get('/actors/'),
                    api.get('/series/', { params: { limit: 5, skip: 0 } }),
                ]);
                setStats(statsRes.data);
                setActorCount(Array.isArray(actorsRes.data) ? actorsRes.data.length : 0);
                setRecentSeries(Array.isArray(seriesRes.data) ? seriesRes.data.slice(0, 5) : []);
            } catch (err) {
                addToast('Erro ao carregar dados do painel.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [addToast]);

    const typeColors: Record<string, string> = {
        Series: 'bg-blue-500',
        Movie: 'bg-purple-500',
        Anime: 'bg-pink-500',
        Donghua: 'bg-orange-500',
    };

    const typeLabels: Record<string, string> = {
        Series: 'Séries',
        Movie: 'Filmes',
        Anime: 'Animes',
        Donghua: 'Donghuas',
    };

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
                    Visão Geral
                </h1>
                <p className="text-gray-500 text-sm">
                    Resumo do conteúdo da plataforma HuaPlay
                </p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-36 rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                </div>
            ) : (
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
                >
                    <StatCard title="Total de Projetos" value={stats.total} icon={Film} color="bg-yellow-500" />
                    <StatCard title="Em Andamento" value={stats.ongoing} icon={PlayCircle} color="bg-blue-500" />
                    <StatCard title="Concluídos" value={stats.completed} icon={CheckCircle} color="bg-green-500" />
                    <StatCard title="Atores Cadastrados" value={actorCount} icon={Users} color="bg-purple-500" />
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Type Breakdown */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-2 rounded-2xl border border-white/5 p-6"
                    style={{ background: '#0d0d0d' }}
                >
                    <div className="flex items-center gap-2 mb-6">
                        <Globe className="w-4 h-4 text-yellow-400" />
                        <h2 className="text-sm font-semibold text-white">Distribuição por Tipo</h2>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-8 rounded bg-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(stats.types ?? {}).map(([type, count]) => (
                                <TypeBar
                                    key={type}
                                    label={typeLabels[type] || type}
                                    value={count}
                                    total={stats.total}
                                    color={typeColors[type] || 'bg-gray-500'}
                                />
                            ))}
                            {Object.keys(stats.types ?? {}).length === 0 && (
                                <p className="text-gray-600 text-sm">Nenhum dado disponível.</p>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Recent Series */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-3 rounded-2xl border border-white/5 p-6"
                    style={{ background: '#0d0d0d' }}
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-yellow-400" />
                            <h2 className="text-sm font-semibold text-white">Adicionados Recentemente</h2>
                        </div>
                        <a href="/admin/series" className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 transition-colors">
                            Ver todos <ArrowUpRight className="w-3 h-3" />
                        </a>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentSeries.map((s, idx) => (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + idx * 0.06 }}
                                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                                >
                                    <div className="w-8 h-11 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                                        <img src={getOptimizedImageUrl(s.cover_image, 'thumbnail')} alt={s.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{s.title}</p>
                                        <p className="text-gray-500 text-xs">{s.type}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                        s.status === 'Completo'
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                    }`}>
                                        {s.status === 'Completo' ? 'Completo' : 'Em andamento'}
                                    </span>
                                </motion.div>
                            ))}
                            {recentSeries.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                                    <Tv className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm">Nenhuma série cadastrada.</p>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
