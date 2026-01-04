import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Film, Loader2, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSeries, type Series } from '../services/series';
import { useModal } from '../context/ModalContext';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Series[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { openModal } = useModal();

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setQuery('');
            setResults([]);
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim()) {
                setLoading(true);
                try {
                    const data = await getSeries(query);
                    setResults(data);
                } catch (error) {
                    console.error('Error searching series:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 transition-all duration-300"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 sm:px-6 pointer-events-none"
                    >
                        <div className="w-full max-w-3xl bg-surface/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[80vh]">
                            {/* Header / Input */}
                            <div className="relative border-b border-white/10 bg-surface">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Buscar séries, animes, filmes..."
                                    className="w-full bg-transparent text-xl py-6 pl-16 pr-14 text-white placeholder-gray-500 focus:outline-none"
                                />
                                <button
                                    onClick={onClose}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/10 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                ) : query && results.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400">
                                        <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg">Nenhum resultado encontrado para "{query}"</p>
                                    </div>
                                ) : results.length > 0 ? (
                                    <div className="py-2">
                                        <h3 className="px-6 py-3 text-sm font-medium text-gray-400 uppercase tracking-wider">
                                            Resultados
                                        </h3>
                                        <div className="flex flex-col">
                                            {results.map((series) => (
                                                <div
                                                    key={series.id}
                                                    className="group flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-primary relative cursor-pointer"
                                                >
                                                    <Link
                                                        to={`/series/${series.id}`}
                                                        onClick={onClose}
                                                        className="flex items-center gap-4 flex-1 min-w-0"
                                                    >
                                                        <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-800">
                                                            <img
                                                                src={series.cover_image || '/placeholder-cover.jpg'}
                                                                alt={series.title}
                                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <span className="text-lg font-medium text-white truncate group-hover:text-primary transition-colors">
                                                                {series.title}
                                                            </span>
                                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                                <span>{series.release_year}</span>
                                                                <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                                <span>{series.type}</span>
                                                                <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                                <span className="truncate">{series.genre}</span>
                                                            </div>
                                                        </div>
                                                    </Link>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            onClose();
                                                            openModal({
                                                                ...series,
                                                                image: series.cover_image,
                                                                description: series.description || "Descrição indisponível",
                                                                cast: "",
                                                                moods: ""
                                                            } as any);
                                                        }}
                                                        className="p-2 rounded-full border border-gray-500 text-gray-400 hover:border-white hover:text-white transition-colors z-10"
                                                        title="Mais informações"
                                                    >
                                                        <ChevronDown className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    // Empty State / Suggestions
                                    <div className="py-12 text-center text-gray-500">
                                        <p>Digite para começar a buscar...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
