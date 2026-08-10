import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, PlayCircle, Download, Hash } from 'lucide-react';

interface EpisodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    episodeData: any;
    setEpisodeData: (data: any) => void;
    seriesList: any[];
    editingEpisodeId: number | null;
    saving: boolean;
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

export default function EpisodeModal({
    isOpen,
    onClose,
    onSubmit,
    episodeData,
    setEpisodeData,
    seriesList,
    editingEpisodeId,
    saving,
}: EpisodeModalProps) {
    if (!isOpen) return null;

    const update = (field: string, value: any) => setEpisodeData({ ...episodeData, [field]: value });

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', duration: 0.4 }}
                    className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl shadow-black"
                    style={{ background: '#0d0d0d' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <PlayCircle className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">
                                    {editingEpisodeId ? 'Editar Episódio' : 'Novo Episódio'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {editingEpisodeId ? `ID #${editingEpisodeId}` : 'Preencha os links abaixo'}
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
                        <Section title="Identificação" icon={Hash}>
                            <div>
                                <label className={labelClass}>Série</label>
                                <select
                                    value={episodeData.series_id}
                                    onChange={(e) => update('series_id', e.target.value)}
                                    className={inputClass}
                                >
                                    {seriesList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Número do Episódio</label>
                                    <input
                                        type="number"
                                        value={episodeData.episode_number}
                                        onChange={(e) => update('episode_number', parseInt(e.target.value))}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Título do Episódio</label>
                                    <input
                                        type="text"
                                        value={episodeData.title}
                                        onChange={(e) => update('title', e.target.value)}
                                        className={inputClass}
                                        placeholder="Ex: O Início"
                                        required
                                    />
                                </div>
                            </div>
                        </Section>

                        {/* Online Playback */}
                        <Section title="Reprodução Online (Embeds)" icon={PlayCircle}>
                            <div>
                                <label className={labelClass}>Embed URL 1</label>
                                <input
                                    type="text"
                                    value={episodeData.embed_url_1 || ''}
                                    onChange={(e) => update('embed_url_1', e.target.value)}
                                    className={inputClass}
                                    placeholder="https://ok.ru/... ou outro player"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Embed URL 2 (espelho)</label>
                                <input
                                    type="text"
                                    value={episodeData.embed_url_2 || ''}
                                    onChange={(e) => update('embed_url_2', e.target.value)}
                                    className={inputClass}
                                    placeholder="URL alternativa para reprodução"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>YouTube</label>
                                <input
                                    type="text"
                                    value={episodeData.youtube_link || ''}
                                    onChange={(e) => update('youtube_link', e.target.value)}
                                    className={inputClass}
                                    placeholder="https://youtube.com/watch?v=..."
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Link Externo</label>
                                <input
                                    type="text"
                                    value={episodeData.external_link || ''}
                                    onChange={(e) => update('external_link', e.target.value)}
                                    className={inputClass}
                                    placeholder="Link de reprodução em outro site"
                                />
                            </div>
                        </Section>

                        {/* Downloads */}
                        <Section title="Links de Download" icon={Download}>
                            <div>
                                <label className={labelClass}>Link de Download Direto</label>
                                <input
                                    type="text"
                                    value={episodeData.download_link || ''}
                                    onChange={(e) => update('download_link', e.target.value)}
                                    className={inputClass}
                                    placeholder="Link direto para download"
                                />
                            </div>
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
                                            value={episodeData[key] || ''}
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
                                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingEpisodeId ? 'Salvar Alterações' : 'Criar Episódio'}
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
