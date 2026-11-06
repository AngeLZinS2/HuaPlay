import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface DownloadUpdateOptions {
  url: string;
  versionCode: number;
  sha256: string;
}

export interface DownloadProgress {
  progress: number;
  percent: number;
  bytesRead: number;
  totalBytes: number;
}

export type DownloadProgressEvent = DownloadProgress;

export interface DownloadResult {
  status: 'download_complete';
  versionCode: number;
  sha256: string;
  fileReady: boolean;
  busy: boolean;
}

export interface InstallResult {
  status: 'installer_opened' | 'permission_required';
  message?: string;
}

export interface CancelResult {
  status: 'cancelled' | 'idle';
  cancelled: boolean;
}

export interface NativeUpdaterPlugin {
  downloadUpdate(options: DownloadUpdateOptions): Promise<DownloadResult>;
  installUpdate(): Promise<InstallResult>;
  cancelDownload(): Promise<CancelResult>;
  addListener(
    eventName: 'progress' | 'downloadProgress',
    listenerFunc: (progress: DownloadProgress) => void
  ): Promise<PluginListenerHandle>;
}

export const NativeUpdater = registerPlugin<NativeUpdaterPlugin>('NativeUpdater');
