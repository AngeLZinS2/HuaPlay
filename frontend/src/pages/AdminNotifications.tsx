import { useEffect, useState, useCallback } from 'react';
import { Bell, Calendar, CheckCircle2, Clock, Info, Play, Send, Trash2, XCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { AdminPage, ErrorState, LoadingState, buttonClass, inputClass } from '../components/admin/AdminPage';

interface Notice {
  id: number;
  title: string;
  message: string;
  image_url?: string | null;
  action_url?: string | null;
  audience: 'all' | 'web' | 'android';
  status: 'draft' | 'scheduled' | 'published' | 'sent' | 'cancelled';
  scheduled_at?: string | null;
  sent_at?: string | null;
  push_status?: string | null;
  push_error?: string | null;
  push_sent_count?: number;
  push_failed_count?: number;
  created_at?: string;
}

interface PushConfigStatus {
  configured: boolean;
  project_id: string;
  detail: string;
  source?: string | null;
  client_email?: string;
}

export default function AdminNotifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configStatus, setConfigStatus] = useState<PushConfigStatus | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [audience, setAudience] = useState<'all' | 'web' | 'android'>('all');
  const [date, setDate] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/notifications').then((r) => r.data.items ?? r.data ?? []),
      api.get('/admin/notifications/push-config-status').then((r) => r.data).catch(() => null),
    ])
      .then(([notices, config]) => {
        setItems(notices);
        if (config) setConfigStatus(config);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const save = async (mode: 'draft' | 'schedule' | 'now') => {
    if (!title.trim() || !message.trim()) return;
    setSaving(true);
    setError(false);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        image_url: image.trim() || null,
        action_url: actionUrl.trim() || null,
        audience,
      };

      if (mode === 'now') {
        payload.send_now = true;
        payload.status = 'published';
      } else if (mode === 'schedule') {
        if (!date) {
          alert('Por favor, selecione uma data e horário para agendamento.');
          setSaving(false);
          return;
        }
        payload.status = 'scheduled';
        payload.scheduled_at = new Date(date).toISOString(); // Stored in UTC
      } else {
        payload.status = 'draft';
      }

      await api.post('/admin/notifications', payload);
      setTitle('');
      setMessage('');
      setImage('');
      setActionUrl('');
      setDate('');
      loadData();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const dispatchNow = async (id: number) => {
    try {
      await api.post(`/admin/notifications/${id}/dispatch-now`);
      loadData();
    } catch {
      setError(true);
    }
  };

  const cancelNotice = async (id: number) => {
    try {
      await api.post(`/admin/notifications/${id}/cancel`);
      loadData();
    } catch {
      setError(true);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Deseja excluir esta notificação?')) return;
    try {
      await api.delete(`/admin/notifications/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      setError(true);
    }
  };

  const renderInAppBadge = (item: Notice) => {
    if (item.status === 'published' || item.status === 'sent') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Publicada
        </span>
      );
    }
    if (item.status === 'scheduled') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400 border border-sky-500/20">
          <Clock className="h-3 w-3" />
          Agendada
        </span>
      );
    }
    if (item.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/20">
          <XCircle className="h-3 w-3" />
          Cancelada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-300 border border-white/10">
        Rascunho
      </span>
    );
  };

  const renderPushBadge = (item: Notice) => {
    const status = item.push_status || 'not_requested';
    if (status === 'sent') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
          Push: Enviado ({item.push_sent_count ?? 0})
        </span>
      );
    }
    if (status === 'pending_credentials') {
      return (
        <span
          title={item.push_error || 'Aguardando credenciais no servidor'}
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20"
        >
          Push: Pendente de credencial
        </span>
      );
    }
    if (status === 'skipped_no_tokens') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-gray-500/20">
          Push: Sem tokens
        </span>
      );
    }
    if (status === 'processing' || status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20">
          Push: Na fila
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span
          title={item.push_error || 'Erro no envio do push'}
          className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/20"
        >
          Push: Falhou
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-500 border border-white/5">
        Push: Não solicitado
      </span>
    );
  };

  return (
    <AdminPage
      eyebrow="Comunicação"
      title="Notificações & Push"
      description="Gerencie avisos in-app e notificações push em segundo plano para o site, PWA e aplicativo Android."
    >
      {error && (
        <div className="mb-4">
          <ErrorState />
        </div>
      )}

      {/* FCM Push Configuration Status Card */}
      {configStatus && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
            configStatus.configured
              ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300'
              : 'border-amber-500/20 bg-amber-950/20 text-amber-300'
          }`}
        >
          {configStatus.configured ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-white">
              {configStatus.configured
                ? `FCM HTTP v1 Conectado (${configStatus.project_id})`
                : 'FCM Push em Segundo Plano: Aguardando Credencial'}
            </p>
            <p className="mt-0.5 text-gray-400">
              {configStatus.detail}
              {!configStatus.configured &&
                ' — Os avisos in-app continuarão funcionando imediatamente para todos os usuários.'}
            </p>
          </div>
        </div>
      )}

      {/* Composer Grid */}
      <div className="mb-6 grid gap-4 rounded-2xl border border-white/[.07] bg-[#0d0d0d] p-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <input
            className={inputClass}
            placeholder="Título da notificação (ex: Novo Episódio Disponível)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={`${inputClass} min-h-24 resize-none`}
            placeholder="Mensagem para o público (ex: Assista ao episódio 5 já legendado!)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Rota de ação (ex: /series/12)"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="URL da imagem (opcional)"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Público-alvo</label>
              <select
                className={`${inputClass} bg-[#141414] text-white`}
                value={audience}
                onChange={(e) => setAudience(e.target.value as 'all' | 'web' | 'android')}
              >
                <option value="all">Todos (Web + Android)</option>
                <option value="web">Apenas Web / PWA</option>
                <option value="android">Apenas Aplicativo Android</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Agendar para (UTC)</label>
              <input
                aria-label="Agendar envio"
                type="datetime-local"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              disabled={saving}
              type="button"
              className={buttonClass}
              onClick={() => void save('draft')}
            >
              <Bell className="h-4 w-4" />
              Salvar rascunho
            </button>
            <button
              disabled={saving}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 px-4 py-2 text-sm text-sky-400 hover:bg-sky-500/10 transition-colors"
              onClick={() => void save('schedule')}
            >
              <Calendar className="h-4 w-4" />
              Agendar
            </button>
            <button
              disabled={saving}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
              onClick={() => void save('now')}
            >
              <Send className="h-4 w-4" />
              Enviar agora
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Prévia visual no aplicativo
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-xl">
            {image ? (
              <div
                className="h-28 bg-cover bg-center border-b border-white/10"
                style={{ backgroundImage: `linear-gradient(transparent,#141414),url(${image})` }}
              />
            ) : (
              <div className="h-14 bg-gradient-to-r from-primary/20 via-neutral-900 to-black p-4 flex items-center">
                <span className="text-xs font-bold text-primary tracking-wider">HUAPLAY AVISOS</span>
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>HuaPlay • Agora</span>
                <span className="uppercase text-primary/80 font-medium">{audience}</span>
              </div>
              <p className="mt-1 font-semibold text-sm text-white">{title || 'Título da notificação'}</p>
              <p className="mt-1 text-xs text-gray-400 line-clamp-3">
                {message || 'Sua mensagem aparecerá assim para os espectadores.'}
              </p>
              {actionUrl && (
                <p className="mt-2 text-[11px] text-primary underline truncate">{actionUrl}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Table / List */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#0d0d0d]">
          <div className="border-b border-white/[.08] px-5 py-3 text-xs font-semibold uppercase text-gray-400 flex items-center justify-between">
            <span>Histórico de Notificações</span>
            <span className="text-[11px] text-gray-500 normal-case">{items.length} itens registrados</span>
          </div>

          <div className="divide-y divide-white/[.06]">
            {items.map((x) => (
              <div key={x.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-1 p-2 rounded-xl bg-white/[0.04] text-primary shrink-0">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm text-white truncate">{x.title}</p>
                      {renderInAppBadge(x)}
                      {renderPushBadge(x)}
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-gray-400">
                        {x.audience}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">{x.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      {x.action_url && <span>Rota: <code className="text-gray-300">{x.action_url}</code></span>}
                      {x.scheduled_at && (
                        <span>Agendado: {new Date(x.scheduled_at).toLocaleString('pt-BR')}</span>
                      )}
                      {x.sent_at && (
                        <span>Publicado: {new Date(x.sent_at).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {(x.status === 'draft' || x.status === 'scheduled') && (
                    <button
                      type="button"
                      title="Enviar agora"
                      onClick={() => void dispatchNow(x.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Enviar
                    </button>
                  )}
                  {x.status === 'scheduled' && (
                    <button
                      type="button"
                      title="Cancelar agendamento"
                      onClick={() => void cancelNotice(x.id)}
                      className="rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    title="Excluir notificação"
                    onClick={() => void remove(x.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!items.length && (
            <p className="p-8 text-center text-sm text-gray-500">Nenhuma notificação criada até o momento.</p>
          )}
        </div>
      )}
    </AdminPage>
  );
}
