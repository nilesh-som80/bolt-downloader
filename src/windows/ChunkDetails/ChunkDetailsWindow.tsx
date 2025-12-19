import React, { useState, useEffect } from 'react';

interface ChunkInfo {
    chunkIndex: number;
    start: number;
    end: number;
    downloaded: number;
    progress: number;
    done: boolean;
    size: number;
}

interface IpcRendererAPI {
    getChunkDetails: (id: string) => Promise<ChunkInfo[]>;
    getDownloads: () => Promise<any[]>;
}

const ChunkDetailsWindow: React.FC = () => {
    const [chunks, setChunks] = useState<ChunkInfo[]>([]);
    const [downloadInfo, setDownloadInfo] = useState<any>(null);
    const [downloadId, setDownloadId] = useState<string>('');

    useEffect(() => {
        // Get download ID from URL params
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
            setDownloadId(id);
        }
    }, []);

    useEffect(() => {
        if (!downloadId) return;

        const api = (window.ipcRenderer as unknown as IpcRendererAPI);

        // Initial fetch
        const fetchData = async () => {
            try {
                const chunkData = await api.getChunkDetails(downloadId);
                setChunks(chunkData);

                // Get download info
                const downloads = await api.getDownloads();
                const download = downloads.find(d => d.id === downloadId);
                setDownloadInfo(download);
            } catch (err) {
                console.error('Failed to fetch chunk details:', err);
            }
        };

        fetchData();

        // Refresh every 500ms
        const interval = setInterval(fetchData, 500);

        return () => clearInterval(interval);
    }, [downloadId]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatRange = (start: number, end: number) => {
        return `${formatSize(start)} - ${formatSize(end)}`;
    };

    const getStatusColor = (chunk: ChunkInfo) => {
        if (chunk.done) return 'bg-green-500';
        if (chunk.downloaded > 0) return 'bg-blue-500';
        return 'bg-gray-600';
    };

    const getStatusText = (chunk: ChunkInfo) => {
        if (chunk.done) return 'Completed';
        if (chunk.downloaded > 0) return 'Downloading';
        return 'Pending';
    };

    return (
        <div className="flex flex-col h-screen bg-bg text-text-primary overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-surface/50 backdrop-blur-md border-b border-white/5">
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Chunk Details
                        </h1>
                        {downloadInfo && (
                            <div className="mt-1 text-sm text-text-secondary">
                                <div className="truncate" title={downloadInfo.filename}>
                                    {downloadInfo.filename || 'Loading...'}
                                </div>
                                <div className="flex gap-4 mt-1">
                                    <span>Total: {formatSize(downloadInfo.totalSize)}</span>
                                    <span>•</span>
                                    <span>Chunks: {chunks.length}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons - fixed width, no shrink */}
                    <div className="flex gap-2 flex-shrink-0">
                        {downloadInfo?.status === 'DOWNLOADING' && (
                            <button
                                onClick={() => (window.ipcRenderer as any).pauseDownload(downloadId)}
                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                                title="Pause Download"
                            >
                                ⏸ Pause
                            </button>
                        )}
                        {(downloadInfo?.status === 'PAUSED' || downloadInfo?.status === 'ERROR') && (
                            <button
                                onClick={() => (window.ipcRenderer as any).resumeDownload(downloadId)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                                title="Resume Download"
                            >
                                ▶ Resume
                            </button>
                        )}
                        <button
                            onClick={() => {
                                (window.ipcRenderer as any).deleteDownload(downloadId);
                                window.close();
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                            title="Delete Download"
                        >
                            🗑 Delete
                        </button>
                        <button
                            onClick={() => (window.ipcRenderer as any).invoke('move-download-to-end', downloadId)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                            title="Move to End"
                        >
                            ⬇ Move
                        </button>
                    </div>
                </div>
            </div>

            {/* Chunk List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {chunks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <div className="text-4xl mb-2">📊</div>
                            <p>No chunk data available</p>
                        </div>
                    </div>
                ) : (
                    chunks.map((chunk) => (
                        <div
                            key={chunk.chunkIndex}
                            className="bg-surface border border-border rounded-lg p-3 transition-colors hover:border-gray-500"
                        >
                            {/* Chunk Header */}
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-sm">
                                    Chunk {chunk.chunkIndex}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${chunk.done ? 'bg-green-500/20 text-green-400' :
                                    chunk.downloaded > 0 ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-gray-600/20 text-gray-400'
                                    }`}>
                                    {getStatusText(chunk)}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`h-full transition-all duration-300 ${getStatusColor(chunk)}`}
                                    style={{ width: `${chunk.progress}%` }}
                                />
                            </div>

                            {/* Details */}
                            <div className="flex justify-between text-xs text-text-secondary">
                                <span>{formatRange(chunk.start, chunk.end)}</span>
                                <span>
                                    {formatSize(chunk.downloaded)} / {formatSize(chunk.size)} ({chunk.progress.toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ChunkDetailsWindow;
