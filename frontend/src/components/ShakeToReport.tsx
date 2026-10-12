import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Send, Smartphone, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

type ReportState = 'idle' | 'sending' | 'sent' | 'error';

interface MotionEventWithPermission {
    requestPermission?: () => Promise<'granted' | 'denied'>;
}

const OPEN_REPORT_EVENT = 'huaplay:open-report';

export default function ShakeToReport() {
    const location = useLocation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<ReportState>('idle');
    const [motionEnabled, setMotionEnabled] = useState(false);
    const isOpenRef = useRef(false);
    const lastMotion = useRef({ x: 0, y: 0, z: 0, time: 0, trigger: 0 });

    const isExcludedRoute = ['/login', '/profiles'].includes(location.pathname);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const enableMotion = useCallback(async () => {
        const motionApi = DeviceMotionEvent as unknown as MotionEventWithPermission;
        if (motionApi.requestPermission) {
            try {
                const permission = await motionApi.requestPermission();
                setMotionEnabled(permission === 'granted');
                return permission === 'granted';
            } catch {
                setMotionEnabled(false);
                return false;
            }
        }
        setMotionEnabled(true);
        return true;
    }, []);

    const openSheet = useCallback(() => {
        if (!window.matchMedia('(max-width: 767px)').matches || isExcludedRoute) return;
        setStatus('idle');
        setIsOpen(true);
    }, [isExcludedRoute]);

    useEffect(() => {
        const handleManualOpen = () => {
            void enableMotion();
            openSheet();
        };
        window.addEventListener(OPEN_REPORT_EVENT, handleManualOpen);
        return () => window.removeEventListener(OPEN_REPORT_EVENT, handleManualOpen);
    }, [enableMotion, openSheet]);

    useEffect(() => {
        if (isExcludedRoute || !window.matchMedia('(max-width: 767px)').matches) return;
        const handleMotion = (event: DeviceMotionEvent) => {
            const acceleration = event.accelerationIncludingGravity;
            if (!acceleration) return;
            setMotionEnabled(true);
            const now = Date.now();
            const elapsed = now - lastMotion.current.time;
            if (elapsed < 90) return;

            const x = acceleration.x ?? 0;
            const y = acceleration.y ?? 0;
            const z = acceleration.z ?? 0;
            const change = Math.abs(x - lastMotion.current.x) + Math.abs(y - lastMotion.current.y) + Math.abs(z - lastMotion.current.z);

            lastMotion.current = { ...lastMotion.current, x, y, z, time: now };
            if (change > 28 && now - lastMotion.current.trigger > 4000 && !isOpenRef.current) {
                lastMotion.current.trigger = now;
                navigator.vibrate?.(45);
                openSheet();
            }
        };

        window.addEventListener('devicemotion', handleMotion);
        return () => window.removeEventListener('devicemotion', handleMotion);
    }, [enableMotion, isExcludedRoute, openSheet]);

    const submitReport = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus('sending');
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await api.post('/reports', {
                reporter_email: user?.email || data.get('email') || null,
                category: data.get('category'),
                reason: data.get('category'),
                message: String(data.get('message') || '').trim(),
                page_url: window.location.href,
            });
            setStatus('sent');
            form.reset();
        } catch {
            setStatus('error');
        }
    };

    if (isExcludedRoute) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] md:hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    role="presentation"
                >
                    <button type="button" aria-label="Fechar relatório" className="absolute inset-0 bg-black/35" onClick={() => setIsOpen(false)} />
                    <motion.section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="shake-report-title"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                        className="absolute inset-x-0 bottom-0 max-h-[52dvh] overflow-y-auto rounded-t-[2rem] border-t border-white/15 bg-[#0b0b0b]/98 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
                    >
                        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
                        <div className="mx-auto max-w-lg">
                            <div className="mb-5 flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-primary"><Smartphone className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Shake to Report</span></div>
                                    <h2 id="shake-report-title" className="mt-2 text-xl font-bold text-white">Reportar um problema</h2>
                                    <p className="mt-1 text-xs text-gray-500">A página atual será incluída automaticamente.</p>
                                </div>
                                <button type="button" onClick={() => setIsOpen(false)} className="rounded-full border border-white/10 p-2 text-gray-400 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
                            </div>

                            {status === 'sent' ? (
                                <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-sm text-green-300">
                                    <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Relatório enviado</div>
                                    <p className="mt-2 text-green-300/70">Obrigado. A equipe poderá analisar o problema no painel administrativo.</p>
                                    <button type="button" onClick={() => setIsOpen(false)} className="mt-4 rounded-xl bg-green-500/20 px-4 py-2 font-semibold">Fechar</button>
                                </div>
                            ) : (
                                <form onSubmit={submitReport} className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label className="text-xs font-medium text-gray-300">Tipo do problema
                                            <select name="category" required className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60">
                                                <option value="playback">Vídeo ou reprodução</option><option value="wrong_content">Conteúdo incorreto</option><option value="subtitle">Áudio ou legenda</option><option value="bug">Erro no aplicativo</option><option value="other">Outro problema</option>
                                            </select>
                                        </label>
                                        {!user?.email && <label className="text-xs font-medium text-gray-300">E-mail <span className="text-gray-600">(opcional)</span><input name="email" type="email" maxLength={160} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /></label>}
                                    </div>
                                    <label className="block text-xs font-medium text-gray-300">O que aconteceu?
                                        <textarea name="message" required minLength={10} maxLength={1000} rows={3} placeholder="Descreva o problema…" className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-700 outline-none focus:border-primary/60" />
                                    </label>
                                    {status === 'error' && <p role="alert" className="text-xs text-red-400">Não foi possível enviar agora. Tente novamente.</p>}
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[10px] text-gray-600">{motionEnabled ? 'Agitar está ativo neste aparelho.' : 'Use este botão quando o sensor não estiver disponível.'}</span>
                                        <button type="submit" disabled={status === 'sending'} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"><Send className="h-4 w-4" />{status === 'sending' ? 'Enviando…' : 'Enviar'}</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </motion.section>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
