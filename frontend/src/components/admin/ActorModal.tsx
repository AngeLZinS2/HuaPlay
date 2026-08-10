import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, User, Image, FileText, Globe } from 'lucide-react';

interface ActorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    actorFormData: any;
    setActorFormData: (data: any) => void;
    editingId: number | null;
    saving: boolean;
}

const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-yellow-500/50 focus:bg-black/60 outline-none transition-all placeholder-gray-600";
const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Icon className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
            </div>
            {children}
        </div>
    );
}

export default function ActorModal({
    isOpen,
    onClose,
    onSubmit,
    actorFormData,
    setActorFormData,
    editingId,
    saving,
}: ActorModalProps) {
    if (!isOpen) return null;

    const update = (field: string, value: any) => setActorFormData({ ...actorFormData, [field]: value });

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', duration: 0.4 }}
                    className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl shadow-black"
                    style={{ background: '#0d0d0d' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                <User className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">
                                    {editingId ? 'Editar Ator/Atriz' : 'Novo Ator/Atriz'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {editingId ? `ID #${editingId}` : 'Preencha os campos abaixo'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                        {/* Identity */}
                        <Section title="Identidade" icon={User}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Nome Artístico</label>
                                    <input
                                        type="text"
                                        value={actorFormData.name || ''}
                                        onChange={(e) => update('name', e.target.value)}
                                        className={inputClass}
                                        placeholder="Ex: Dilraba Dilmurat"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Nome Real</label>
                                    <input
                                        type="text"
                                        value={actorFormData.real_name || ''}
                                        onChange={(e) => update('real_name', e.target.value)}
                                        className={inputClass}
                                        placeholder="Nome completo real"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Gênero</label>
                                    <select
                                        value={actorFormData.gender || 'Female'}
                                        onChange={(e) => update('gender', e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="Female">Atriz (Feminino)</option>
                                        <option value="Male">Ator (Masculino)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Data de Nascimento</label>
                                    <input
                                        type="text"
                                        value={actorFormData.birth_date || ''}
                                        onChange={(e) => update('birth_date', e.target.value)}
                                        className={inputClass}
                                        placeholder="Ex: 1992-06-03"
                                    />
                                </div>
                            </div>
                        </Section>

                        {/* Photo */}
                        <Section title="Foto" icon={Image}>
                            <div>
                                <label className={labelClass}>URL da Imagem</label>
                                <div className="flex gap-3 items-start">
                                    <input
                                        type="text"
                                        value={actorFormData.image_url || ''}
                                        onChange={(e) => update('image_url', e.target.value)}
                                        className={`${inputClass} flex-1`}
                                        placeholder="https://..."
                                    />
                                    {actorFormData.image_url && (
                                        <img
                                            src={actorFormData.image_url}
                                            alt="Preview"
                                            className="h-16 w-12 object-cover rounded-xl border border-white/10 flex-shrink-0"
                                        />
                                    )}
                                </div>
                            </div>
                        </Section>

                        {/* Bio */}
                        <Section title="Biografia" icon={FileText}>
                            <div>
                                <label className={labelClass}>Bio / Descrição</label>
                                <textarea
                                    value={actorFormData.bio || ''}
                                    onChange={(e) => update('bio', e.target.value)}
                                    className={`${inputClass} h-24 resize-none`}
                                    placeholder="Breve biografia do ator/atriz..."
                                />
                            </div>
                        </Section>

                        {/* Social */}
                        <Section title="Redes Sociais" icon={Globe}>
                            <div>
                                <label className={labelClass}>Link de Redes Sociais</label>
                                <input
                                    type="text"
                                    value={actorFormData.social_media || ''}
                                    onChange={(e) => update('social_media', e.target.value)}
                                    className={inputClass}
                                    placeholder="https://instagram.com/... ou Weibo"
                                />
                            </div>
                        </Section>

                        {/* Submit */}
                        <div className="pt-2 pb-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/20"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingId ? 'Salvar Alterações' : 'Criar Ator'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
