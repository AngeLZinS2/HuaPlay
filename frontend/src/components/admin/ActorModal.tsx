import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save } from 'lucide-react';

interface ActorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    actorFormData: any;
    setActorFormData: (data: any) => void;
    editingId: number | null;
    saving: boolean;
}

export default function ActorModal({
    isOpen,
    onClose,
    onSubmit,
    actorFormData,
    setActorFormData,
    editingId,
    saving
}: ActorModalProps) {
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
                            {editingId ? 'Editar' : 'Adicionar'} Ator
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-6">
                        {/* ACTOR FORM FIELDS */}
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Ator/Atriz</label>
                                <input
                                    type="text"
                                    value={actorFormData.name}
                                    onChange={(e) => setActorFormData({ ...actorFormData, name: e.target.value })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-primary outline-none text-white transition-all text-lg font-medium"
                                    placeholder="Ex: Dilraba Dilmurat"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Gênero</label>
                                <select
                                    value={actorFormData.gender}
                                    onChange={(e) => setActorFormData({ ...actorFormData, gender: e.target.value })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-primary outline-none text-white transition-all"
                                >
                                    <option value="Female">Atriz</option>
                                    <option value="Male">Ator</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">URL da Imagem</label>
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        value={actorFormData.image_url}
                                        onChange={(e) => setActorFormData({ ...actorFormData, image_url: e.target.value })}
                                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-2.5 focus:border-primary outline-none text-white transition-all"
                                        placeholder="https://..."
                                        required
                                    />
                                    {actorFormData.image_url && (
                                        <img src={actorFormData.image_url} alt="Preview" className="h-20 w-auto rounded border border-gray-700 object-cover" />
                                    )}
                                </div>
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
                                    <Save className="w-5 h-5" /> Salvar Ator
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
