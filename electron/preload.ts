import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (...args: any[]) => void) {
    return ipcRenderer.on(channel, (_event, ...args) => listener(_event, ...args))
  },
  off(channel: string, listener: (...args: any[]) => void) {
    return ipcRenderer.off(channel, listener as any)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  // Explicit APIs for type safety (optional but good practice)
  addDownload: (url: string, filename?: string, savePath?: string) => ipcRenderer.invoke('add-download', url, filename, savePath),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  pauseDownload: (id: string) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id: string) => ipcRenderer.invoke('resume-download', id),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openAddWindow: () => ipcRenderer.invoke('open-add-download'),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (key: string, value: unknown) => ipcRenderer.invoke('set-config', key, value),
  openFolder: (id: string) => ipcRenderer.invoke('open-folder', id),
  getChunkDetails: (id: string) => ipcRenderer.invoke('get-chunk-details', id),
  openChunkDetails: (id: string) => ipcRenderer.invoke('open-chunk-details', id),
  fetchFilename: (url: string) => ipcRenderer.invoke('fetch-filename', url),
  deleteDownload: (id: string) => ipcRenderer.invoke('delete-download', id),
  clearAllDownloads: () => ipcRenderer.invoke('clear-all-downloads'),
})
