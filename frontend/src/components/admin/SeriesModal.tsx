import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Image, Film, Globe, Link, Star, FileText, Users } from 'lucide-react';

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

const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-yellow-500/50 focus:bg-black/60 outline-none transition-all placeholder-gray-600";
const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Icon className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
            </div>
            {children}
        </div>
    );
}

export default function SeriesModal({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    editingId,
    saving,
    extractSrc,
}: SeriesModalProps) {
    if (!isOpen) return null;

    const update = (field: string, value: any) => setFormData({ ...formData, [field]: value });

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', duration: 0.4 }}
                    className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl shadow-black"
                    style={{ background: '#0d0d0d' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                <Film className="w-4 h-4 text-yellow-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">
                                    {editingId ? 'Editar Série' : 'Nova Série'}
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

                    {/* Scrollable Body */}
                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                        {/* Basic Info */}
                        <Section title="Informações Básicas" icon={FileText}>
                            <div>
                                <label className={labelClass}>Título</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => update('title', e.target.value)}
                                    className={inputClass}
                                    placeholder="Ex: Kingdom of Mystery"
                                    required
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Slug (URL amigável)</label>
                                <input
                                    type="text"
                                    value={formData.slug || ''}
                                    onChange={(e) => update('slug', e.target.value)}
                                    className={inputClass}
                                    placeholder="kingdom-of-mystery"
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Descrição / Sinopse</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => update('description', e.target.value)}
                                    className={`${inputClass} h-24 resize-none`}
                                    placeholder="Sinopse do drama..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Tipo</label>
                                    <select value={formData.type} onChange={(e) => update('type', e.target.value)} className={inputClass}>
                                        <option value="Series">Série</option>
                                        <option value="Movie">Filme</option>
                                        <option value="Anime">Anime</option>
                                        <option value="Donghua">Donghua</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select value={formData.status} onChange={(e) => update('status', e.target.value)} className={inputClass}>
                                        <option value="Em andamento">Em andamento</option>
                                        <option value="Completo">Completo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Ano de Lançamento</label>
                                    <input
                                        type="number"
                                        value={formData.release_year}
                                        onChange={(e) => update('release_year', parseInt(e.target.value))}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>País de Origem</label>
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={(e) => update('country', e.target.value)}
                                        className={inputClass}
                                        placeholder="China"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Gênero(s)</label>
                                <input
                                    type="text"
                                    value={formData.genre}
                                    onChange={(e) => update('genre', e.target.value)}
                                    className={inputClass}
                                    placeholder="Romance, Ação, Fantasia"
                                    required
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Elenco Principal</label>
                                <input
                                    type="text"
                                    value={formData.cast || ''}
                                    onChange={(e) => update('cast', e.target.value)}
                                    className={inputClass}
                                    placeholder="Atores separados por vírgula"
                                />
                            </div>
                        </Section>

                        {/* Images */}
                        <Section title="Imagens" icon={Image}>
                            <div>
                                <label className={labelClass}>Capa Vertical (URL)</label>
                                <div className="flex gap-3 items-start">
                                    <input
                                        type="text"
                                        value={formData.cover_image || ''}
                                        onChange={(e) => update('cover_image', e.target.value)}
                                        className={`${inputClass} flex-1`}
                                        placeholder="https://..."
                                    />
                                    {formData.cover_image && (
                                        <img src={formData.cover_image} alt="Capa" className="h-16 w-11 object-cover rounded-lg border border-white/10 flex-shrink-0" />
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Banner Horizontal (URL)</label>
                                <div className="flex gap-3 items-start">
                                    <input
                                        type="text"
                                        value={formData.banner_image || ''}
                                        onChange={(e) => update('banner_image', e.target.value)}
                                        className={`${inputClass} flex-1`}
                                        placeholder="https://..."
                                    />
                                    {formData.banner_image && (
                                        <img src={formData.banner_image} alt="Banner" className="h-16 w-28 object-cover rounded-lg border border-white/10 flex-shrink-0" />
                                    )}
                                </div>
                            </div>
                        </Section>

                        {/* Highlight */}
                        <Section title="Destaque no Hero" icon={Star}>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                <input
                                    type="checkbox"
                                    id="is_featured"
                                    checked={formData.is_featured}
                                    onChange={(e) => update('is_featured', e.target.checked)}
                                    className="w-4 h-4 accent-yellow-400"
                                />
                                <label htmlFor="is_featured" className="text-sm text-gray-300 cursor-pointer">
                                    Exibir esta série em destaque no Hero da página inicial
                                </label>
                            </div>
                            <div>
                                <label className={labelClass}>Tipo de Destaque</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['TRAILER', 'BANNER'].map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => update('feature_type', type)}
                                            className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                                                formData.feature_type === type
                                                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                                    : 'border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {type === 'TRAILER' ? '🎬 Trailer' : '🖼️ Banner'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>URL do Trailer</label>
                                <input
                                    type="text"
                                    value={formData.trailer_url || ''}
                                    onChange={(e) => update('trailer_url', extractSrc(e.target.value))}
                                    className={inputClass}
                                    placeholder="YouTube, Ok.ru ou embed URL"
                                />
                            </div>
                        </Section>

                        {/* Download Links */}
                        <Section title="Links de Download da Série" icon={Link}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { key: 'drive_link', label: 'Google Drive', placeholder: 'https://drive.google.com/...' },
                                    { key: 'mega_link', label: 'Mega', placeholder: 'https://mega.nz/...' },
                                    { key: 'mediafire_link', label: 'Mediafire', placeholder: 'https://mediafire.com/...' },
                                    { key: 'pixeldrain_link', label: 'Pixeldrain', placeholder: 'https://pixeldrain.com/...' },
                                ].map(({ key, label, placeholder }) => (
                                    <div key={key}>
                                        <label className={labelClass}>{label}</label>
                                        <input
                                            type="text"
                                            value={formData[key] || ''}
                                            onChange={(e) => update(key, e.target.value)}
                                            className={inputClass}
                                            placeholder={placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                        </Section>

                        {/* Submit */}
                        <div className="pt-2 pb-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/20"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingId ? 'Salvar Alterações' : 'Criar Série'}
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
