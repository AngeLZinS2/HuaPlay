import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

type Issue = { id?: number | string; title?: string; series_title?: string; label?: string; issue?: string; message?: string; severity?: string; href?: string; series_id?: number };
type HealthData = {
  summary?: Record<string, number>; issues?: Issue[]; pending?: Issue[]; alerts?: Issue[];
  checked_at?: string; total?: number; page?: number; page_size?: number; total_pages?: number;
};

const summaryLabels: Record<string, string> = {
  series_without_episodes: 'Séries sem episódios', series_without_cover: 'Séries sem capa',
  series_without_banner: 'Séries sem banner', series_without_synopsis: 'Séries sem sinopse',
  series_without_trailer: 'Séries sem trailer', episodes_without_source: 'Episódios sem fonte',
};
const inputClass = 'rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2.5 text-sm text-white outline-none transition focus:border-yellow-500/50';

export default function AdminHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [issueType, setIssueType] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [search, issueType, severity]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/catalog/health', {
        params: { page, page_size: pageSize, search: search || undefined, issue_type: issueType, severity },
      });
      setData(response.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, issueType, severity]);

  useEffect(() => { void load(); }, [load]);

  const issues = data?.issues ?? data?.pending ?? data?.alerts ?? [];
  const groupedIssues = useMemo(() => {
    const groups = new Map<string, Issue & { descriptions: string[] }>();
    for (const issue of issues) {
      const key = String(issue.series_id ?? issue.series_title ?? issue.title ?? issue.id);
      const description = issue.label ?? issue.issue ?? issue.message ?? 'Pendência sem descrição';
      const current = groups.get(key);
      if (current) {
        if (!current.descriptions.includes(description)) current.descriptions.push(description);
        if (issue.severity === 'critical') current.severity = 'critical';
      } else {
        groups.set(key, { ...issue, descriptions: [description] });
      }
    }
    return [...groups.values()];
  }, [issues]);

  const total = data?.total ?? groupedIssues.length;
  const currentPage = data?.page ?? page;
  const totalPages = data?.total_pages ?? 1;
  const firstItem = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(currentPage * pageSize, total);
  const hasFilters = Boolean(searchInput || issueType !== 'all' || severity !== 'all');
  const clearFilters = () => { setSearchInput(''); setSearch(''); setIssueType('all'); setSeverity('all'); setPage(1); };

  return <div className="mx-auto max-w-7xl p-5 sm:p-7 lg:p-9">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-2 text-xs uppercase tracking-[.2em] text-yellow-500">Catálogo</p><h1 className="text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: 'Cinzel, serif' }}>Central de pendências</h1><p className="mt-2 text-sm text-gray-500">Problemas de cadastro e reprodução que precisam de revisão.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Atualizar</button>
    </div>

    {data?.summary && <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Object.entries(data.summary).map(([label, count]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-4"><p className="text-xs text-gray-500">{summaryLabels[label] ?? label.replaceAll('_', ' ')}</p><p className="mt-2 text-2xl font-semibold text-white">{count.toLocaleString('pt-BR')}</p></div>)}</div>}

    <div className="mb-4 grid gap-3 rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-4 md:grid-cols-[minmax(220px,1fr)_220px_180px_auto]">
      <label className="relative"><span className="sr-only">Buscar série</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"/><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar pelo título…" className={`${inputClass} w-full pl-9`} /></label>
      <select aria-label="Filtrar por pendência" value={issueType} onChange={(event) => setIssueType(event.target.value)} className={inputClass}><option value="all">Todas as pendências</option><option value="cover">Sem capa</option><option value="banner">Sem banner</option><option value="synopsis">Sem sinopse</option><option value="trailer">Sem trailer</option><option value="episodes">Sem episódios</option><option value="source">Episódios sem fonte</option></select>
      <select aria-label="Filtrar por gravidade" value={severity} onChange={(event) => setSeverity(event.target.value)} className={inputClass}><option value="all">Todas as gravidades</option><option value="critical">Somente críticas</option><option value="warning">Somente avisos</option></select>
      <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"><X className="h-4 w-4"/>Limpar</button>
    </div>

    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d0d]">
      {loading ? <div className="p-6 text-sm text-gray-500">Carregando pendências…</div> : error ? <div className="p-6 text-sm text-red-300">Não foi possível carregar as pendências. Tente novamente.</div> : groupedIssues.length ? <div className="divide-y divide-white/[0.06]">{groupedIssues.map((issue, index) => { const title = issue.series_title ?? issue.title ?? 'Item do catálogo'; const description = issue.descriptions.join(' · '); const href = issue.href ?? (issue.series_id ? `/admin/series?edit=${issue.series_id}` : '/admin/series'); return <div key={issue.id ?? `${title}-${index}`} className="flex items-start gap-3 p-4 sm:p-5"><AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${issue.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}/><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{title}</p><p className="mt-1 text-sm text-gray-400">{description}</p></div><Link to={href} className="inline-flex shrink-0 items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">Revisar <ExternalLink className="h-3 w-3"/></Link></div>; })}</div> : <div className="flex flex-col items-center p-10 text-center"><CheckCircle2 className="mb-3 h-8 w-8 text-green-400"/><p className="font-medium text-white">Nenhuma pendência encontrada</p><p className="mt-1 text-sm text-gray-500">Tente remover algum filtro ou buscar outro título.</p></div>}
    </div>

    {!loading && !error && total > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500"><span>Exibindo {firstItem}–{lastItem} de {total} séries</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/5 disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="h-4 w-4"/></button><span className="min-w-24 text-center">Página {currentPage} de {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/5 disabled:opacity-30" aria-label="Próxima página"><ChevronRight className="h-4 w-4"/></button></div></div>}
    {data?.checked_at && <p className="mt-3 text-right text-xs text-gray-600">Verificado em {new Date(data.checked_at).toLocaleString('pt-BR')}</p>}
  </div>;
}
