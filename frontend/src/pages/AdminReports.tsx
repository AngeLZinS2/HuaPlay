import { useEffect, useState } from 'react';
import { CalendarDays, Eye, Play } from 'lucide-react';
import api from '../services/api';

type ReportRow = { id?: number | string; series_id?: number; episode_id?: number; title?: string; series_title?: string; category?: string; reason?: string; message?: string; page_url?: string; source_url?: string; created_at?: string; date?: string; played_at?: string; status?: string; admin_note?: string };
type ReportData = { total_plays?: number; plays?: number; unique_viewers?: number; rows?: ReportRow[]; items?: ReportRow[]; reports?: ReportRow[]; by_day?: Array<{ date: string; plays: number }> };
const reasonLabels: Record<string, string> = { video_not_playing: 'Vídeo não abre', wrong_episode: 'Episódio incorreto', audio_or_subtitle: 'Áudio ou legenda', poor_quality: 'Qualidade ruim', removed_link: 'Link removido', other: 'Outro problema' };
export default function AdminReports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    api.get('/admin/reports', { params: status === 'all' ? {} : { status } })
      .then(response => { if (active) setData(Array.isArray(response.data) ? { rows: response.data } : response.data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);
  const rows = data?.rows ?? data?.items ?? data?.reports ?? [];
  const updateStatus = async (id: ReportRow['id'], nextStatus: string) => {
    if (id == null) return;
    try {
      const row = rows.find(item => item.id === id);
      await api.patch(`/admin/reports/${id}`, { status: nextStatus, admin_note: row?.admin_note ?? '' });
      setData(current => current ? { rows: rows.map(item => item.id === id ? { ...item, status: nextStatus } : item) } : current);
    } catch { setError(true); }
  };
  return <div className="mx-auto max-w-7xl p-5 sm:p-7 lg:p-9">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs uppercase tracking-[.2em] text-yellow-500">Qualidade</p><h1 className="text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: 'Cinzel, serif' }}>Relatórios de reprodução</h1><p className="mt-2 text-sm text-gray-500">Revise e classifique os relatos recebidos sobre a reprodução.</p></div><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2 text-sm text-gray-300"><CalendarDays className="h-4 w-4 text-yellow-400"/><span className="sr-only">Status</span><select aria-label="Filtrar por status" value={status} onChange={e => setStatus(e.target.value)} className="bg-transparent outline-none"><option className="bg-[#111]" value="open">Abertos</option><option className="bg-[#111]" value="in_progress">Em andamento</option><option className="bg-[#111]" value="resolved">Resolvidos</option><option className="bg-[#111]" value="dismissed">Arquivados</option><option className="bg-[#111]" value="all">Todos</option></select></label></div>
    {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">Não foi possível carregar /admin/reports. Confirme se o endpoint de relatórios está disponível.</div> : <>
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d0d]"><div className="flex items-center gap-2 border-b border-white/[0.06] p-5"><Eye className="h-4 w-4 text-yellow-400"/><h2 className="font-semibold text-white">Relatos de reprodução</h2></div>{loading ? <p className="p-5 text-sm text-gray-500">Carregando…</p> : rows.length ? <div className="divide-y divide-white/[0.06]">{rows.map((row, index) => <div key={row.id ?? index} className="flex flex-wrap items-center gap-3 p-4"><Play className="h-4 w-4 shrink-0 text-gray-500"/><div className="min-w-0 flex-1"><p className="text-sm text-white">{row.series_title ?? row.title ?? reasonLabels[row.reason ?? ''] ?? row.reason ?? row.category ?? 'Relato de reprodução'}</p><p className="mt-1 text-xs text-yellow-500/80">{row.series_id ? `Série #${row.series_id}` : 'Série não informada'}{row.episode_id ? ` · Episódio #${row.episode_id}` : ''}</p>{row.message && <p className="mt-1 text-sm text-gray-400">{row.message}</p>}<p className="mt-1 text-xs text-gray-500">{row.created_at ?? row.played_at ?? row.date ? new Date(row.created_at ?? row.played_at ?? row.date!).toLocaleString('pt-BR') : '—'}{row.admin_note ? ` · Nota admin: ${row.admin_note}` : ''}</p></div><span className="text-xs text-gray-400">{row.status ?? 'open'}</span>{row.id != null && row.status === 'open' && <button onClick={() => void updateStatus(row.id, 'in_progress')} className="rounded-lg border border-blue-500/20 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-500/10">Atender</button>}{row.id != null && row.status !== 'resolved' && <button onClick={() => void updateStatus(row.id, 'resolved')} className="rounded-lg border border-green-500/20 px-2.5 py-1.5 text-xs text-green-300 hover:bg-green-500/10">Resolver</button>}{row.id != null && row.status !== 'dismissed' && <button onClick={() => void updateStatus(row.id, 'dismissed')} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/5">Arquivar</button>}</div>)}</div> : <p className="p-5 text-sm text-gray-600">Nenhum relato para este filtro.</p>}</div>
    </>}
  </div>;
}
