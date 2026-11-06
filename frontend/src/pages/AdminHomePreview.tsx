import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Monitor, RefreshCw, Smartphone } from 'lucide-react';
import api from '../services/api';
import { AdminPage, ErrorState, LoadingState } from '../components/admin/AdminPage';

type Item = { id: number; title: string; cover_url?: string; banner?: string };
type Section = { id: number | string; title: string; items: Item[] };
type Preview = { hero?: Item; sections?: Section[] };

export default function AdminHomePreview() {
  const [searchParams] = useSearchParams();
  const previewSeriesId = searchParams.get('previewSeries') || searchParams.get('seriesId');
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [reloadKey, setReloadKey] = useState(0);
  const reqGenRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    reqGenRef.current++;
    abortControllerRef.current?.abort();

    let active = true;
    const generation = reqGenRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(false);

    const prevReq = api.get('/admin/home-preview', { signal: controller.signal });
    const seriesReq = previewSeriesId
      ? api.get(`/series/${previewSeriesId}`, { signal: controller.signal })
      : Promise.resolve(null);

    Promise.all([prevReq, seriesReq])
      .then(([r, s]) => {
        if (!active || controller.signal.aborted || reqGenRef.current !== generation) return;
        const previewData: Preview = r.data ? { ...r.data } : {};
        if (s?.data) {
          previewData.hero = {
            id: s.data.id,
            title: s.data.title,
            banner: s.data.banner_image || s.data.cover_image,
            cover_url: s.data.cover_image,
          };
        }
        setData(previewData);
      })
      .catch(() => {
        if (!active || controller.signal.aborted || reqGenRef.current !== generation) return;
        setError(true);
      })
      .finally(() => {
        if (!active || controller.signal.aborted || reqGenRef.current !== generation) return;
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [previewSeriesId, reloadKey]);

  const handleReload = () => {
    setReloadKey(v => v + 1);
  };

  return (
    <AdminPage
      eyebrow="Antes de publicar"
      title={data?.hero?.title && previewSeriesId ? `Pré-visualização da Home · ${data.hero.title}` : "Pré-visualização da Home"}
      description="Confira banners e fileiras como aparecem para o público, sem sair do painel."
      action={
        <div className="flex rounded-xl border border-white/10 bg-[#0d0d0d] p-1">
          <button
            title="Celular"
            onClick={() => setDevice('mobile')}
            className={`rounded-lg p-2 ${device === 'mobile' ? 'bg-yellow-500 text-black' : 'text-gray-400'}`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          <button
            title="Computador"
            onClick={() => setDevice('desktop')}
            className={`rounded-lg p-2 ${device === 'desktop' ? 'bg-yellow-500 text-black' : 'text-gray-400'}`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            title="Atualizar"
            onClick={handleReload}
            className="rounded-lg p-2 text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {error && <ErrorState message="Não foi possível montar a prévia da Home." />}
      {loading ? (
        <LoadingState />
      ) : (
        data && (
          <div
            className={`mx-auto overflow-hidden rounded-[1.8rem] border-[6px] border-[#242424] bg-black shadow-2xl transition-all ${
              device === 'mobile' ? 'max-w-[390px]' : 'max-w-6xl'
            }`}
          >
            <div
              className={`relative bg-[#111] ${
                device === 'mobile' ? 'aspect-[4/5]' : 'aspect-[16/6]'
              }`}
            >
              {(data.hero?.banner ?? data.hero?.cover_url) && (
                <img
                  src={data.hero?.banner ?? data.hero?.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent" />
              <p className="absolute bottom-5 left-5 text-xl font-bold text-white">
                {data.hero?.title ?? 'Destaque principal'}
              </p>
            </div>
            <div className="space-y-6 p-5">
              {(data.sections ?? []).map((section) => (
                <section key={section.id}>
                  <h3 className="mb-3 text-sm font-semibold text-white">{section.title}</h3>
                  <div className="flex gap-2 overflow-hidden">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className={`shrink-0 overflow-hidden rounded-lg bg-[#181818] ${
                          device === 'mobile' ? 'w-24' : 'w-32'
                        }`}
                      >
                        <div className="aspect-[2/3]">
                          {item.cover_url && (
                            <img src={item.cover_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <p className="truncate px-2 py-2 text-[10px] text-gray-300">{item.title}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {!data.sections?.length && (
                <p className="py-12 text-center text-sm text-gray-600">Nenhuma fileira configurada.</p>
              )}
            </div>
          </div>
        )
      )}
    </AdminPage>
  );
}
