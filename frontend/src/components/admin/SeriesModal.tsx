import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save } from 'lucide-react';

interface SeriesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    formData: any;
    setFormData: (data: any) => void;
    editingId: number | null;
    saving: boolean;
    extractSrc: (input: string) => string;
}

export default function SeriesModal({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    editingId,
    saving,
    extractSrc
}: SeriesModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface border border-gray-700 rounded-xl w-full max-w-5xl p-8 max-h-[90vh] overflow-y-auto shadow-2xl shadow-black"
                >
                    <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                            <Plus className="w-6 h-6 text-primary" />
                            {editingId ? 'Editar' : 'Adicionar'} Projeto
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-6">
                        {/* Main Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Título</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-primary outline-none text-white transition-all text-lg font-medium"
                                        placeholder="Ex: Kingdom of Mystery"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        >
                                            <option value="Em andamento">Em andamento</option>
                                            <option value="Completo">Completo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo</label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        >
                                            <option value="Series">Série</option>
                                            <option value="Movie">Filme</option>
                                            <option value="Anime">Anime</option>
                                            <option value="Donghua">Donghua</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ano</label>
                                        <input
                                            type="number"
                                            value={formData.release_year}
                                            onChange={(e) => setFormData({ ...formData, release_year: parseInt(e.target.value) })}
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">País</label>
                                        <input
                                            type="text"
                                            value={formData.country}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Gênero</label>
                                    <input
                                        type="text"
                                        value={formData.genre}
                                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Elenco</label>
                                    <input
                                        type="text"
                                        value={formData.cast}
                                        onChange={(e) => setFormData({ ...formData, cast: e.target.value })}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        placeholder="Atores separados por vírgula"
                                    />
                                </div>
                            </div>

                            {/* Right Column: Images & Extra */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Capa URL (Vertical)</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={formData.cover_image}
                                            onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                                            className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        />
                                        {formData.cover_image && (
                                            <img src={formData.cover_image} alt="Cover Preview" className="h-10 w-auto rounded border border-gray-700" />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Banner URL (Horizontal)</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={formData.banner_image}
                                            onChange={(e) => setFormData({ ...formData, banner_image: e.target.value })}
                                            className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        />
                                        {formData.banner_image && (
                                            <img src={formData.banner_image} alt="Banner Preview" className="h-10 w-auto rounded border border-gray-700" />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Trailer URL</label>
                                    <input
                                        type="text"
                                        value={formData.trailer_url}
                                        onChange={(e) => setFormData({ ...formData, trailer_url: extractSrc(e.target.value) })}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        placeholder="YouTube, Ok.ru ou Google Drive"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo de Destaque</label>
                                    <div className="flex bg-black/50 border border-gray-700 rounded-lg p-1">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, feature_type: 'TRAILER' })}
                                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${formData.feature_type === 'TRAILER'
                                                ? 'bg-primary text-black'
                                                : 'text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            Trailer
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, feature_type: 'BANNER' })}
                                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${formData.feature_type === 'BANNER'
                                                ? 'bg-primary text-black'
                                                : 'text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            Banner
                                        </button>
                                    </div>
                                </div>

                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none h-[120px] text-white transition-all focus:bg-black/80 resize-none text-sm leading-relaxed"
                                    placeholder="Sinopse do drama..."
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-primary hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-6 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" /> Salvar Projeto
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
