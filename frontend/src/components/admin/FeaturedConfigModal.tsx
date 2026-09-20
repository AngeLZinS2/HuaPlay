import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Clock, Flame, Pin, Save, Check } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface FeaturedConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FeaturedConfigModal({ isOpen, onClose }: FeaturedConfigModalProps) {
    const { addToast } = useToast();
    const [mode, setMode] = useState<'MOST_WATCHED' | 'RANDOM_ROTATE' | 'MANUAL'>('MOST_WATCHED');
    const [rotateIntervalMinutes, setRotateIntervalMinutes] = useState(60);
    const [manualSeriesId, setManualSeriesId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get('/series/featured-config');
            if (res.data) {
                setMode(res.data.mode || 'MOST_WATCHED');
                setRotateIntervalMinutes(res.data.rotate_interval_minutes || 60);
                setManualSeriesId(res.data.manual_series_id || null);
            }
        } catch (error) {
            console.error("Failed to fetch featured config", error);
            addToast('Erro ao carregar configurações de destaque', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/series/featured-config', {
                mode,
                rotate_interval_minutes: rotateIntervalMinutes,
                manual_series_id: mode === 'MANUAL' ? manualSeriesId : null,
            });
            addToast('Configuração de Destaque salva com sucesso!', 'success');
            onClose();
        } catch (error) {
            console.error("Failed to save featured config", error);
            addToast('Erro ao salvar configuração de destaque', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-xl bg-[#0F0F0F] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden text-white"
                >
                    {/* Top Glow Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-amber-600" />

                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                <Sparkles className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Destaque Principal (Hero Banner)</h2>
                                <p className="text-xs text-gray-400">Configure como o banner da página inicial é selecionado</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-6">
                            {/* Mode Options */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                    Modo de Exibição
                                </label>

                                <div className="grid grid-cols-1 gap-3">
                                    {/* 1. MOST WATCHED */}
                                    <div
                                        onClick={() => setMode('MOST_WATCHED')}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                                            mode === 'MOST_WATCHED'
                                                ? 'bg-yellow-500/10 border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                                                : 'bg-white/5 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg ${mode === 'MOST_WATCHED' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                                            <Flame className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-sm">Mais Assistidos (Automático)</h3>
                                                {mode === 'MOST_WATCHED' && <Check className="w-4 h-4 text-yellow-400" />}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Seleciona automaticamente a série mais popular/assistida na plataforma.
                                            </p>
                                        </div>
                                    </div>

                                    {/* 2. RANDOM ROTATE */}
                                    <div
                                        onClick={() => setMode('RANDOM_ROTATE')}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                                            mode === 'RANDOM_ROTATE'
                                                ? 'bg-yellow-500/10 border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                                                : 'bg-white/5 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg ${mode === 'RANDOM_ROTATE' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-sm">Rotação por Tempo (Automático)</h3>
                                                {mode === 'RANDOM_ROTATE' && <Check className="w-4 h-4 text-yellow-400" />}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Altera dinamicamente o destaque de forma aleatória a cada intervalo de tempo definido.
                                            </p>
                                        </div>
                                    </div>

                                    {/* 3. MANUAL */}
                                    <div
                                        onClick={() => setMode('MANUAL')}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                                            mode === 'MANUAL'
                                                ? 'bg-yellow-500/10 border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                                                : 'bg-white/5 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg ${mode === 'MANUAL' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                                            <Pin className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-sm">Seleção Manual (Fixar Série)</h3>
                                                {mode === 'MANUAL' && <Check className="w-4 h-4 text-yellow-400" />}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Fixa manualmente uma série específica escolhida pelo Administrador.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Rotation Interval Setting (Shown when RANDOM_ROTATE) */}
                            {mode === 'RANDOM_ROTATE' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-2 pt-2 border-t border-white/10"
                                >
                                    <label className="text-xs font-semibold text-gray-300">
                                        Tempo de Rotação (Troca Automática)
                                    </label>
                                    <select
                                        value={rotateIntervalMinutes}
                                        onChange={(e) => setRotateIntervalMinutes(parseInt(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                                    >
                                        <option value={15} className="bg-neutral-900">A cada 15 minutos</option>
                                        <option value={30} className="bg-neutral-900">A cada 30 minutos</option>
                                        <option value={60} className="bg-neutral-900">A cada 1 Hora (Padrão)</option>
                                        <option value={180} className="bg-neutral-900">A cada 3 Horas</option>
                                        <option value={360} className="bg-neutral-900">A cada 6 Horas</option>
                                        <option value={720} className="bg-neutral-900">A cada 12 Horas</option>
                                        <option value={1440} className="bg-neutral-900">A cada 24 Horas (1 Dia)</option>
                                    </select>
                                </motion.div>
                            )}

                            {/* Manual Star Notice (Shown when MANUAL) */}
                            {mode === 'MANUAL' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-200/90 flex items-start gap-3"
                                >
                                    <Pin className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-yellow-400 mb-0.5">Modo de Seleção Manual Ativo</p>
                                        <p className="text-gray-300 leading-relaxed">
                                            A série exibida no destaque principal será aquela marcada com a **estrela (⭐)** na tabela de conteúdos. Basta clicar na estrela de qualquer dorama para fixá-lo como o Destaque Principal!
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors text-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-semibold shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
