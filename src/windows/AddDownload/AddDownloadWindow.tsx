import { useState, useEffect } from 'react';

const AddDownloadWindow = () => {
    const [url, setUrl] = useState('');
    const [customFilename, setCustomFilename] = useState('');
    const [suggestedFilename, setSuggestedFilename] = useState('');
    const [savePath, setSavePath] = useState('');
    const [loading, setLoading] = useState(false);
    const [isFetchingFilename, setIsFetchingFilename] = useState(false);

    const handleSelectFolder = async () => {
        const path = await (window.ipcRenderer as unknown as IpcRendererAPI).selectFolder();
        if (path) setSavePath(path);
    };

    // Listen for prefilled URL from main process (runs once on mount)
    useEffect(() => {
        const handlePrefilledUrl = (_event: any, prefilledUrl: string) => {
            setUrl(prefilledUrl);
        };

        window.ipcRenderer.on('prefill-url', handlePrefilledUrl);

        return () => {
            window.ipcRenderer.off('prefill-url', handlePrefilledUrl);
        };
    }, []); // Empty dependency array - runs once on mount

    // Auto-fetch filename when URL changes
    useEffect(() => {
        const fetchFilename = async () => {
            if (!url || url.length < 10) {
                setSuggestedFilename('');
                return;
            }

            // Validate URL format
            try {
                new URL(url);
            } catch {
                return; // Invalid URL, skip fetch
            }

            setIsFetchingFilename(true);
            const api = (window.ipcRenderer as unknown as IpcRendererAPI);

            try {
                const result = await api.fetchFilename(url);
                if (result.filename) {
                    setSuggestedFilename(result.filename);
                    // Only set custom filename if user hasn't typed anything yet
                    if (!customFilename) {
                        setCustomFilename(result.filename);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch filename:', error);
            } finally {
                setIsFetchingFilename(false);
            }
        };

        // Debounce the fetch to avoid too many requests
        const timer = setTimeout(fetchFilename, 500);
        return () => clearTimeout(timer);
    }, [url, customFilename]);

    const handleStart = async () => {
        if (!url) return;
        setLoading(true);
        try {
            await (window.ipcRenderer as unknown as IpcRendererAPI).addDownload(url, customFilename || undefined, savePath || undefined);
            window.close();
        } catch (e) {
            console.error(e);
            alert('Failed to start download');
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-bg text-text-primary p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-6">Add New Download</h2>

            <div className="mb-4">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Address (URL)</label>
                <input
                    type="text"
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com/file.zip"
                    autoFocus
                />
            </div>

            <div className="mb-4">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Save To</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        value={savePath}
                        placeholder="Default Folder"
                        readOnly
                    />
                    <button onClick={handleSelectFolder} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-border rounded-md text-sm transition-colors">Browse...</button>
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">
                    Filename (Optional)
                    {isFetchingFilename && <span className="text-blue-400 text-xs ml-2">(Fetching...)</span>}
                    {suggestedFilename && !isFetchingFilename && <span className="text-green-400 text-xs ml-2">✓ Auto-detected</span>}
                </label>
                <input
                    type="text"
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    value={customFilename}
                    onChange={e => setCustomFilename(e.target.value)}
                    placeholder={suggestedFilename || "Auto-detected"}
                />
            </div>

            <div className="mt-auto flex justify-end gap-3 pt-4 border-t border-white/10">
                <button onClick={() => window.close()} className="px-4 py-2 bg-transparent text-text-secondary hover:text-white transition-colors text-sm">Cancel</button>
                <button onClick={handleStart} disabled={loading || !url} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors shadow-lg shadow-blue-500/20">
                    {loading ? 'Starting...' : 'Start Download'}
                </button>
            </div>
        </div>
    );
};

export default AddDownloadWindow;
