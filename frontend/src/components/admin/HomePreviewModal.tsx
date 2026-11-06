import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, RefreshCw, Smartphone, X } from 'lucide-react';
import api from '../../services/api';

type Item = { id: number; title: string; cover_url?: string; banner?: string };
type Section = { id: number | string; title: string; items: Item[] };
type Preview = { hero?: Item; sections?: Section[] };

type Props = {
    isOpen: boolean;
    onClose: () => void;
    seriesId?: number | null;
    seriesTitle?: string;
};

export default function HomePreviewModal({ isOpen, onClose, seriesId, seriesTitle }: Props) {
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [reloadKey, setReloadKey] = useState(0);
    const [previewData, setPreviewData] = useState<Preview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(false);
    const reqGenRef = useRef(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleClose = useCallback(() => {
        reqGenRef.current++;
        abortControllerRef.current?.abort();
        setPreviewData(null);
        setPreviewLoading(false);
        setPreviewError(false);
        onClose();
    }, [onClose]);

    useEffect(() => {
        reqGenRef.current++;
        abortControllerRef.current?.abort();

        if (!isOpen || !seriesId) {
            setPreviewData(null);
            setPreviewLoading(false);
            setPreviewError(false);
            return;
        }

        let active = true;
        const generation = reqGenRef.current;
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setPreviewLoading(true);
        setPreviewError(false);
        setPreviewData(null);

        const p1 = api.get('/admin/home-preview', { signal: controller.signal });
        const p2 = api.get(`/series/${seriesId}`, { signal: controller.signal });

        Promise.all([p1, p2])
            .then(([r, s]) => {
                if (!active || controller.signal.aborted || reqGenRef.current !== generation) return;
                const res: Preview = r.data ? { ...r.data } : {};
                if (s?.data) {
                    res.hero = {
                        id: s.data.id,
                        title: s.data.title,
                        banner: s.data.banner_image || s.data.cover_image,
                        cover_url: s.data.cover_image,
                    };
                }
                setPreviewData(res);
            })
            .catch(() => {
                if (!active || controller.signal.aborted || reqGenRef.current !== generation) return;
                setPreviewError(true);
            })
            .finally(() => {
                if (!active || controller.signal.aborted || reqGenRef.current !== generation) return;
                setPreviewLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [isOpen, seriesId, reloadKey]);

    if (!isOpen) return null;

    const externalUrl = seriesId ? `/admin/home-preview?previewSeries=${seriesId}` : '/';

    return (
        <div className={`fixed inset-0 z-[300] flex flex-col bg-black/90 p-3 backdrop-blur-md sm:p-5 ${device === 'mobile' ? 'items-center justify-center' : ''}`}>
            <div className={`mx-auto flex w-full items-center gap-3 rounded-t-2xl border border-b-0 border-white/10 bg-[#111] px-4 py-3 ${device === 'mobile' ? 'max-w-[460px]' : 'max-w-[1600px]'}`}>
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-white">Prévia da Home{seriesTitle ? ` · ${seriesTitle}` : ''}</h2>
                    <p className="truncate text-xs text-gray-500">
                        {seriesId
                            ? 'Simulação com o conteúdo selecionado em destaque: nada será alterado ao fechar.'
                            : 'Esta é a página real, incluindo vídeo, animações e fileiras.'}
                    </p>
                </div>
                <div className="flex rounded-xl border border-white/10 bg-black p-1">
                    <button
                        title="Celular"
                        onClick={() => setDevice('mobile')}
                        className={`rounded-lg p-2 ${device === 'mobile' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Smartphone className="h-4 w-4" />
                    </button>
                    <button
                        title="Desktop"
                        onClick={() => setDevice('desktop')}
                        className={`rounded-lg p-2 ${device === 'desktop' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Monitor className="h-4 w-4" />
                    </button>
                    <button
                        title="Atualizar prévia"
                        onClick={() => setReloadKey(value => value + 1)}
                        className="rounded-lg p-2 text-gray-400 hover:text-white"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
                <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={seriesId ? "Abrir prévia em outra aba" : "Abrir Home em outra aba"}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                >
                    <ExternalLink className="h-5 w-5" />
                </a>
                <button
                    onClick={handleClose}
                    title="Fechar"
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
            <div
                className={`mx-auto flex min-h-0 w-full justify-center overflow-hidden rounded-b-2xl border border-white/10 bg-[#050505] p-2 ${
                    device === 'mobile' ? 'max-w-[460px] flex-none items-center' : 'max-w-[1600px] flex-1 sm:p-3'
                }`}
                style={device === 'mobile' ? { height: 'min(868px, calc(100vh - 110px))' } : undefined}
            >
                {seriesId ? (
                    previewLoading ? (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                            Carregando prévia do conteúdo selecionado…
                        </div>
                    ) : previewError ? (
                        <div className="flex h-full w-full items-center justify-center text-sm text-red-400">
                            Não foi possível carregar a prévia deste conteúdo.
                        </div>
                    ) : previewData ? (
                        <div className={`mx-auto h-full w-full overflow-y-auto rounded-xl border border-[#242424] bg-black p-4 shadow-2xl ${device === 'mobile' ? 'max-w-[390px]' : 'max-w-6xl'}`}>
                            <div className={`relative bg-[#111] overflow-hidden rounded-xl ${device === 'mobile' ? 'aspect-[4/5]' : 'aspect-[16/6]'}`}>
                                {(previewData.hero?.banner ?? previewData.hero?.cover_url) && (
                                    <img src={previewData.hero?.banner ?? previewData.hero?.cover_url} alt="" className="h-full w-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent" />
                                <p className="absolute bottom-5 left-5 text-xl font-bold text-white">{previewData.hero?.title ?? seriesTitle ?? 'Destaque'}</p>
                            </div>
                            <div className="space-y-6 pt-5">
                                {(previewData.sections ?? []).map(section => (
                                    <section key={section.id}>
                                        <h3 className="mb-3 text-sm font-semibold text-white">{section.title}</h3>
                                        <div className="flex gap-2 overflow-hidden">
                                            {section.items.map(item => (
                                                <div key={item.id} className={`shrink-0 overflow-hidden rounded-lg bg-[#181818] ${device === 'mobile' ? 'w-24' : 'w-32'}`}>
                                                    <div className="aspect-[2/3]">
                                                        {item.cover_url && <img src={item.cover_url} alt="" className="h-full w-full object-cover" />}
                                                    </div>
                                                    <p className="truncate px-2 py-2 text-[10px] text-gray-300">{item.title}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </div>
                    ) : null
                ) : device === 'desktop' ? (
                    <iframe
                        key={`${reloadKey}-active-desktop`}
                        src="/"
                        title="Prévia desktop da página inicial"
                        className="h-full w-full border-0 bg-black shadow-2xl"
                    />
                ) : (
                    <div
                        className="h-full max-w-full overflow-hidden rounded-[1.5rem] border border-white/15 bg-black shadow-2xl"
                        style={{ aspectRatio: '390 / 844' }}
                    >
                        <iframe
                            key={`${reloadKey}-active-mobile`}
                            src="/"
                            title="Prévia mobile da página inicial"
                            className="h-full w-full border-0 bg-black"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
