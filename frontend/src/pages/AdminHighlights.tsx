import { useEffect, useState } from 'react';
import { Edit3, Eye, EyeOff, Image, LogOut, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { getOptimizedImageUrl } from '../utils/image';
import { AdminPage, ErrorState, LoadingState, buttonClass, inputClass } from '../components/admin/AdminPage';

type Banner = { id: number; title: string; subtitle?: string; image_url: string; series_id?: number; action_url?: string; duration_seconds?: number; position?: number; is_active?: boolean };
type SeriesResult = { id: number; title: string; slug?: string; cover_image?: string; banner_image?: string; description?: string };
const empty = { title: '', subtitle: '', image_url: '', series_id: '', action_url: '', duration_seconds: 8 };
const devices = {
  galaxyS20Ultra: { label: 'Samsung Galaxy S20 Ultra', width: 412, height: 915 },
  galaxyA55: { label: 'Samsung Galaxy A55', width: 412, height: 915 },
  iphone16: { label: 'iPhone 16', width: 393, height: 852 },
  pixel9: { label: 'Pixel 9', width: 412, height: 915 },
} as const;

function MobileHighlightPreview({ title, subtitle, imageUrl }: { title: string; subtitle: string; imageUrl: string }) {
  const [deviceKey, setDeviceKey] = useState<keyof typeof devices>('galaxyS20Ultra');
  const [platform, setPlatform] = useState<'PWA' | 'APK'>('PWA');
  const device = devices[deviceKey];
  return <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-semibold text-white">Prévia da abertura</p><p className="text-[10px] text-gray-500">{device.width} × {device.height}px</p></div>
      <div className="flex gap-2">
        <div className="flex rounded-lg border border-white/10 bg-black p-0.5">{(['PWA','APK'] as const).map(value => <button key={value} type="button" onClick={() => setPlatform(value)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${platform === value ? 'bg-yellow-500 text-black' : 'text-gray-500'}`}>{value}</button>)}</div>
        <select value={deviceKey} onChange={event => setDeviceKey(event.target.value as keyof typeof devices)} className="rounded-lg border border-white/10 bg-black px-2 text-[10px] text-gray-300 outline-none">
          {Object.entries(devices).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </div>
    </div>
    <div className="mx-auto w-full max-w-[330px] overflow-hidden rounded-[2rem] border-[5px] border-[#292929] bg-black shadow-2xl" style={{ aspectRatio: `${device.width} / ${device.height}` }}>
      <div className="relative h-full overflow-hidden bg-black text-white">
        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-[74%] w-full object-cover object-center"/>}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 via-45% to-black to-[76%]"/>
        <div className="absolute left-4 right-4 top-3 flex items-center justify-between text-[8px] font-semibold"><span>{platform === 'APK' ? '00:26' : 'HUA PLAY'}</span><span className="rounded-full border border-white/20 bg-black/30 px-2 py-1">{platform}</span></div>
        <div className="absolute right-4 top-11"><LogOut className="h-3.5 w-3.5 text-white/80"/></div>
        <div className="absolute inset-x-5 bottom-[31%] text-center">
          <p className="line-clamp-2 text-sm font-semibold drop-shadow-lg">{title || 'Título do destaque'}</p>
          <p className="mt-1 line-clamp-2 text-[8px] leading-relaxed text-white/85 drop-shadow-lg">{subtitle || 'Mensagem opcional do destaque'}</p>
        </div>
        <div className="absolute inset-x-4 bottom-[6%] text-center">
          <p className="mb-4 text-base font-medium">Escolha o seu perfil</p>
          <div className="grid grid-cols-3 gap-3">
            {['Angelo','Victor','Editar'].map((name, index) => <div key={name}><div className={`mx-auto grid aspect-square w-full place-items-center rounded-xl border border-white/15 ${index === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-800' : index === 1 ? 'bg-gradient-to-br from-cyan-700 to-slate-800' : 'bg-white/15'}`}>{index === 2 ? <Edit3 className="h-6 w-6"/> : <span className="text-xl">●</span>}</div><p className="mt-1.5 truncate text-[9px] font-semibold">{name}</p></div>)}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export default function AdminHighlights() {
  const [items, setItems] = useState<Banner[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [results, setResults] = useState<SeriesResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(false); api.get('/admin/hero-banners').then(r => setItems(r.data.items ?? r.data ?? [])).catch(() => setError(true)).finally(() => setLoading(false)); };
  useEffect(load, []);
  useEffect(() => {
    if (catalogSearch.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { const response = await api.get('/series/', { params: { search: catalogSearch.trim(), limit: 8 } }); setResults(response.data || []); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogSearch]);

  const selectSeries = (series: SeriesResult) => {
    setForm({ title: series.title, subtitle: series.description ? series.description.slice(0, 120) : '', image_url: series.banner_image || series.cover_image || '', series_id: String(series.id), action_url: `/series/${series.slug || series.id}`, duration_seconds: 8 });
    setCatalogSearch(''); setResults([]); setEditingId(null);
  };
  const reset = () => { setForm(empty); setEditingId(null); setCatalogSearch(''); setResults([]); };
  const save = async () => {
    if (!form.series_id || !form.title || !form.image_url) return;
    setSaving(true); setError(false);
    const payload = { ...form, series_id: Number(form.series_id), position: editingId ? undefined : items.length, is_active: true };
    try { if (editingId) await api.patch(`/admin/hero-banners/${editingId}`, payload); else await api.post('/admin/hero-banners', payload); reset(); load(); }
    catch { setError(true); }
    finally { setSaving(false); }
  };
  const edit = (item: Banner) => { setEditingId(item.id); setForm({ title: item.title || '', subtitle: item.subtitle || '', image_url: item.image_url || '', series_id: String(item.series_id || ''), action_url: item.action_url || '', duration_seconds: item.duration_seconds || 8 }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const patch = async (item: Banner, body: Partial<Banner>) => { try { await api.patch(`/admin/hero-banners/${item.id}`, body); setItems(value => value.map(current => current.id === item.id ? { ...current, ...body } : current)); } catch { setError(true); } };
  const remove = async (id: number) => { if (!confirm('Remover este destaque?')) return; await api.delete(`/admin/hero-banners/${id}`); setItems(value => value.filter(item => item.id !== id)); };

  return <AdminPage eyebrow="Experiência inicial" title="Destaques PWA e APK" description="Escolha um conteúdo do catálogo e personalize, se quiser, o banner e a mensagem exibidos na abertura do PWA e do aplicativo.">
    {error && <div className="mb-4"><ErrorState/></div>}
    <section className="mb-7 rounded-2xl border border-white/[.07] bg-[#0d0d0d] p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">{editingId ? 'Editar destaque' : 'Escolher conteúdo'}</h2><p className="mt-1 text-xs text-gray-500">Pesquise pelo nome da série ou filme. Os dados serão preenchidos automaticamente.</p></div>{editingId && <button onClick={reset} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4"/></button>}</div>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"/><input value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} className={`${inputClass} pl-10`} placeholder="Buscar conteúdo do catálogo…"/></div>
      {(searching || results.length > 0) && <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3">{searching ? <p className="py-4 text-center text-sm text-gray-500">Buscando…</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{results.map(series => <button key={series.id} onClick={() => selectSeries(series)} className="flex items-center gap-3 rounded-xl border border-white/[.07] p-2 text-left hover:border-yellow-500/40 hover:bg-yellow-500/5"><img src={getOptimizedImageUrl(series.cover_image, 'thumbnail')} alt="" className="h-14 w-10 rounded object-cover bg-white/5"/><span className="min-w-0"><b className="block truncate text-xs text-white">{series.title}</b><span className="text-[10px] text-gray-600">Selecionar conteúdo</span></span></button>)}</div>}</div>}
      {form.series_id && <div className="mt-5 grid items-start gap-6 lg:grid-cols-[380px_1fr]"><MobileHighlightPreview title={form.title} subtitle={form.subtitle} imageUrl={form.image_url}/><div className="space-y-3"><label className="block text-xs text-gray-400">Título<input value={form.title} onChange={event => setForm({...form,title:event.target.value})} className={`${inputClass} mt-1.5`}/></label><label className="block text-xs text-gray-400">Mensagem<textarea value={form.subtitle} onChange={event => setForm({...form,subtitle:event.target.value})} className={`${inputClass} mt-1.5 min-h-20 resize-none`} placeholder="Mensagem opcional para este destaque"/></label><label className="block text-xs text-gray-400">Banner personalizado <span className="text-gray-600">(opcional)</span><input value={form.image_url} onChange={event => setForm({...form,image_url:event.target.value})} className={`${inputClass} mt-1.5`} placeholder="A imagem cadastrada na série já foi preenchida"/></label><div className="grid grid-cols-[1fr_auto] gap-3"><label className="block text-xs text-gray-400">Tempo por banner<select value={form.duration_seconds} onChange={event => setForm({...form,duration_seconds:Number(event.target.value)})} className={`${inputClass} mt-1.5`}><option value={5}>5 segundos</option><option value={8}>8 segundos</option><option value={10}>10 segundos</option><option value={15}>15 segundos</option></select></label><button disabled={saving || !form.image_url} onClick={() => void save()} className={`${buttonClass} mt-5`}><Save className="h-4 w-4"/>{saving ? 'Salvando…' : editingId ? 'Atualizar' : 'Adicionar'}</button></div></div></div>}
    </section>
    {loading ? <LoadingState/> : <div className="grid gap-4 md:grid-cols-2">{items.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0d0d0d]"><div className="relative aspect-[16/7] bg-black">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center"><Image className="text-gray-700"/></div>}<div className="absolute inset-0 bg-gradient-to-t from-black via-transparent"/><div className="absolute bottom-3 left-4 right-4"><p className="font-semibold text-white">{item.title}</p><p className="truncate text-xs text-gray-300">{item.subtitle || 'Sem mensagem'}</p></div></div><div className="flex items-center gap-2 p-3"><span className="mr-auto text-xs text-gray-500">{item.duration_seconds ?? 8}s · posição {(item.position ?? 0)+1}</span><button title="Mostrar ou ocultar" onClick={() => void patch(item,{is_active:!item.is_active})} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white">{item.is_active === false ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button><button title="Editar destaque" onClick={() => edit(item)} className="rounded-lg p-2 text-gray-400 hover:bg-blue-500/10 hover:text-blue-300"><Pencil className="h-4 w-4"/></button><button title="Excluir" onClick={() => void remove(item.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4"/></button></div></article>)}{!items.length && <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-10 text-center"><Plus className="mx-auto mb-3 h-7 w-7 text-yellow-500"/><p className="text-sm text-gray-400">Pesquise um conteúdo acima para criar o primeiro destaque.</p></div>}</div>}
  </AdminPage>;
}
