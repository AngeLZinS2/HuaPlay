import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, ExternalLink, Loader2, Volume2, VolumeX, ShieldAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { sanitizeAppRoute } from '../utils/safeRoute';

function formatNoticeTime(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Agora';
  if (diffMinutes < 60) return `Há ${diffMinutes}m`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function NotificationBell({ className = '' }: { className?: string }) {
  const {
    notifications,
    unreadCount,
    readIds,
    isLoading,
    isOptingIn,
    isSubscribed,
    isVapidConfigured,
    pushStatusMessage,
    markAsRead,
    markAllAsRead,
    enablePush,
    disablePush,
  } = useNotifications();

  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const closePanel = useCallback(() => setIsOpen(false), []);

  // Lock mobile body scroll, restore on close, return focus to bell button on close
  useEffect(() => {
    if (!isOpen) return;

    const previousFocusedElement = (document.activeElement as HTMLElement) || bellButtonRef.current;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closePanel();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (isMobile) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePanel();
      }
    }

    let originalOverflow = '';
    let originalTouchAction = '';

    if (isMobile) {
      originalOverflow = document.body.style.overflow;
      originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      sheetRef.current?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);

      if (isMobile) {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      }

      // Restaura foco para o botão do sino ao fechar
      if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
        previousFocusedElement.focus();
      } else {
        bellButtonRef.current?.focus();
      }
    };
  }, [isOpen, closePanel, isMobile]);

  const handleNoticeClick = (notice: (typeof notifications)[0]) => {
    markAsRead(notice.id);
    const safeRoute = sanitizeAppRoute(notice.action_url);
    if (safeRoute) {
      closePanel();
      navigate(safeRoute);
    }
  };

  const renderPanelContent = (isMobileView: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-neutral-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white">Notificações</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {unreadCount} nova{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors font-medium"
            >
              <Check className="h-3.5 w-3.5" />
              Marcar lidas
            </button>
          )}
          {isMobileView && (
            <button
              type="button"
              onClick={closePanel}
              className="rounded-full border border-white/10 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 ml-1"
              aria-label="Fechar notificações"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Push Opt-in / Status Strip */}
      <div className="border-b border-white/[0.06] bg-black/40 px-4 py-2.5 shrink-0">
        {!isAuthenticated ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Faça login para receber avisos push no celular.</span>
          </div>
        ) : isSubscribed ? (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Push ativado no dispositivo
            </span>
            <button
              type="button"
              onClick={() => void disablePush()}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400 transition-colors"
            >
              <VolumeX className="h-3 w-3" />
              Desativar
            </button>
          </div>
        ) : !isVapidConfigured ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="text-gray-400">Notificações in-app ativas (Web push não configurado).</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-200">Receba avisos de novos episódios</p>
              <p className="text-[10px] text-gray-400">Ative o push em segundo plano</p>
            </div>
            <button
              type="button"
              disabled={isOptingIn}
              onClick={() => void enablePush()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {isOptingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
              Ativar
            </button>
          </div>
        )}
        {pushStatusMessage && (
          <p className="mt-1 text-[11px] text-yellow-400/90 leading-tight">{pushStatusMessage}</p>
        )}
      </div>

      {/* Notice List */}
      <div className="overflow-y-auto divide-y divide-white/[0.05] flex-1">
        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center px-4">
            <Bell className="mx-auto h-8 w-8 text-gray-600 mb-2 stroke-[1.5]" />
            <p className="text-xs text-gray-300 font-semibold">Nenhuma notificação no momento</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Avisos e novidades aparecerão aqui.</p>
          </div>
        ) : (
          notifications.map((item) => {
            const isRead = readIds.has(item.id);
            const safeRoute = sanitizeAppRoute(item.action_url);

            return (
              <div
                key={item.id}
                onClick={() => handleNoticeClick(item)}
                className={`group relative flex gap-3 p-3.5 transition-colors cursor-pointer ${
                  isRead ? 'hover:bg-white/[0.03] opacity-75' : 'bg-primary/[0.04] hover:bg-white/[0.05]'
                }`}
              >
                {!isRead && (
                  <span className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(229,169,59,0.8)]" />
                )}

                {item.image_url && (
                  <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-black">
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4
                      className={`truncate text-xs font-semibold ${
                        isRead ? 'text-gray-300' : 'text-white'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {formatNoticeTime(item.sent_at || item.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-gray-300 leading-snug">
                    {item.message}
                  </p>
                  {safeRoute && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-primary/90 group-hover:text-primary font-medium">
                      <span>Ver detalhes</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notificações ${unreadCount > 0 ? `(${unreadCount} novas)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative flex items-center justify-center p-2 rounded-full text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 active:scale-95"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop Dropdown */}
      <AnimatePresence>
        {isOpen && !isMobile && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Painel de Notificações"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#121212] p-0 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[min(80vh,560px)]"
          >
            {renderPanelContent(false)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet rendered via Portal to avoid transformed ancestor clipping */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && isMobile && (
            <div className="fixed inset-0 z-[100] sm:hidden" role="presentation">
              <button
                type="button"
                aria-label="Fechar painel"
                onClick={closePanel}
                className="absolute inset-0 bg-black/65 transition-opacity"
              />
              <motion.div
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-label="Painel de Notificações"
                tabIndex={-1}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                className="fixed inset-x-0 bottom-0 z-[101] max-h-[82dvh] flex flex-col rounded-t-[1.75rem] border-t border-amber-500/25 bg-[#0e0e0e] shadow-[0_-16px_50px_rgba(0,0,0,0.95)] pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-hidden"
              >
                <div className="mx-auto mt-3 mb-1.5 h-1.5 w-12 rounded-full bg-white/20 shrink-0" />
                {renderPanelContent(true)}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
