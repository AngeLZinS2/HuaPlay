import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Copy,
  Download,
  Film,
  Heart,
  MonitorDown,
  PlusSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import {
  detectPlatform,
  FALLBACK_APK_INFO,
  fetchLatestApkRelease,
  getDeferredInstallPrompt,
  getRecommendedInstallTab,
  isPwaInstalledInSession,
  isStandalonePwa,
  subscribePwaInstall,
  triggerPwaInstallPrompt,
  type ApkReleaseInfo,
  type InstallTab,
  type PlatformKind,
} from '../utils/pwaInstall';

interface IntroOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 0, label: 'O que é', shortLabel: 'HuaPlay' },
  { id: 1, label: 'Como funciona', shortLabel: 'Como usar' },
  { id: 2, label: 'Instalar App', shortLabel: 'APK & PWA' },
] as const;

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 44 : -44,
    opacity: 0,
    scale: 0.985,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.34,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -44 : 44,
    opacity: 0,
    scale: 0.985,
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 1, 1],
    },
  }),
};

function AndroidLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.523 15.341a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm-11.046 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm11.405-6.02 1.997-3.46a.416.416 0 0 0-.152-.567.416.416 0 0 0-.568.152l-2.022 3.504C15.63 8.266 13.86 7.88 12 7.88s-3.63.386-5.137 1.07L4.841 5.446a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.567l1.997 3.46C2.688 11.186.343 14.658 0 18.761h24c-.344-4.103-2.688-7.575-6.118-9.44z" />
    </svg>
  );
}

function AppleLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function DesktopLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2.2" />
      <path d="M8.5 20.5h7" />
      <path d="M12 16.5v4" />
      <path d="M12 7v5.5" />
      <path d="m9.5 10 2.5 2.5 2.5-2.5" />
    </svg>
  );
}

function IosShareIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function FlowingArrows({ direction = 'right', className = '' }: { direction?: 'right' | 'down'; className?: string }) {
  const isDown = direction === 'down';
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center ${isDown ? 'flex-col -space-y-2 py-1' : '-space-x-2 px-1'} ${className}`}
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{
            opacity: [0.22, 1, 0.22],
            x: isDown ? 0 : [0, 3, 0],
            y: isDown ? [0, 3, 0] : 0,
          }}
          transition={{
            duration: 1.35,
            repeat: Infinity,
            delay: index * 0.2,
            ease: 'easeInOut',
          }}
          className="text-primary"
        >
          <ChevronRight className={`w-4 h-4 ${isDown ? 'rotate-90' : ''}`} />
        </motion.span>
      ))}
    </div>
  );
}

function getPlatformBadgeLabel(platform: PlatformKind, standalone: boolean): string {
  if (platform === 'android-apk') return 'App Oficial Android';
  if (standalone) return 'Modo App PWA';
  if (platform === 'ios') return 'Navegador iOS';
  if (platform === 'android-web') return 'Navegador Android';
  return 'Site Oficial Desktop';
}

function IntroModalDialog({ onClose }: { onClose: () => void }) {
  const platform = useMemo<PlatformKind>(() => detectPlatform(), []);
  const [standalone, setStandalone] = useState<boolean>(() => isStandalonePwa() || isPwaInstalledInSession());
  const [canPromptPwa, setCanPromptPwa] = useState<boolean>(() => Boolean(getDeferredInstallPrompt()));
  const [pwaInstallFeedback, setPwaInstallFeedback] = useState<'idle' | 'installing' | 'installed'>('idle');

  const [step, setStep] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [selectedTab, setSelectedTab] = useState<InstallTab>(() => getRecommendedInstallTab(platform));
  const [apkInfo, setApkInfo] = useState<ApkReleaseInfo>(FALLBACK_APK_INFO);
  const [copiedApk, setCopiedApk] = useState<boolean>(false);

  useEffect(() => {
    const syncPwaState = () => {
      setCanPromptPwa(Boolean(getDeferredInstallPrompt()));
      if (isStandalonePwa() || isPwaInstalledInSession()) {
        setStandalone(true);
        setPwaInstallFeedback('installed');
      }
    };
    return subscribePwaInstall(syncPwaState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLatestApkRelease(controller.signal)
      .then((release) => {
        if (!controller.signal.aborted) {
          setApkInfo(release);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight' && step < STEPS.length - 1) {
        setDirection(1);
        setStep((prev) => Math.min(STEPS.length - 1, prev + 1));
      } else if (event.key === 'ArrowLeft' && step > 0) {
        setDirection(-1);
        setStep((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, step]);

  const goToStep = (nextStep: number) => {
    if (nextStep === step || nextStep < 0 || nextStep >= STEPS.length) return;
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleInstallPwa = async () => {
    setPwaInstallFeedback('installing');
    const result = await triggerPwaInstallPrompt();
    if (result === 'accepted') {
      setPwaInstallFeedback('installed');
      setStandalone(true);
    } else {
      setPwaInstallFeedback('idle');
    }
  };

  const handleCopyApkLink = async () => {
    try {
      await navigator.clipboard.writeText(apkInfo.apkUrl);
      setCopiedApk(true);
      window.setTimeout(() => setCopiedApk(false), 2400);
    } catch {
      // Fallback silencioso caso clipboard não esteja disponível
    }
  };

  const recommendedTab = getRecommendedInstallTab(platform);
  const envBadge = getPlatformBadgeLabel(platform, standalone);

  return (
    <motion.div
      key="huaplay-intro-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="huaplay-intro-title"
      onClick={onClose}
    >
          <motion.div
            key="huaplay-intro-card"
            initial={{ opacity: 0, scale: 0.93, y: 26 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 290, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-3xl max-h-[92dvh] flex-col overflow-hidden rounded-3xl border border-primary/25 bg-[#09090c] text-white shadow-[0_25px_90px_rgba(0,0,0,0.9),0_0_60px_rgba(212,175,55,0.12)]"
          >
            {/* Ambient animated background glows */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                animate={{ scale: [1, 1.16, 1], opacity: [0.22, 0.34, 0.22] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
              />
              <motion.div
                animate={{ scale: [1.1, 0.96, 1.1], opacity: [0.16, 0.28, 0.16] }}
                transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-secondary/30 blur-3xl"
              />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            </div>

            {/* Top Header Bar */}
            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-1 rounded-full bg-gradient-to-tr from-primary/70 via-transparent to-secondary/70 opacity-75 blur-[1px]"
                  />
                  <img
                    src="/logo-wei.webp"
                    alt="HuaPlay"
                    width={40}
                    height={40}
                    className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border border-primary/50 bg-black"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base sm:text-lg font-bold tracking-wider">
                      <span className="text-primary">Hua</span>
                      <span className="text-white ml-0.5">Play</span>
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Sparkles className="h-3 w-3" />
                      {envBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">
                    Guia rápido de primeiro acesso
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Pular
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar introdução"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-300 transition hover:border-primary/50 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Interactive Stepper Bar with Motion Arrows */}
            <div className="relative z-10 border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5 sm:px-6">
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                {STEPS.map((item, idx) => {
                  const isActive = step === item.id;
                  const isCompleted = step > item.id;
                  return (
                    <div key={item.id} className="flex items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => goToStep(item.id)}
                        className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isActive
                            ? 'text-black'
                            : isCompleted
                              ? 'text-primary hover:bg-white/5'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="intro-step-pill"
                            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                            className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E6C766] via-primary to-[#B88F1F] shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                          />
                        )}
                        <span className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold bg-black/20">
                          {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                        </span>
                        <span className="relative z-10 hidden sm:inline">{item.label}</span>
                        <span className="relative z-10 sm:hidden">{item.shortLabel}</span>
                      </button>

                      {idx < STEPS.length - 1 && (
                        <motion.span
                          aria-hidden="true"
                          animate={{ x: [0, 3, 0], opacity: step > idx ? 0.9 : 0.35 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="text-primary"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Slide Body */}
            <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
              <AnimatePresence mode="wait" custom={direction}>
                {/* ─── STEP 1: O QUE É O HUAPLAY ─────────────────────────────────── */}
                {step === 0 && (
                  <motion.div
                    key="step-welcome"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-5"
                  >
                    <div className="text-center max-w-xl mx-auto">
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-3"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Bem-vindo ao universo asiático</span>
                      </motion.div>

                      <h2
                        id="huaplay-intro-title"
                        className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white leading-tight"
                      >
                        O que é o <span className="text-primary">HuaPlay</span>?
                      </h2>

                      <p className="mt-2.5 text-sm sm:text-[15px] leading-relaxed text-gray-300">
                        Sua casa de <strong className="text-white">dramas asiáticos, doramas, filmes, animes e donghuas</strong> — tudo organizado em uma experiência de cinema, gratuita e sincronizada entre site e aplicativo.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          icon: Film,
                          title: 'Catálogo Curado',
                          desc: 'C-Dramas, K-Dramas, filmes e donghuas filtrados por categorias, atores e tags.',
                          accent: 'from-primary/20 to-primary/5 border-primary/25 text-primary',
                        },
                        {
                          icon: BookmarkCheck,
                          title: 'Perfis & Minha Lista',
                          desc: 'Salve favoritos, curta séries e retome cada episódio exatamente de onde parou.',
                          accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/25 text-rose-400',
                        },
                        {
                          icon: Bell,
                          title: 'Cronograma & Alertas',
                          desc: 'Acompanhe lançamentos semanais e receba avisos de novos episódios.',
                          accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/25 text-sky-400',
                        },
                      ].map((card, i) => {
                        const Icon = card.icon;
                        return (
                          <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 + i * 0.08, duration: 0.35 }}
                            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-primary/35 hover:bg-white/[0.05]"
                          >
                            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-gradient-to-br ${card.accent}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-gray-400">{card.desc}</p>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Quick shortcut banner to jump straight to APK & PWA */}
                    <motion.button
                      type="button"
                      onClick={() => goToStep(2)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.36 }}
                      className="group w-full flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-white/[0.03] to-emerald-500/10 px-4 py-3 text-left transition hover:border-primary/50 hover:from-primary/15"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-[#3DDC84]">
                            <AndroidLogo className="h-4 w-4" />
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white">
                            <AppleLogo className="h-4 w-4" />
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary">
                            <DesktopLogo className="h-4 w-4" />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-white">
                            Baixe o APK Android ou instale o PWA no iPhone e Desktop
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            Toque aqui para ir direto aos downloads e tutoriais
                          </p>
                        </div>
                      </div>
                      <motion.span
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </motion.span>
                    </motion.button>
                  </motion.div>
                )}

                {/* ─── STEP 2: COMO FUNCIONA (WITH ANIMATED ARROWS) ──────────────── */}
                {step === 1 && (
                  <motion.div
                    key="step-how"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-5"
                  >
                    <div className="text-center max-w-xl mx-auto">
                      <h2
                        id="huaplay-intro-title"
                        className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white"
                      >
                        Como <span className="text-primary">Funciona</span>
                      </h2>
                      <p className="mt-2 text-sm text-gray-300">
                        Em 3 passos simples você descobre, organiza e maratona suas produções favoritas em qualquer tela.
                      </p>
                    </div>

                    {/* Visual Flow with Animated Motion Arrows */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 sm:gap-3">
                      {/* Card 1 */}
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.035] p-4 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
                            <Compass className="h-5 w-5" />
                          </span>
                          <span className="font-display text-xl font-bold text-primary/35">01</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">Explore o Catálogo</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                          Navegue por <span className="text-gray-200">Projetos</span>, <span className="text-gray-200">Tags</span>, <span className="text-gray-200">Atores</span> ou use a lupa para achar qualquer título na hora.
                        </p>
                      </motion.div>

                      <FlowingArrows direction="right" className="hidden md:flex shrink-0" />
                      <FlowingArrows direction="down" className="flex md:hidden" />

                      {/* Card 2 */}
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18 }}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.035] p-4 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                            <Heart className="h-5 w-5" />
                          </span>
                          <span className="font-display text-xl font-bold text-rose-400/35">02</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">Crie seu Perfil</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                          Entre na conta para salvar na <span className="text-gray-200">Minha Lista</span>, curtir obras e receber recomendações sob medida.
                        </p>
                      </motion.div>

                      <FlowingArrows direction="right" className="hidden md:flex shrink-0" />
                      <FlowingArrows direction="down" className="flex md:hidden" />

                      {/* Card 3 */}
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.28 }}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.035] p-4 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            <Tv className="h-5 w-5" />
                          </span>
                          <span className="font-display text-xl font-bold text-emerald-400/35">03</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">Assista Onde Quiser</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                          Comece no celular e continue no PC. No mobile, <span className="text-gray-200">agite o aparelho</span> para reportar qualquer link quebrado.
                        </p>
                      </motion.div>
                    </div>

                    {/* Animated Journey Summary Ribbon */}
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.02] via-primary/[0.06] to-white/[0.02] px-4 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-medium text-gray-300">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 border border-white/10">
                          <Compass className="h-3.5 w-3.5 text-primary" /> Escolha o título
                        </span>
                        <motion.span
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="text-primary"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 border border-white/10">
                          <BookmarkCheck className="h-3.5 w-3.5 text-rose-400" /> Salve no perfil
                        </span>
                        <motion.span
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                          className="text-primary"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 border border-white/10">
                          <Smartphone className="h-3.5 w-3.5 text-emerald-400" /> Dê o play sem limites
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 3: INSTALAR APP (ANDROID APK • APPLE PWA • DESKTOP PWA) ─ */}
                {step === 2 && (
                  <motion.div
                    key="step-install"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-4"
                  >
                    <div className="text-center max-w-xl mx-auto">
                      <h2
                        id="huaplay-intro-title"
                        className="font-display text-xl sm:text-2xl font-bold tracking-wide text-white"
                      >
                        Leve o <span className="text-primary">HuaPlay</span> para qualquer tela
                      </h2>
                      <p className="mt-1.5 text-xs sm:text-sm text-gray-300">
                        Baixe o <strong className="text-[#3DDC84]">APK Oficial no Android</strong> ou instale como <strong className="text-primary">App PWA</strong> no <strong className="text-white">iPhone/iPad</strong> e no <strong className="text-white">Desktop</strong>.
                      </p>
                    </div>

                    {/* 3 Platform Selector Cards with Brand Icons */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {(
                        [
                          {
                            id: 'android' as const,
                            title: 'Android',
                            subtitle: 'APK Mobile',
                            icon: AndroidLogo,
                            activeBorder: 'border-[#3DDC84]/60 bg-[#3DDC84]/10 shadow-[0_0_24px_rgba(61,220,132,0.16)]',
                            iconColor: 'text-[#3DDC84]',
                          },
                          {
                            id: 'apple' as const,
                            title: 'Apple iOS',
                            subtitle: 'App PWA',
                            icon: AppleLogo,
                            activeBorder: 'border-white/50 bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.12)]',
                            iconColor: 'text-white',
                          },
                          {
                            id: 'desktop' as const,
                            title: 'Desktop',
                            subtitle: 'App PWA',
                            icon: DesktopLogo,
                            activeBorder: 'border-primary/60 bg-primary/10 shadow-[0_0_24px_rgba(212,175,55,0.18)]',
                            iconColor: 'text-primary',
                          },
                        ] as const
                      ).map((tab) => {
                        const Icon = tab.icon;
                        const active = selectedTab === tab.id;
                        const isCurrentDevice = recommendedTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSelectedTab(tab.id)}
                            className={`relative flex flex-col items-center justify-center rounded-2xl border p-3 sm:p-3.5 text-center transition-all ${
                              active
                                ? tab.activeBorder
                                : 'border-white/10 bg-white/[0.025] hover:border-white/25 hover:bg-white/[0.05]'
                            }`}
                          >
                            {isCurrentDevice && (
                              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/50 bg-[#12100a] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shadow">
                                Seu aparelho
                              </span>
                            )}
                            <motion.div
                              animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                              transition={{ duration: 1.8, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
                              className={`mb-1.5 ${tab.iconColor}`}
                            >
                              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                            </motion.div>
                            <span className="text-xs sm:text-sm font-bold text-white leading-tight">
                              {tab.title}
                            </span>
                            <span className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-gray-400">
                              {tab.subtitle}
                            </span>

                            {active && (
                              <motion.span
                                layoutId="platform-active-arrow"
                                animate={{ y: [0, 3, 0] }}
                                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                                className="mt-1 text-primary"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </motion.span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Platform Specific Detail Panel */}
                    <AnimatePresence mode="wait">
                      {/* ── ANDROID APK TAB ── */}
                      {selectedTab === 'android' && (
                        <motion.div
                          key="tab-android"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.22 }}
                          className="rounded-2xl border border-[#3DDC84]/30 bg-gradient-to-br from-[#3DDC84]/[0.08] via-[#0e1110] to-black/70 p-4 sm:p-5 space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#3DDC84]/40 bg-[#3DDC84]/15 text-[#3DDC84] shadow-[0_0_24px_rgba(61,220,132,0.2)]">
                                <AndroidLogo className="h-7 w-7" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-bold text-white">App Android Oficial (APK)</h3>
                                  <span className="rounded-full border border-[#3DDC84]/35 bg-[#3DDC84]/15 px-2 py-0.5 text-[10px] font-bold text-[#3DDC84]">
                                    v{apkInfo.versionName}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-gray-300">
                                  Experiência nativa mais rápida, notificações push e atualização automática integrada direto no aplicativo.
                                </p>
                              </div>
                            </div>
                          </div>

                          {platform === 'android-apk' ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-[#3DDC84]/35 bg-[#3DDC84]/10 p-3">
                              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#6ee7a8]">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span>Você já está usando o aplicativo Android oficial!</span>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyApkLink}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white hover:border-[#3DDC84]/50 transition"
                              >
                                {copiedApk ? <Check className="h-3.5 w-3.5 text-[#3DDC84]" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedApk ? 'Link copiado!' : 'Copiar link do APK'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                              <motion.a
                                href={apkInfo.apkUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ scale: 1.015 }}
                                whileTap={{ scale: 0.985 }}
                                className="group flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#2ec474] to-[#3DDC84] px-5 py-3 text-sm font-bold text-black shadow-[0_10px_30px_rgba(61,220,132,0.3)] transition hover:brightness-110"
                              >
                                <motion.span
                                  animate={{ y: [0, 3, 0] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  <Download className="h-4 w-4 stroke-[2.5]" />
                                </motion.span>
                                <span>Baixar APK para Android (v{apkInfo.versionName})</span>
                                <motion.span
                                  animate={{ x: [0, 4, 0] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                                </motion.span>
                              </motion.a>

                              <button
                                type="button"
                                onClick={handleCopyApkLink}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-gray-200 hover:border-white/30 hover:bg-white/10 transition"
                              >
                                {copiedApk ? <Check className="h-4 w-4 text-[#3DDC84]" /> : <Copy className="h-4 w-4" />}
                                <span>{copiedApk ? 'Copiado!' : 'Copiar link'}</span>
                              </button>
                            </div>
                          )}

                          {/* Mini 3-step install strip with animated arrows */}
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 sm:gap-2 pt-1">
                            <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3DDC84]">Passo 1</span>
                              <p className="text-xs font-medium text-gray-200 mt-0.5">Baixe o arquivo .APK</p>
                            </div>
                            <FlowingArrows direction="right" className="hidden sm:flex" />
                            <FlowingArrows direction="down" className="flex sm:hidden" />
                            <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3DDC84]">Passo 2</span>
                              <p className="text-xs font-medium text-gray-200 mt-0.5">Toque para abrir</p>
                            </div>
                            <FlowingArrows direction="right" className="hidden sm:flex" />
                            <FlowingArrows direction="down" className="flex sm:hidden" />
                            <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3DDC84]">Passo 3</span>
                              <p className="text-xs font-medium text-gray-200 mt-0.5">Permita & instale</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-gray-400">
                            <ShieldCheck className="h-3.5 w-3.5 text-[#3DDC84] shrink-0" />
                            <span>Download direto do servidor oficial HuaPlay com verificação SHA-256 nas atualizações.</span>
                          </div>
                        </motion.div>
                      )}

                      {/* ── APPLE iOS PWA TAB ── */}
                      {selectedTab === 'apple' && (
                        <motion.div
                          key="tab-apple"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.22 }}
                          className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/[0.08] via-[#0e0f13] to-black/75 p-4 sm:p-5 space-y-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]">
                              <AppleLogo className="h-6 w-6" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-bold text-white">Apple iPhone & iPad (PWA)</h3>
                                <span className="rounded-full border border-sky-400/35 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                                  Via Safari · Tela Cheia
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-gray-300">
                                No iOS, o HuaPlay roda como <strong className="text-white">Aplicativo Web (PWA)</strong>: ganha ícone na Tela de Início e abre em tela cheia como app nativo, sem precisar da App Store.
                              </p>
                            </div>
                          </div>

                          {platform === 'ios' && standalone ? (
                            <div className="flex items-center gap-2.5 rounded-xl border border-sky-400/35 bg-sky-500/10 p-3 text-xs font-semibold text-sky-200">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-400" />
                              <span>Perfeito! O HuaPlay já está instalado como App na sua Tela de Início.</span>
                            </div>
                          ) : (
                            <>
                              {/* Mini Interactive Safari Visual Guide with Animated Arrow */}
                              <div className="rounded-xl border border-white/10 bg-black/55 p-3.5">
                                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-3">
                                  <span>Barra do Safari (iPhone / iPad)</span>
                                  <span className="inline-flex items-center gap-1 text-primary font-semibold">
                                    Toque no ícone indicado
                                    <motion.span
                                      animate={{ y: [0, 3, 0] }}
                                      transition={{ duration: 1, repeat: Infinity }}
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </motion.span>
                                  </span>
                                </div>
                                <div className="flex items-center justify-around rounded-xl border border-white/10 bg-neutral-900/90 py-2.5 px-3">
                                  <span className="text-gray-600 text-xs">‹</span>
                                  <span className="text-gray-600 text-xs">›</span>
                                  <div className="relative flex flex-col items-center">
                                    <motion.div
                                      animate={{ scale: [1, 1.18, 1] }}
                                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/60 bg-sky-500/20 text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                                    >
                                      <IosShareIcon className="h-5 w-5" />
                                    </motion.div>
                                  </div>
                                  <span className="text-gray-600 text-xs">☆</span>
                                  <span className="text-gray-600 text-xs">❐</span>
                                </div>
                              </div>

                              {/* 3-step Apple PWA strip with animated arrows */}
                              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
                                <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">1. Safari</span>
                                  <p className="text-xs font-medium text-gray-200 mt-0.5">Abra o site no Safari</p>
                                </div>
                                <FlowingArrows direction="right" className="hidden sm:flex" />
                                <FlowingArrows direction="down" className="flex sm:hidden" />
                                <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                                    <IosShareIcon className="h-3 w-3" /> 2. Compartilhar
                                  </span>
                                  <p className="text-xs font-medium text-gray-200 mt-0.5">Toque no botão acima</p>
                                </div>
                                <FlowingArrows direction="right" className="hidden sm:flex" />
                                <FlowingArrows direction="down" className="flex sm:hidden" />
                                <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                    <PlusSquare className="h-3 w-3" /> 3. Tela de Início
                                  </span>
                                  <p className="text-xs font-medium text-gray-200 mt-0.5">Adicionar & abrir App</p>
                                </div>
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}

                      {/* ── DESKTOP PWA TAB ── */}
                      {selectedTab === 'desktop' && (
                        <motion.div
                          key="tab-desktop"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.22 }}
                          className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.1] via-[#110f0a] to-black/75 p-4 sm:p-5 space-y-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary shadow-[0_0_24px_rgba(212,175,55,0.2)]">
                              <DesktopLogo className="h-6 w-6" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-bold text-white">PWA para Desktop (PC & Mac)</h3>
                                <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  Chrome · Edge · Brave
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-gray-300">
                                Fixe o HuaPlay direto na <strong className="text-white">barra de tarefas ou Dock</strong> como aplicativo independente — abre em janela limpa, sem abas do navegador!
                              </p>
                            </div>
                          </div>

                          {/* Real 1-click PWA install CTA if supported by current browser */}
                          {standalone && platform === 'desktop' ? (
                            <div className="flex items-center gap-2.5 rounded-xl border border-primary/35 bg-primary/10 p-3 text-xs font-semibold text-primary">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>Você já está rodando o HuaPlay no modo App Desktop (PWA)!</span>
                            </div>
                          ) : pwaInstallFeedback === 'installed' ? (
                            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>HuaPlay instalado com sucesso! Procure o ícone na sua área de trabalho.</span>
                            </div>
                          ) : canPromptPwa ? (
                            <motion.button
                              type="button"
                              onClick={handleInstallPwa}
                              disabled={pwaInstallFeedback === 'installing'}
                              whileHover={{ scale: 1.015 }}
                              whileTap={{ scale: 0.985 }}
                              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#E6C766] via-primary to-[#B88F1F] px-5 py-3 text-sm font-bold text-black shadow-[0_10px_30px_rgba(212,175,55,0.3)] transition hover:brightness-110 disabled:opacity-60"
                            >
                              <MonitorDown className="h-4 w-4 stroke-[2.4]" />
                              <span>
                                {pwaInstallFeedback === 'installing'
                                  ? 'Abrindo instalação...'
                                  : 'Instalar HuaPlay como App Agora'}
                              </span>
                              <motion.span
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              >
                                <ArrowRight className="h-4 w-4 stroke-[2.4]" />
                              </motion.span>
                            </motion.button>
                          ) : null}

                          {/* Animated Mini Browser Address Bar Visual with Pointing Arrow */}
                          <div className="rounded-xl border border-white/10 bg-black/55 p-3.5">
                            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2.5">
                              <span>Barra de endereço do navegador</span>
                              <span className="inline-flex items-center gap-1 text-primary font-semibold">
                                Clique no ícone de instalar
                                <motion.span
                                  animate={{ y: [0, 3, 0] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </motion.span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-neutral-900/90 px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex gap-1 shrink-0">
                                  <span className="h-2 w-2 rounded-full bg-red-500/60" />
                                  <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
                                  <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
                                </span>
                                <span className="truncate rounded-md bg-black/50 px-2.5 py-1 text-[11px] font-mono text-gray-300 border border-white/5">
                                  https://huaplay.playdb.info
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <motion.span
                                  animate={{ x: [0, 4, 0] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                  className="text-primary"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </motion.span>
                                <motion.span
                                  animate={{ scale: [1, 1.15, 1] }}
                                  transition={{ duration: 1.4, repeat: Infinity }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/60 bg-primary/20 text-primary shadow-[0_0_18px_rgba(212,175,55,0.4)]"
                                >
                                  <MonitorDown className="h-4 w-4" />
                                </motion.span>
                              </div>
                            </div>
                          </div>

                          {/* 3-step Desktop PWA strip */}
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
                            <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Passo 1</span>
                              <p className="text-xs font-medium text-gray-200 mt-0.5">Clique no ícone ⊕ / ⋮</p>
                            </div>
                            <FlowingArrows direction="right" className="hidden sm:flex" />
                            <FlowingArrows direction="down" className="flex sm:hidden" />
                            <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Passo 2</span>
                              <p className="text-xs font-medium text-gray-200 mt-0.5">Toque em "Instalar"</p>
                            </div>
                            <FlowingArrows direction="right" className="hidden sm:flex" />
                            <FlowingArrows direction="down" className="flex sm:hidden" />
                            <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Passo 3</span>
                              <p className="text-xs font-medium text-gray-200 mt-0.5">Abra direto do PC</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="text-center text-[11px] text-gray-400">
                      Você pode reabrir este guia e o link do APK a qualquer momento em{' '}
                      <span className="text-gray-200 font-medium">Guia & Baixar App</span> no rodapé.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Controls */}
            <div className="relative z-10 flex items-center justify-between gap-3 border-t border-white/10 bg-black/50 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => goToStep(step - 1)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center rounded-full px-3 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Agora não
                  </button>
                )}
              </div>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {STEPS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => goToStep(s.id)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === s.id ? 'w-7 bg-primary' : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>

              {step < STEPS.length - 1 ? (
                <motion.button
                  type="button"
                  onClick={() => goToStep(step + 1)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E6C766] via-primary to-[#B88F1F] px-5 py-2.5 text-xs sm:text-sm font-bold text-black shadow-[0_6px_24px_rgba(212,175,55,0.35)] transition hover:brightness-110"
                >
                  <span>{step === 0 ? 'Como funciona' : 'Instalar App'}</span>
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </motion.span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E6C766] via-primary to-[#B88F1F] px-5 py-2.5 text-xs sm:text-sm font-bold text-black shadow-[0_6px_24px_rgba(212,175,55,0.35)] transition hover:brightness-110"
                >
                  <Sparkles className="h-4 w-4 stroke-[2.4]" />
                  <span>Começar a explorar</span>
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
  );
}

export default function IntroOnboardingModal({ isOpen, onClose }: IntroOnboardingModalProps) {
  return (
    <AnimatePresence>
      {isOpen && <IntroModalDialog onClose={onClose} />}
    </AnimatePresence>
  );
}
