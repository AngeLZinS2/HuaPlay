import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Home, Library, Pencil, Plus, RotateCw, Save, Search, Sparkles, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { getOptimizedImageUrl } from '../utils/image';

type HomeSection = {
  id: number; title: string; section_type: string; filter_value?: string | null;
  series_ids?: string | null; item_limit: number; position: number; is_active: boolean; items?: any[];
};
type SeriesItem = { id: number; title: string; cover_image?: string | null; year?: number | null };
type PresetItem = {
  key: string; title: string; section_type: string; filter_value: string;
  item_limit: number; is_anchor: boolean; badge: string; description: string;
  count: number; is_added: boolean;
};

const emptyForm = { title: '', section_type: 'latest', filter_value: '', series_ids: '', item_limit: 18, is_active: true };
const typeLabels: Record<string, string> = {
  latest: 'Lançamentos recentes',
  popular: 'Mais visualizados',
  genre: 'Por gênero',
  type: 'Por tipo',
  country: 'Por país',
  status: 'Por status',
  manual: 'Seleção manual',
};
const inputClass = 'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/50';

const ASIAN_COUNTRIES = [
  { name: 'China', label: 'China 🇨🇳' },
  { name: 'South Korea', label: 'Coreia do Sul 🇰🇷' },
  { name: 'Thailand', label: 'Tailândia 🇹🇭' },
  { name: 'Japan', label: 'Japão 🇯🇵' },
  { name: 'Taiwan', label: 'Taiwan 🇹🇼' },
  { name: 'Philippines', label: 'Filipinas 🇵🇭' },
];

