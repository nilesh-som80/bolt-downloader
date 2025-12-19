import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { DownloadTask, DownloadTaskConfig } from './DownloadTask';
import { downloadsDb, DownloadRecord } from './Database';
import { configManager } from './ConfigManager';

class DownloadManager {
    private activeDownloads: Map<string, DownloadTask> = new Map();
    private mainWindow: BrowserWindow | null = null;
    private throttleTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        this.init();
    }

    private init() {
        // Restore from DB? 
        // For now, simpler to just list them. Resuming interrupted downloads on startup 
        // would be a nice to have, but let's stick to core first.
        // We can load them as 'PAUSED' or 'ERROR' if they were interruption.
        downloadsDb.getAllDownloads();
        // Ideally we re-hydrate them into activeDownloads if they were running.
        // For now, let's assume valid state in DB.

        this.setupIPC();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    private setupIPC() {
        ipcMain.handle('add-download', async (_, url: string, filename?: string, savePath?: string) => {
            const task = await this.createDownload({ url, filename, savePath });
            // Start immediately? Or verify first?
            // Plan says "Add Download Window" -> "Start".
            // Let's assume this call means "Start it".
            this.startDownload(task.id);
            return task.id;
        });

        ipcMain.handle('pause-download', (_, id: string) => {
            this.pauseDownload(id);
        });

        ipcMain.handle('resume-download', (_, id: string) => {
            this.resumeDownload(id);
        });

        ipcMain.handle('get-downloads', () => {
            return downloadsDb.getAllDownloads();
        });

        ipcMain.handle('select-folder', async () => {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            if (result.canceled) return null;
            return result.filePaths[0];
        });

        ipcMain.handle('open-folder', (_, id: string) => {
            // Check active first
            let path = '';
            const task = this.activeDownloads.get(id);
            if (task) {
                path = task.savedPath;
            } else {
                // Check DB
                const record = downloadsDb.getAllDownloads().find(d => d.id === id);
                if (record) path = record.savedPath;
            }

            if (path) {
                // If path is a file, showItemInFolder works.
                // If we want to open just the folder, we can use shell.openPath(dirname).
                // "Open Folder" usually means highlight the file in the folder.
                shell.showItemInFolder(path);
            }
        });

        ipcMain.handle('get-chunk-details', (_, id: string) => {
            const task = this.activeDownloads.get(id);
            if (!task) return [];
            return task.getChunkInfo();
        });

        ipcMain.handle('fetch-filename', async (_, url: string) => {
            try {
                const axios = (await import('axios')).default;
                const response = await axios.head(url, {
                    maxRedirects: 10,
                    validateStatus: (status) => status >= 200 && status < 300,
                    timeout: 5000 // 5 second timeout
                });

                const contentDisposition = response.headers['content-disposition'];
                let filename = '';

                if (contentDisposition) {
                    // Try RFC 5987 format first (filename*=UTF-8''filename.ext)
                    const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
                    if (rfc5987Match) {
                        filename = decodeURIComponent(rfc5987Match[1].trim());
                    } else {
                        // Fall back to regular format
                        const regularMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
                        if (regularMatch) {
                            filename = regularMatch[1].trim();
                        }
                    }
                }

                if (!filename) {
                    const path = (await import('node:path')).default;
                    filename = path.basename(new URL(url).pathname) || '';
                }

                return { filename, size: parseInt(response.headers['content-length'] || '0') };
            } catch (error) {
                return { filename: '', size: 0 };
            }
        });

        ipcMain.handle('delete-download', (_, id: string) => {
            // Remove from active downloads if running
            const task = this.activeDownloads.get(id);
            if (task) {
                task.pause(); // Stop if running
                this.activeDownloads.delete(id);
            }
            // Remove from database
            downloadsDb.deleteDownload(id);
            // Broadcast update
            this.broadcastUpdate();
        });

        ipcMain.handle('clear-all-downloads', () => {
            // Stop all active downloads
            this.activeDownloads.forEach(task => task.pause());
            this.activeDownloads.clear();
            // Clear database
            downloadsDb.clearAll();
            // Broadcast update
            this.broadcastUpdate();
        });

        ipcMain.handle('move-download-to-end', (_, id: string) => {
            downloadsDb.moveToEnd(id);
            this.broadcastAllDownloads();
        });

        // Config IPC
        ipcMain.handle('get-config', () => configManager.getAll());
        ipcMain.handle('set-config', (_, key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => {
            // Safe key check omitted for brevity, logic assumed safe
            configManager.set(key, value);
        });
    }

    public async createDownload(config: DownloadTaskConfig): Promise<DownloadTask> {
        const task = new DownloadTask(config);
        this.activeDownloads.set(task.id, task);

        // Persist initial state
        downloadsDb.addDownload({
            id: task.id,
            url: task.url,
            filename: task.originalFilename || 'pending...', // Updated after init
            savedPath: task.savedPath,
            totalSize: 0,
            downloadedSize: 0,
            status: 'PENDING',
            created_at: task.created_at
        });

        this.attachListeners(task);

        // Non-blocking Init (Head Request usually fast)
        // We await init to get the filename properly before returning if possible?
        // Init performs network request, better to return UUID and let UI show "Connecting..."
        task.init().then(() => {
            // Update DB with real filename/size
            downloadsDb.updateDownload(task.id, {
                filename: task.originalFilename,
                savedPath: task.savedPath, // Might have changed after resolve
                totalSize: task.totalSize,
                status: task.status
            });
            this.broadcastUpdate(task.id);
        });

        return task;
    }

    public startDownload(id: string) {
        const task = this.activeDownloads.get(id);
        if (!task) return;

        // If waiting for space, user might have freed it. Retry INIT first?
        // Task.start will fail if chunks not prep'd.
        // If task was just created, init is running. 
        // Let's rely on init completing and checking space.
        // If init failed (space), state is WAIT.
        // We should probably check if ready.

        // Simple logic: Trigger start. If init is still pending, we might need a queue or generic "ready" event.
        // Task.init emits 'ready'.

        if (task.status === 'PENDING') {
            task.once('ready', () => task.start());
        } else if (task.status === 'WAITING_FOR_SPACE') {
            // Retry init
            task.init().then(() => {
                if (task.status !== 'WAITING_FOR_SPACE') task.start();
            });
        } else {
            task.start();
        }
    }

    public pauseDownload(id: string) {
        const task = this.activeDownloads.get(id);
        if (task) task.pause();
    }

    public resumeDownload(id: string) {
        const task = this.activeDownloads.get(id);
        if (task) {
            task.resume();
            // Maybe DB reload if not in memory?
        } else {
            // Try to load from DB and reconstruct?
            // Out of scope for this step, assuming session persistence only for active objects.
        }
    }

    private attachListeners(task: DownloadTask) {
        task.on('progress', () => {
            // Throttle updates: 2x per second (500ms)
            if (!this.throttleTimers.has(task.id)) {
                this.broadcastUpdate(task.id);
                const timer = setTimeout(() => {
                    this.throttleTimers.delete(task.id);
                    // Send trailing update
                    this.broadcastUpdate(task.id);
                }, 500);
                this.throttleTimers.set(task.id, timer);
            }

            // Also update DB less frequently? 
            // For now update DB on every throttled UI update is fine for local sqlite.
        });

        task.on('complete', () => {
            this.broadcastUpdate(task.id);
            downloadsDb.updateDownload(task.id, {
                status: 'COMPLETED',
                downloadedSize: task.downloadedSize
            });
            this.activeDownloads.delete(task.id); // Remove from memory to save RAM? 
            // Or keep it for "Open File" actions? Keep for now.
        });

        task.on('error', (err) => {
            console.error(`Download ${task.id} error:`, err);
            this.broadcastUpdate(task.id);
            downloadsDb.updateDownload(task.id, { status: 'ERROR' });
        });

        task.on('ready', () => {
            this.broadcastUpdate(task.id);
        });
    }

    private broadcastUpdate(id?: string) {
        if (!id) {
            // When no ID, broadcast all downloads from database
            this.broadcastAllDownloads();
            return;
        }
        const task = this.activeDownloads.get(id);
        if (!task) return;

        const record: DownloadRecord = {
            id: task.id,
            url: task.url,
            filename: task.originalFilename,
            savedPath: task.savedPath,
            totalSize: task.totalSize,
            downloadedSize: task.downloadedSize,
            status: task.status,
            created_at: task.created_at,
            speed: task.speed
        };

        // Update DB
        downloadsDb.updateDownload(id, {
            downloadedSize: record.downloadedSize,
            status: record.status
        });

        // Send to UI
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('download-progress', record);
        }
    }

    private broadcastAllDownloads() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            const allDownloads = downloadsDb.getAllDownloads();
            // Send refresh event with all downloads
            this.mainWindow.webContents.send('downloads-refresh', allDownloads);
        }
    }
}

export const downloadManager = new DownloadManager();
