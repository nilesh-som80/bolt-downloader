import { useState, useEffect } from 'react';
import { logEvent } from '../firebase';


export function useDownloads() {
    const [downloads, setDownloads] = useState<DownloadRecord[]>([]);

    useEffect(() => {
        const api = window.ipcRenderer as unknown as IpcRendererAPI;
        // Initial fetch
        api.getDownloads().then(setDownloads);

        const handleProgress = (_event: unknown, updatedRecord: DownloadRecord) => {
            setDownloads(prev => {
                const index = prev.findIndex(d => d.id === updatedRecord.id);
                if (index === -1) {
                    if (updatedRecord.status !== 'COMPLETED') { // Avoid double logging if it starts as completed? Unlikely but safe.
                        logEvent('download_started', {
                            file_name: updatedRecord.filename,
                            file_type: updatedRecord.filename.split('.').pop()
                        });
                    }
                    return [updatedRecord, ...prev];
                }

                // Track completion
                const oldRecord = prev[index];
                if (oldRecord.status !== 'COMPLETED' && updatedRecord.status === 'COMPLETED') {
                    logEvent('download_completed', {
                        file_name: updatedRecord.filename,
                        size: updatedRecord.totalSize,
                        duration: (new Date(updatedRecord.created_at).getTime() - Date.now()) * -1 // rough estimate or just log timestamp
                    });
                }

                const newArr = [...prev];
                newArr[index] = updatedRecord;
                return newArr;
            });
        };


        const handleRefresh = (_event: unknown, allDownloads: DownloadRecord[]) => {
            setDownloads(allDownloads);
        };

        window.ipcRenderer.on('download-progress', handleProgress);
        window.ipcRenderer.on('downloads-refresh', handleRefresh);

        return () => {
            window.ipcRenderer.off('download-progress', handleProgress);
            window.ipcRenderer.off('downloads-refresh', handleRefresh);
        };
    }, []);

    const pause = (id: string) => (window.ipcRenderer as unknown as IpcRendererAPI).pauseDownload(id);
    const resume = (id: string) => (window.ipcRenderer as unknown as IpcRendererAPI).resumeDownload(id);
    const openAddWindow = () => (window.ipcRenderer as unknown as IpcRendererAPI).openAddWindow();
    const openSettings = () => (window.ipcRenderer as unknown as IpcRendererAPI).openSettingsWindow();
    const openFolder = (id: string) => (window.ipcRenderer as unknown as IpcRendererAPI).openFolder(id);
    const openChunkDetails = (id: string) => (window.ipcRenderer as unknown as IpcRendererAPI).openChunkDetails(id);
    const deleteDownload = (id: string) => (window.ipcRenderer as unknown as IpcRendererAPI).deleteDownload(id);
    const clearAll = () => (window.ipcRenderer as unknown as IpcRendererAPI).clearAllDownloads();

    return { downloads, pause, resume, openAddWindow, openSettings, openFolder, openChunkDetails, deleteDownload, clearAll };
}