export default function AdminHome() {
  const { addToast } = useToast();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Content picker state
  const [pickerSection, setPickerSection] = useState<HomeSection | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState<SeriesItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SeriesItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);

  // Genre options & preview
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [genrePreview, setGenrePreview] = useState<SeriesItem[]>([]);
  const [genreTotal, setGenreTotal] = useState(0);

  // Preset & Smart Curation Modal
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [curating, setCurating] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setSections((await api.get('/admin/home-sections')).data || []); }
    catch { addToast('Erro ao carregar a organização da Home.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    api.get('/admin/home-section-options')
      .then(response => setAvailableGenres(response.data?.genres || []))
      .catch(() => setAvailableGenres([]));
  }, []);

  const loadPresets = async () => {
    setLoadingPresets(true);
    try {
      const res = await api.get('/admin/home-section-presets');
      setPresets(res.data || []);
    } catch {
      addToast('Não foi possível carregar as sugestões do catálogo.', 'error');
    } finally {
      setLoadingPresets(false);
    }
  };

  useEffect(() => {
    if (!formOpen || form.section_type !== 'genre' || !form.filter_value) {
      setGenrePreview([]);
      setGenreTotal(0);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get('/series/', { params: { genre: form.filter_value, limit: 8, skip: 0 } });
        if (active) {
          setGenrePreview(Array.isArray(response.data) ? response.data : []);
          setGenreTotal(Number(response.headers['x-total-count'] || response.data?.length || 0));
        }
      } catch { if (active) { setGenrePreview([]); setGenreTotal(0); } }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [formOpen, form.section_type, form.filter_value]);

  useEffect(() => {
    if (!pickerSection) return;
    const timer = window.setTimeout(async () => {
      setPickerLoading(true);
      try {
        const response = await api.get('/series/', { params: { search: pickerSearch.trim() || undefined, limit: 30, skip: 0 } });
        setPickerResults(Array.isArray(response.data) ? response.data : []);
      } catch { addToast('Não foi possível buscar os conteúdos.', 'error'); }
      finally { setPickerLoading(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pickerSection, pickerSearch]);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (section: HomeSection) => {
    setEditingId(section.id);
    setForm({ title: section.title, section_type: section.section_type, filter_value: section.filter_value || '', series_ids: section.series_ids || '', item_limit: section.item_limit, is_active: section.is_active });
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) await api.put(`/admin/home-sections/${editingId}`, form);
      else await api.post('/admin/home-sections', form);
      addToast(editingId ? 'Fileira atualizada.' : 'Fileira criada.', 'success');
      setFormOpen(false);
      await load();
    } catch { addToast('Não foi possível salvar a fileira.', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (section: HomeSection) => {
    try {
      await api.put(`/admin/home-sections/${section.id}`, { is_active: !section.is_active });
      setSections(current => current.map(item => item.id === section.id ? { ...item, is_active: !item.is_active } : item));
    } catch { addToast('Não foi possível alterar a visibilidade.', 'error'); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSections(reordered);
    try { await api.post('/admin/home-sections/reorder', { ids: reordered.map(item => item.id) }); }
    catch { addToast('Não foi possível alterar a ordem.', 'error'); await load(); }
  };

  const remove = async (section: HomeSection) => {
    if (!window.confirm(`Excluir a fileira “${section.title}”?`)) return;
    try { await api.delete(`/admin/home-sections/${section.id}`); addToast('Fileira excluída.', 'success'); await load(); }
    catch { addToast('Não foi possível excluir a fileira.', 'error'); }
  };

  const applyFullCuratedLayout = async () => {
    if (!window.confirm('Substituir a organização atual pela curadoria completa de 16 fileiras concisas do catálogo asiático?')) return;
    setCurating(true);
    try {
      await api.post('/admin/home-sections/auto-curate');
      addToast('Curadoria completa do catálogo asiático aplicada com sucesso!', 'success');
      setPresetModalOpen(false);
      await load();
    } catch {
      addToast('Erro ao aplicar curadoria.', 'error');
    } finally {
      setCurating(false);
    }
  };

  const rotateThematicSections = async () => {
    setRotating(true);
    try {
      await api.post('/admin/home-sections/rotate');
      addToast('Fileiras temáticas rotacionadas com sucesso na Home!', 'success');
      await load();
    } catch {
      addToast('Erro ao rotacionar fileiras.', 'error');
    } finally {
      setRotating(false);
    }
  };

  const addPresetRow = async (presetKey: string) => {
    try {
      await api.post('/admin/home-sections/add-preset', { key: presetKey });
      addToast('Nova fileira adicionada à Home com sucesso!', 'success');
      await load();
      await loadPresets();
    } catch {
      addToast('Não foi possível adicionar a fileira sugerida.', 'error');
    }
  };

  const openPicker = (section: HomeSection) => {
    setPickerSection(section);
    setPickerSearch('');
    setPickerResults([]);
    setSelectedItems((section.items || []).map(item => ({ id: item.id, title: item.title, cover_image: item.cover_image, year: item.year })));
  };

  const toggleSelected = (item: SeriesItem) => {
    setSelectedItems(current => current.some(selected => selected.id === item.id)
      ? current.filter(selected => selected.id !== item.id)
      : current.length >= 30 ? current : [...current, item]);
  };

  const moveSelected = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedItems.length) return;
    setSelectedItems(current => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  const savePickedContents = async () => {
    if (!pickerSection) return;
    setPickerSaving(true);
    try {
      await api.put(`/admin/home-sections/${pickerSection.id}`, {
        section_type: 'manual',
        filter_value: null,
        series_ids: selectedItems.map(item => item.id).join(','),
        item_limit: Math.max(1, Math.min(30, Math.max(pickerSection.item_limit, selectedItems.length))),
      });
      addToast('Conteúdos da fileira atualizados.', 'success');
      setPickerSection(null);
      await load();
    } catch { addToast('Não foi possível salvar os conteúdos.', 'error'); }
    finally { setPickerSaving(false); }
  };

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden p-4 sm:p-7 lg:p-9">
      {/* Header & Actions */}
      <div className="mb-7 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs uppercase tracking-[.2em] text-yellow-500">Experiência editorial</p>
          <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl" style={{ fontFamily: 'Cinzel, serif' }}>
            Organização da página inicial
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Defina quais fileiras aparecem na Home e em qual ordem. Garanta temas 100% concisos com doramas e filmes asiáticos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/home-preview"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition"
          >
            <Eye className="h-4 w-4" />
            Prévia da Home
          </Link>

          <button
            onClick={() => { setPresetModalOpen(true); void loadPresets(); }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-bold text-yellow-400 hover:bg-yellow-500/20 transition"
          >
            <Sparkles className="h-4 w-4" />
            Sugerir Fileiras Inteligentes
          </button>

          <button
            onClick={() => void rotateThematicSections()}
            disabled={rotating}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
            title="Mantém 'Em Alta' e 'Lançamentos' no topo e rotaciona as fileiras temáticas"
          >
            <RotateCw className={`h-4 w-4 ${rotating ? 'animate-spin' : ''}`} />
            Rotacionar Vitrine
          </button>

          <button
            onClick={openNew}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 transition"
          >
            <Plus className="h-4 w-4" />
            Nova fileira
          </button>
        </div>
      </div>

      {/* Sections List */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d0d0d] p-10 text-center">
          <Home className="mx-auto mb-3 h-9 w-9 text-yellow-500" />
          <h2 className="font-semibold text-white">Nenhuma fileira configurada</h2>
          <p className="mt-1 text-sm text-gray-500">Aplique a curadoria completa com 1 clique para organizar a Home com doramas e filmes asiáticos.</p>
          <button
            onClick={() => void applyFullCuratedLayout()}
            disabled={curating}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            Criar Curadoria Completa (16 Fileiras)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div
              key={section.id}
              className={`min-w-0 rounded-2xl border p-4 sm:p-5 transition ${
                section.is_active ? 'border-white/[0.08] bg-[#0d0d0d]' : 'border-white/[0.04] bg-[#090909] opacity-60'
              }`}
            >
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-yellow-400">
                      {index + 1}
                    </span>
                    <h2 className="break-words text-base font-semibold leading-snug text-white">{section.title}</h2>
                    <span className="max-w-full rounded-full bg-white/5 px-2.5 py-1 text-[11px] leading-tight text-gray-400">
                      {typeLabels[section.section_type] || section.section_type}
                    </span>
                    {section.filter_value && (
                      <span className="break-words rounded-md bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
                        {section.filter_value}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Até {section.item_limit} conteúdos cadastrados · posição {index + 1}
                  </p>
                </div>

                <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 sm:w-auto sm:flex-nowrap sm:justify-start sm:border-0 sm:pt-0">
                  <div className="flex gap-1">
                    <button
                      onClick={() => void move(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-20"
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void move(index, 1)}
                      disabled={index === sections.length - 1}
                      className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-20"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openPicker(section)}
                      className="mr-1 inline-flex items-center gap-2 rounded-lg border border-yellow-500/20 px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10"
                    >
                      <Library className="h-4 w-4" />
                      Conteúdos
                    </button>
                    <button
                      onClick={() => void toggle(section)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
                      title={section.is_active ? 'Ocultar' : 'Exibir'}
                    >
                      {section.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(section)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-blue-500/10 hover:text-blue-400"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void remove(section)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {(section.items?.length ?? 0) > 0 && (
                <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
                  {section.items!.slice(0, 8).map(item => (
                    <img
                      key={item.id}
                      src={getOptimizedImageUrl(item.cover_image, 'thumbnail')}
                      alt={item.title}
                      title={item.title}
                      className="h-20 w-14 shrink-0 rounded-md bg-white/5 object-cover sm:h-16 sm:w-11"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preset / Smart Suggestions Modal */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setPresetModalOpen(false)}>
          <div onClick={event => event.stopPropagation()} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d]">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  <h2 className="text-lg font-bold text-white">Sugerir Fileiras do Catálogo Asiático</h2>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Gera fileiras 100% concisas com o acervo da plataforma (Wuxia, K-Dramas, Lakorns, Comédias Românticas, etc.).
                </p>
              </div>
              <button onClick={() => setPresetModalOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {/* Full Curation Hero Banner */}
              <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="inline-block rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-400 mb-1">
                      Curadoria Completa
                    </span>
                    <h3 className="text-base font-bold text-white">Vitrine Editorial de Alto Desempenho</h3>
                    <p className="mt-1 max-w-md text-xs text-gray-400">
                      Substitui e organiza automaticamente as 16 melhores fileiras segmentadas por gênero, país e formato com base em conteúdos reais.
                    </p>
                  </div>
                  <button
                    onClick={() => void applyFullCuratedLayout()}
                    disabled={curating}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-40 transition"
                  >
                    <Sparkles className="h-4 w-4" />
                    {curating ? 'Aplicando…' : 'Aplicar 16 Fileiras'}
                  </button>
                </div>
              </div>

              {/* Individual Presets Grid */}
              <div>
                <h4 className="mb-3 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  Fileiras Temáticas Disponíveis no Acervo
                </h4>

                {loadingPresets ? (
                  <div className="py-10 text-center text-sm text-gray-500">Calculando conteúdos por gênero e país…</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {presets.map(preset => (
                      <div
                        key={preset.key}
                        className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                          preset.is_added
                            ? 'border-white/10 bg-white/[0.02]'
                            : 'border-white/[0.08] bg-[#121212] hover:border-yellow-500/30'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                              {preset.badge}
                            </span>
                            <span className="text-[11px] font-semibold text-gray-400">
                              {preset.count} títulos
                            </span>
                          </div>
                          <h5 className="font-semibold text-sm text-white">{preset.title}</h5>
                          <p className="mt-1 text-xs text-gray-400 line-clamp-2">{preset.description}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                          <span className="text-[11px] text-gray-500">
                            {typeLabels[preset.section_type]} {preset.filter_value ? `· ${preset.filter_value}` : ''}
                          </span>

                          {preset.is_added ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                              <Check className="h-3.5 w-3.5" /> Na Home
                            </span>
                          ) : (
                            <button
                              onClick={() => void addPresetRow(preset.key)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/20 transition"
                            >
                              <Plus className="h-3.5 w-3.5" /> Adicionar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-white/[0.08] p-4">
              <button
                onClick={() => setPresetModalOpen(false)}
                className="rounded-xl px-5 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add / Edit Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <form onSubmit={save} onClick={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Editar fileira' : 'Nova fileira manual'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm text-gray-300">
                Título da fileira
                <input
                  required
                  value={form.title}
                  onChange={event => setForm({ ...form, title: event.target.value })}
                  placeholder="Ex.: Comédias Românticas Imperdíveis"
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block text-sm text-gray-300">
                Fonte dos conteúdos
                <select
                  value={form.section_type}
                  onChange={event => setForm({ ...form, section_type: event.target.value, filter_value: '', series_ids: '' })}
                  className={`${inputClass} mt-2`}
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {form.section_type === 'genre' && (
                <div>
                  <label className="block text-sm text-gray-300">
                    Gênero cadastrado
                    <select
                      required
                      value={form.filter_value}
                      onChange={event => setForm({ ...form, filter_value: event.target.value })}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Selecione um gênero</option>
                      {availableGenres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  </label>
                  {form.filter_value && (
                    <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Prévia da fileira</span>
                        <span className="text-xs text-yellow-400">{genreTotal} conteúdo{genreTotal === 1 ? '' : 's'} encontrado{genreTotal === 1 ? '' : 's'}</span>
                      </div>
                      {genrePreview.length > 0 ? (
                        <div className="flex gap-2 overflow-hidden">
                          {genrePreview.map(item => (
                            <img
                              key={item.id}
                              src={getOptimizedImageUrl(item.cover_image, 'thumbnail')}
                              alt={item.title}
                              title={item.title}
                              className="h-20 w-14 rounded-md object-cover bg-white/5"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="py-3 text-center text-xs text-gray-600">Nenhum conteúdo desse gênero.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {form.section_type === 'country' && (
                <div>
                  <label className="block text-sm text-gray-300">
                    País Asiático
                    <select
                      required
                      value={form.filter_value}
                      onChange={event => setForm({ ...form, filter_value: event.target.value })}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Selecione o país</option>
                      {ASIAN_COUNTRIES.map(c => (
                        <option key={c.name} value={c.name}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {form.section_type === 'type' && (
                <label className="block text-sm text-gray-300">
                  Tipo
                  <select
                    value={form.filter_value}
                    onChange={event => setForm({ ...form, filter_value: event.target.value })}
                    className={`${inputClass} mt-2`}
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="Series">Séries</option>
                    <option value="Movie">Filmes</option>
                    <option value="Donghua">Donghuas</option>
                  </select>
                </label>
              )}

              {form.section_type === 'status' && (
                <label className="block text-sm text-gray-300">
                  Status
                  <select
                    value={form.filter_value}
                    onChange={event => setForm({ ...form, filter_value: event.target.value })}
                    className={`${inputClass} mt-2`}
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Completo">Completo</option>
                  </select>
                </label>
              )}

              {form.section_type === 'manual' && (
                <label className="block text-sm text-gray-300">
                  IDs das séries
                  <input
                    required
                    value={form.series_ids}
                    onChange={event => setForm({ ...form, series_ids: event.target.value })}
                    className={`${inputClass} mt-2`}
                    placeholder="Ex.: 12, 45, 98"
                  />
                  <span className="mt-1 block text-xs text-gray-600">A ordem dos IDs define a ordem dos conteúdos.</span>
                </label>
              )}

              <label className="block text-sm text-gray-300">
                Quantidade máxima de conteúdos
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.item_limit}
                  onChange={event => setForm({ ...form, item_limit: Number(event.target.value) })}
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={event => setForm({ ...form, is_active: event.target.checked })}
                  className="accent-yellow-500 h-4 w-4"
                />
                Exibir esta fileira na Home
              </label>
            </div>

            <button
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 font-bold text-black hover:bg-yellow-400 disabled:opacity-50 transition"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar fileira'}
            </button>
          </form>
        </div>
      )}

      {/* Manual Content Picker Modal */}
      {pickerSection && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={() => setPickerSection(null)}>
          <div onClick={event => event.stopPropagation()} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d]">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
              <div>
                <h2 className="text-lg font-bold text-white">Conteúdos de “{pickerSection.title}”</h2>
                <p className="mt-1 text-xs text-gray-500">Busque e clique nas capas para montar a fileira. A ordem selecionada será usada na Home.</p>
              </div>
              <button onClick={() => setPickerSection(null)} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {pickerSection.section_type !== 'manual' && (
              <div className="border-b border-yellow-500/10 bg-yellow-500/[0.06] px-5 py-3 text-xs text-yellow-300">
                Esta fileira é automática. Ao salvar sua escolha, ela passará a usar os conteúdos selecionados manualmente.
              </div>
            )}

            <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
              <div className="min-h-0 overflow-y-auto p-5">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input
                    autoFocus
                    value={pickerSearch}
                    onChange={event => setPickerSearch(event.target.value)}
                    placeholder="Buscar pelo nome da série ou filme..."
                    className={`${inputClass} pl-10`}
                  />
                </div>

                {pickerLoading ? (
                  <div className="py-14 text-center text-sm text-gray-500">Buscando conteúdos…</div>
                ) : pickerResults.length === 0 ? (
                  <div className="py-14 text-center text-sm text-gray-500">Nenhum conteúdo encontrado.</div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {pickerResults.map(item => {
                      const selected = selectedItems.some(value => value.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleSelected(item)}
                          className={`group relative overflow-hidden rounded-xl border text-left transition ${
                            selected
                              ? 'border-yellow-500 bg-yellow-500/10'
                              : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                          }`}
                        >
                          <div className="relative aspect-[2/3] bg-white/5">
                            <img src={getOptimizedImageUrl(item.cover_image, 'thumbnail')} alt="" className="h-full w-full object-cover" />
                            {selected && (
                              <span className="absolute right-2 top-2 rounded-full bg-yellow-500 p-1 text-black">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="line-clamp-2 text-xs font-medium text-white">{item.title}</p>
                            {item.year && <p className="mt-1 text-[10px] text-gray-600">{item.year}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="min-h-0 overflow-y-auto border-t border-white/[0.08] bg-black/20 p-4 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Selecionados</h3>
                  <span className="text-xs text-yellow-400">{selectedItems.length}/30</span>
                </div>

                {selectedItems.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-gray-600">
                    Clique nas capas para adicionar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
                        <img src={getOptimizedImageUrl(item.cover_image, 'thumbnail')} alt="" className="h-12 w-8 rounded object-cover bg-white/5" />
                        <span className="min-w-0 flex-1 truncate text-xs text-gray-200">
                          <b className="mr-1 text-gray-600">{index + 1}.</b>{item.title}
                        </span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveSelected(index, -1)}
                            disabled={index === 0}
                            className="text-gray-600 hover:text-white disabled:opacity-20"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveSelected(index, 1)}
                            disabled={index === selectedItems.length - 1}
                            className="text-gray-600 hover:text-white disabled:opacity-20"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button onClick={() => toggleSelected(item)} className="rounded p-1 text-gray-600 hover:bg-red-500/10 hover:text-red-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] p-4">
              <button onClick={() => setPickerSection(null)} className="rounded-xl px-4 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => void savePickedContents()}
                disabled={pickerSaving || selectedItems.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-40 transition"
              >
                <Save className="h-4 w-4" />
                {pickerSaving ? 'Salvando…' : `Salvar ${selectedItems.length} conteúdo${selectedItems.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
