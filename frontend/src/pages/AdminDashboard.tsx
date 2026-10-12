import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, Clock3, Eye, Film, PlayCircle, Users } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { getOptimizedImageUrl } from '../utils/image';

type ContentItem = { id: number; title: string; cover_image?: string | null; type?: string; views_count?: number; created_at?: string };
type DashboardData = {
  total_content?: number; total_series?: number; total_episodes?: number; total_actors?: number;
  total_views?: number; plays_30d?: number; quality_alerts?: Array<{ label: string; count: number; href?: string }>;
  top_content?: ContentItem[]; recent_content?: ContentItem[];
};

const card = 'rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-5';
const number = (value?: number) => (value ?? 0).toLocaleString('pt-BR');

export default function AdminDashboard() {
  const { addToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let dashboard: DashboardData;
        try {
          const response = await api.get('/admin/dashboard');
          dashboard = response.data;
        } catch {
          // Compatibility while the admin aggregate endpoint is being added.
          const [statsRes, actorsRes, seriesRes] = await Promise.all([
            api.get('/series/stats'), api.get('/actors/', { params: { limit: 1 } }),
            api.get('/series/', { params: { limit: 5, skip: 0 } }),
          ]);
          const stats = statsRes.data;
          const items = Array.isArray(seriesRes.data) ? seriesRes.data : [];
          dashboard = {
            total_content: stats.total,
            total_series: stats.total,
            total_actors: Number(actorsRes.headers['x-total-count']) || (Array.isArray(actorsRes.data) ? actorsRes.data.length : 0),
            total_views: stats.total_views ?? stats.views_count,
            quality_alerts: [], top_content: [...items].sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0)).slice(0, 5),
            recent_content: items,
          };
        }
        if (active) setData(dashboard);
      } catch {
        if (active) addToast('Não foi possível carregar os indicadores administrativos.', 'error');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [addToast]);

  const kpis = [
    { label: 'Conteúdos no catálogo', value: data?.total_content ?? data?.total_series, icon: Film, tint: 'text-yellow-400' },
    { label: 'Episódios cadastrados', value: data?.total_episodes, icon: PlayCircle, tint: 'text-blue-400' },
    { label: 'Atores cadastrados', value: data?.total_actors, icon: Users, tint: 'text-purple-400' },
    { label: 'Visualizações de detalhes', value: data?.total_views ?? data?.plays_30d, icon: Eye, tint: 'text-green-400' },
  ];
  const top = data?.top_content ?? [];
  const recent = data?.recent_content ?? [];

  return <div className="mx-auto max-w-7xl p-5 sm:p-7 lg:p-9">
    <header className="mb-7"><p className="mb-2 text-xs uppercase tracking-[.2em] text-yellow-500">HuaPlay · Administração</p><h1 className="text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: 'Cinzel, serif' }}>Visão geral</h1><p className="mt-2 text-sm text-gray-500">Indicadores do catálogo e da atividade de reprodução.</p></header>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map(({ label, value, icon: Icon, tint }) => <div className={card} key={label}><div className="mb-5 flex items-center justify-between"><span className="text-sm text-gray-400">{label}</span><Icon className={`h-5 w-5 ${tint}`} /></div><p className="text-3xl font-semibold text-white">{loading ? '—' : number(value)}</p></div>)}
    </section>
    <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className={card}>
        <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400"/><h2 className="font-semibold text-white">Alertas de qualidade</h2></div><Link className="text-xs text-yellow-400 hover:text-yellow-300" to="/admin/health">Central de pendências <ArrowRight className="ml-1 inline h-3 w-3"/></Link></div>
        {loading ? <p className="text-sm text-gray-500">Carregando…</p> : (data?.quality_alerts?.length ?? 0) > 0 ? <div className="space-y-2">{data!.quality_alerts!.slice(0, 5).map((alert, i) => <Link key={`${alert.label}-${i}`} to={alert.href ?? '/admin/health'} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3 text-sm hover:bg-white/[0.06]"><span className="text-gray-300">{alert.label}</span><span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">{number(alert.count)}</span></Link>)}</div> : <div className="rounded-xl bg-white/[0.03] p-4 text-sm text-gray-500"><Activity className="mb-2 h-4 w-4 text-green-400"/>Sem alertas retornados pela API.</div>}
      </div>
      <div className={card}>
        <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-yellow-400"/><h2 className="font-semibold text-white">Mais visualizados</h2></div><Link className="text-xs text-yellow-400 hover:text-yellow-300" to="/admin/reports">Relatórios <ArrowRight className="ml-1 inline h-3 w-3"/></Link></div>
        <ContentList items={top} loading={loading} empty="Ainda sem dados de visualização." metric="views_count"/>
      </div>
    </section>
    <section className={`${card} mt-5`}>
      <div className="mb-4 flex items-center gap-2"><Clock3 className="h-4 w-4 text-yellow-400"/><h2 className="font-semibold text-white">Conteúdos recentes</h2><Link className="ml-auto text-xs text-yellow-400 hover:text-yellow-300" to="/admin/series">Abrir catálogo <ArrowRight className="ml-1 inline h-3 w-3"/></Link></div>
      <ContentList items={recent} loading={loading} empty="Nenhum conteúdo recente."/>
    </section>
  </div>;
}

function ContentList({ items, loading, empty, metric }: { items: ContentItem[]; loading: boolean; empty: string; metric?: 'views_count' }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]"/>)}</div>;
  if (!items.length) return <p className="py-4 text-sm text-gray-600">{empty}</p>;
  return <div className="divide-y divide-white/[0.05]">{items.slice(0, 5).map(item => <div key={item.id} className="flex items-center gap-3 py-2.5"><img src={getOptimizedImageUrl(item.cover_image, 'thumbnail')} alt="" className="h-12 w-9 rounded object-cover bg-white/5"/><div className="min-w-0 flex-1"><p className="truncate text-sm text-white">{item.title}</p><p className="text-xs text-gray-500">{item.type ?? 'Conteúdo'}{item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString('pt-BR')}` : ''}</p></div>{metric && <span className="text-xs text-gray-400">{number(item.views_count)} views</span>}</div>)}</div>;
}
