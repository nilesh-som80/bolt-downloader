import { useState, useEffect } from 'react';

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
                    return [updatedRecord, ...prev];
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
