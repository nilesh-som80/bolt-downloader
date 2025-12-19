/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/no-explicit-any */

interface DownloadRecord {
    id: string;
    url: string;
    filename: string;
    savedPath: string;
    totalSize: number;
    downloadedSize: number;
    status: 'PENDING' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'ERROR' | 'WAITING_FOR_SPACE';
    created_at: string;
    speed?: number;
}

interface ChunkInfo {
    chunkIndex: number;
    start: number;
    end: number;
    downloaded: number;
    progress: number;
    done: boolean;
    size: number;
}

interface AppConfig {
    defaultDownloadPath: string;
    maxConcurrentDownloads: number;
    maxChunks: number;
    theme: 'light' | 'dark' | 'system';
}

interface IpcRendererAPI {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    off: (channel: string, listener: (...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;

    addDownload: (url: string, filename?: string, savePath?: string) => Promise<string>;
    getDownloads: () => Promise<DownloadRecord[]>;
    pauseDownload: (id: string) => Promise<void>;
    resumeDownload: (id: string) => Promise<void>;
    selectFolder: () => Promise<string | null>;
    openAddWindow: () => Promise<void>;
    openSettingsWindow: () => Promise<void>;
    getConfig: () => Promise<AppConfig>;
    setConfig: (key: keyof AppConfig, value: any) => Promise<void>;
    openFolder: (id: string) => Promise<void>;
    getChunkDetails: (id: string) => Promise<ChunkInfo[]>;
    openChunkDetails: (id: string) => Promise<void>;
    fetchFilename: (url: string) => Promise<{ filename: string; size: number }>;
    deleteDownload: (id: string) => Promise<void>;
    clearAllDownloads: () => Promise<void>;
}

declare global {
    interface Window {
        ipcRenderer: IpcRendererAPI
    }
}
