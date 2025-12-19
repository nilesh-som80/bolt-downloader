import { useEffect, useState } from 'react';

const SettingsWindow = () => {
    const [config, setConfig] = useState<AppConfig | null>(null);

    useEffect(() => {
        (window.ipcRenderer as unknown as IpcRendererAPI).getConfig().then(setConfig);
    }, []);

    const handleChange = (key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => {
        if (!config) return;
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        (window.ipcRenderer as unknown as IpcRendererAPI).setConfig(key, value);
    };

    if (!config) return <div className="h-screen flex items-center justify-center text-text-secondary">Loading...</div>;

    return (
        <div className="h-screen bg-bg text-text-primary p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-6">Settings</h2>

            <div className="mb-4">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Default Download Path</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        value={config.defaultDownloadPath}
                        readOnly
                    />
                    <button onClick={async () => {
                        const path = await (window.ipcRenderer as unknown as IpcRendererAPI).selectFolder();
                        if (path) handleChange('defaultDownloadPath', path);
                    }} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-border rounded-md text-sm transition-colors">Change</button>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Max Concurrent Downloads</label>
                <input
                    type="number"
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    min="1" max="10"
                    value={config.maxConcurrentDownloads}
                    onChange={e => handleChange('maxConcurrentDownloads', parseInt(e.target.value))}
                />
            </div>

            <div className="mb-4">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Max Connections/Chunks (Base)</label>
                <input
                    type="number"
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    min="1" max="32"
                    value={config.maxChunks}
                    onChange={e => handleChange('maxChunks', parseInt(e.target.value))}
                />
                <p className="text-xs text-text-secondary mt-1">Dynamic scaling will override this for large files.</p>
            </div>

            <div className="mb-6">
                <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Theme</label>
                <select
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors text-white"
                    value={config.theme}
                    onChange={e => handleChange('theme', e.target.value)}
                >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>

            <div className="mt-auto flex justify-end pt-4 border-t border-white/10">
                <button onClick={() => window.close()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors shadow-lg shadow-blue-500/20">Done</button>
            </div>
        </div>
    );
};

export default SettingsWindow;
