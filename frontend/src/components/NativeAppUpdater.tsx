import { useEffect, useRef, useState, useCallback } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { NativeUpdater } from '../services/nativeUpdater';

interface UpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  releaseNotes?: string[];
}

type UpdateStep =
  | 'ready'
  | 'downloading'
  | 'verifying'
  | 'pending_permission'
  | 'opening_installer'
  | 'error';

const UPDATE_ENDPOINT = 'https://huaplay.playdb.info/mobile/version.json';
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutos por sessão
const TIMEOUT_MS = 8000; // 8 segundos de timeout
const MAX_INTEGER = 2147483647; // Integer.MAX_VALUE no Android

// Estado de sessão em memória
let sessionLastCheckTime = 0;
const sessionDismissedVersions = new Set<number>();

// Controle de concorrência e ciclo de vida da requisição na sessão
let activeRequestId = 0;
let activeAbortController: AbortController | null = null;
let activeTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isCheckingSession = false;
let activeRequestStartTime = 0;
let activeRequestPreviousCheckTime = 0;
let requestCancelledByLifecycle = false;

function isValidApkUrl(urlStr: unknown): urlStr is string {
  if (typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.origin !== 'https://huaplay.playdb.info') return false;
    if (parsed.username !== '' || parsed.password !== '') return false;
    if (parsed.port !== '' && parsed.port !== '443') return false;
    if (parsed.hash !== '') return false;
    if (!parsed.pathname.startsWith('/downloads/huaplay/') || !parsed.pathname.endsWith('.apk')) {
      return false;
    }
    const filename = parsed.pathname.slice('/downloads/huaplay/'.length);
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidSha256(hashStr: unknown): hashStr is string {
  if (typeof hashStr !== 'string') return false;
  return /^[a-fA-F0-9]{64}$/.test(hashStr.trim());
}

function parseAndValidateManifest(raw: unknown): UpdateManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const versionCode = data.versionCode;
  if (
    typeof versionCode !== 'number' ||
    !Number.isSafeInteger(versionCode) ||
    versionCode <= 0 ||
    versionCode > MAX_INTEGER
  ) {
    return null;
  }

  const versionName =
    typeof data.versionName === 'string' && data.versionName.trim().length > 0
      ? data.versionName.trim()
      : `${versionCode}`;

  const apkUrl = data.apkUrl;
  if (!isValidApkUrl(apkUrl)) {
    return null;
  }

  const sha256 = data.sha256;
  if (!isValidSha256(sha256)) {
    return null;
  }

  const releaseNotes = Array.isArray(data.releaseNotes)
    ? data.releaseNotes.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    versionCode,
    versionName,
    apkUrl,
    sha256: sha256.trim().toLowerCase(),
    releaseNotes,
  };
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function NativeAppUpdater() {
  const [update, setUpdate] = useState<UpdateManifest | null>(null);
  const [step, setStep] = useState<UpdateStep>('ready');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [bytesRead, setBytesRead] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const isOperationRunningRef = useRef<boolean>(false);
  const operationIdRef = useRef<number>(0);

  const checkForUpdate = useCallback(async () => {
    const now = Date.now();
    if (!isMountedRef.current || isCheckingSession) return;
    if (now - sessionLastCheckTime < THROTTLE_MS) return;

    // Se estiver no meio de um download ou instalação, não sobrepor com nova verificação
    if (isOperationRunningRef.current) return;

    const localPreviousCheckTime = sessionLastCheckTime;
    const localStartTime = now;
    activeRequestStartTime = now;
    activeRequestPreviousCheckTime = localPreviousCheckTime;
    sessionLastCheckTime = now;
    isCheckingSession = true;

    const requestId = ++activeRequestId;
    requestCancelledByLifecycle = false;

    const controller = new AbortController();
    activeAbortController = controller;

    let isTimeoutAbort = false;
    activeTimeoutId = setTimeout(() => {
      isTimeoutAbort = true;
      controller.abort();
    }, TIMEOUT_MS);

    const isCancelled = () => {
      return (
        !isMountedRef.current ||
        controller.signal.aborted ||
        activeRequestId !== requestId
      );
    };

    try {
      const appInfo = await App.getInfo();
      if (isCancelled()) {
        if (
          activeRequestId === requestId &&
          (requestCancelledByLifecycle || !isMountedRef.current)
        ) {
          if (sessionLastCheckTime === localStartTime) {
            sessionLastCheckTime = localPreviousCheckTime;
          }
        }
        return;
      }

      // Validação estrita de string numérica completa
      const rawBuild = appInfo.build;
      if (typeof rawBuild !== 'string' || !/^\d+$/.test(rawBuild.trim())) {
        return;
      }

      const currentVersionCode = Number(rawBuild.trim());
      if (
        !Number.isSafeInteger(currentVersionCode) ||
        currentVersionCode <= 0 ||
        currentVersionCode > MAX_INTEGER
      ) {
        return;
      }

      const response = await fetch(UPDATE_ENDPOINT, {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (isCancelled()) {
        if (
          activeRequestId === requestId &&
          (requestCancelledByLifecycle || !isMountedRef.current)
        ) {
          if (sessionLastCheckTime === localStartTime) {
            sessionLastCheckTime = localPreviousCheckTime;
          }
        }
        return;
      }

      if (!response.ok) {
        return;
      }

      const json: unknown = await response.json();
      if (isCancelled()) {
        if (
          activeRequestId === requestId &&
          (requestCancelledByLifecycle || !isMountedRef.current)
        ) {
          if (sessionLastCheckTime === localStartTime) {
            sessionLastCheckTime = localPreviousCheckTime;
          }
        }
        return;
      }

      const manifest = parseAndValidateManifest(json);
      if (!manifest) {
        return;
      }

      // Se já foi adiada nesta sessão, não reexibe
      if (sessionDismissedVersions.has(manifest.versionCode)) {
        return;
      }

      // Comparação estrita de inteiros
      if (
        manifest.versionCode > currentVersionCode &&
        isMountedRef.current &&
        !controller.signal.aborted &&
        activeRequestId === requestId
      ) {
        setErrorMessage(null);
        setStep('ready');
        setProgressPercent(0);
        setUpdate(manifest);
      }
    } catch {
      // Se a consulta foi cancelada mas ainda é a requisição ativa
      if (
        activeRequestId === requestId &&
        (requestCancelledByLifecycle || !isMountedRef.current || (controller.signal.aborted && !isTimeoutAbort))
      ) {
        if (sessionLastCheckTime === localStartTime) {
          sessionLastCheckTime = localPreviousCheckTime;
        }
      }
    } finally {
      if (activeRequestId === requestId) {
        isCheckingSession = false;
        if (activeTimeoutId) {
          clearTimeout(activeTimeoutId);
          activeTimeoutId = null;
        }
        activeAbortController = null;
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let cleanUpCalled = false;
    let listenerHandle: PluginListenerHandle | null = null;
    const opRef = operationIdRef;
    const runningRef = isOperationRunningRef;

    void checkForUpdate();

    App.addListener('appStateChange', (state) => {
      if (isMountedRef.current && state.isActive && !runningRef.current) {
        void checkForUpdate();
      }
    }).then((handle) => {
      if (cleanUpCalled || !isMountedRef.current) {
        void handle.remove();
      } else {
        listenerHandle = handle;
      }
    }).catch(() => {});

    return () => {
      cleanUpCalled = true;
      isMountedRef.current = false;

      // Invalida operações pendentes e cancela download nativo em caso de unmount real
      if (runningRef.current) {
        opRef.current++;
        runningRef.current = false;
        void NativeUpdater.cancelDownload().catch(() => {});
      }

      if (isCheckingSession) {
        requestCancelledByLifecycle = true;
        if (sessionLastCheckTime === activeRequestStartTime) {
          sessionLastCheckTime = activeRequestPreviousCheckTime;
        }
        if (activeAbortController) {
          activeAbortController.abort();
        }
        if (activeTimeoutId) {
          clearTimeout(activeTimeoutId);
          activeTimeoutId = null;
        }
        isCheckingSession = false;
      }

      if (listenerHandle) {
        void listenerHandle.remove();
        listenerHandle = null;
      }
    };
  }, [checkForUpdate]);

  const handleDismiss = () => {
    if (isOperationRunningRef.current) return;
    if (update) {
      sessionDismissedVersions.add(update.versionCode);
    }
    setErrorMessage(null);
    setUpdate(null);
    setStep('ready');
  };

  const handleCancelDownload = async () => {
    // Invalida a geração da operação atual imediatamente
    operationIdRef.current++;
    isOperationRunningRef.current = false;

    try {
      await NativeUpdater.cancelDownload();
    } catch {
      // Ignora erro de cancelamento
    } finally {
      if (isMountedRef.current) {
        setStep('ready');
        setProgressPercent(0);
        setErrorMessage('Download cancelado pelo usuário.');
      }
    }
  };

  const handleStartUpdate = async () => {
    // Guarda síncrona contra clique duplo ANTES de await e de render
    if (!update || isOperationRunningRef.current) return;
    isOperationRunningRef.current = true;
    const currentOpId = ++operationIdRef.current;

    setErrorMessage(null);
    setStep('downloading');
    setProgressPercent(0);
    setBytesRead(0);
    setTotalBytes(0);

    let progressListener: PluginListenerHandle | null = null;

    try {
      progressListener = await NativeUpdater.addListener('downloadProgress', (event) => {
        if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;
        const pct = Math.max(0, Math.min(100, Math.round(event.progress)));
        setProgressPercent(pct);
        setBytesRead(event.bytesRead);
        setTotalBytes(event.totalBytes);
        if (pct >= 99) {
          setStep('verifying');
        }
      });

      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;

      // 1. Download e verificação de integridade no plugin nativo
      await NativeUpdater.downloadUpdate({
        url: update.apkUrl,
        versionCode: update.versionCode,
        sha256: update.sha256,
      });

      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;

      // Remove listener de progresso antes de abrir o instalador
      if (progressListener) {
        try {
          await progressListener.remove();
        } catch {
          // Ignora erro ao remover listener
        }
        progressListener = null;
      }

      // Recheck de segurança após remoção assíncrona do listener
      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;

      // 2. Chamar instalador
      setStep('opening_installer');
      const installResult = await NativeUpdater.installUpdate();

      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;

      if (installResult.status === 'installer_opened') {
        // Instalador do sistema aberto com sucesso: fechar modal
        setUpdate(null);
        setStep('ready');
      } else if (installResult.status === 'permission_required') {
        setStep('pending_permission');
        setErrorMessage('Autorização para instalar aplicativos desconhecidos é necessária.');
      } else {
        setStep('error');
        setErrorMessage('Não foi possível iniciar o instalador.');
      }

    } catch (err: unknown) {
      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;
      setStep('error');
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('NativeUpdater') || rawMsg.includes('not implemented')) {
        setErrorMessage('Atualizador nativo não disponível neste dispositivo.');
      } else {
        setErrorMessage(rawMsg || 'Falha ao baixar ou instalar a atualização.');
      }
    } finally {
      if (progressListener) {
        try {
          await progressListener.remove();
        } catch {
          // Ignora erro ao remover listener
        }
      }
      if (operationIdRef.current === currentOpId) {
        isOperationRunningRef.current = false;
      }
    }
  };

  const handleRetryInstall = async () => {
    if (isOperationRunningRef.current) return;
    isOperationRunningRef.current = true;
    const currentOpId = ++operationIdRef.current;

    setErrorMessage(null);
    setStep('opening_installer');

    try {
      const installResult = await NativeUpdater.installUpdate();
      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;

      if (installResult.status === 'installer_opened') {
        setUpdate(null);
        setStep('ready');
      } else if (installResult.status === 'permission_required') {
        setStep('pending_permission');
        setErrorMessage('Permissão para instalar aplicativos desconhecidos continua necessária.');
      } else {
        setStep('error');
        setErrorMessage('Não foi possível abrir o instalador do sistema.');
      }
    } catch (err: unknown) {
      if (!isMountedRef.current || operationIdRef.current !== currentOpId) return;
      setStep('error');
      const rawMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(rawMsg || 'Erro ao tentar abrir o instalador.');
    } finally {
      if (operationIdRef.current === currentOpId) {
        isOperationRunningRef.current = false;
      }
    }
  };

  if (!update) {
    return null;
  }

  const isDownloading = step === 'downloading' || step === 'verifying';
  const isOpening = step === 'opening_installer';
  const isBusy = isDownloading || isOpening;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
      aria-describedby="update-modal-desc"
    >
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white">
        <h2 id="update-modal-title" className="text-xl font-bold mb-2">
          Nova versão disponível ({update.versionName})
        </h2>
        <p id="update-modal-desc" className="text-sm text-neutral-300 mb-4">
          Uma nova versão do HuaPlay está pronta para download e instalação.
        </p>

        {update.releaseNotes && update.releaseNotes.length > 0 && !isDownloading && (
          <div className="mb-5 max-h-36 overflow-y-auto rounded-lg bg-neutral-950/60 p-3 text-xs text-neutral-300 space-y-1 border border-neutral-800">
            <p className="font-semibold text-neutral-200 mb-1">Novidades:</p>
            {update.releaseNotes.map((note, index) => (
              <p key={index} className="flex items-start gap-1.5">
                <span className="text-primary">•</span>
                <span>{note}</span>
              </p>
            ))}
          </div>
        )}

        {isDownloading && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between text-xs text-neutral-300">
              <span>{step === 'verifying' ? 'Verificando integridade...' : 'Baixando atualização...'}</span>
              <span className="font-semibold">{progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do download da atualização"
              className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {totalBytes > 0 && (
              <p className="text-[11px] text-neutral-400 text-right">
                {formatBytes(bytesRead)} de {formatBytes(totalBytes)}
              </p>
            )}
          </div>
        )}

        {errorMessage && (
          <p className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {step === 'pending_permission' ? (
            <button
              type="button"
              onClick={handleRetryInstall}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90 text-white transition-colors"
            >
              Autorizar e instalar
            </button>
          ) : step === 'error' ? (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90 text-white transition-colors"
            >
              Tentar novamente
            </button>
          ) : isDownloading ? (
            <button
              type="button"
              onClick={handleCancelDownload}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            >
              Cancelar download
            </button>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleStartUpdate}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
            >
              {isOpening ? 'Abrindo instalador...' : 'Atualizar agora'}
            </button>
          )}

          {!isDownloading && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleDismiss}
              className="w-full py-2 px-4 rounded-xl text-sm font-medium text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Agora não
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
