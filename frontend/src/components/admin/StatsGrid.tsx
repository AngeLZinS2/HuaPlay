import { motion } from 'framer-motion';
import { Film, PlayCircle, CheckCircle, TrendingUp } from 'lucide-react';

const StatusCard = ({ title, value, icon: Icon, color }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-gray-800 p-6 rounded-xl flex items-center justify-between"
    >
        <div>
            <p className="text-gray-400 text-sm mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
            <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
    </motion.div>
);

interface StatsGridProps {
    stats: {
        total: number;
        ongoing: number;
        completed: number;
    };
}

export default function StatsGrid({ stats }: StatsGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatusCard title="Total Projetos" value={stats.total} icon={Film} color="text-blue-500 bg-blue-500" />
            <StatusCard title="Em Andamento" value={stats.ongoing} icon={PlayCircle} color="text-yellow-500 bg-yellow-500" />
            <StatusCard title="Concluídos" value={stats.completed} icon={CheckCircle} color="text-green-500 bg-green-500" />
            <StatusCard title="Novos (Hoje)" value={0} icon={TrendingUp} color="text-purple-500 bg-purple-500" />
        </div>
    );
}
