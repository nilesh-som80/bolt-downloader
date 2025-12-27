import React, { useState, useRef, useEffect } from 'react';

interface DownloadItemProps {
    item: DownloadRecord;
    onPause: (id: string) => void;
    onResume: (id: string) => void;
    onOpenFolder: (id: string) => void;
    onOpenChunkDetails: (id: string) => void;
    onDelete: (id: string) => void;
}

const DownloadItem: React.FC<DownloadItemProps> = ({ item, onPause, onResume, onOpenFolder, onOpenChunkDetails, onDelete }) => {
    const [showContext, setShowContext] = useState(false);
    const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
    const contextRef = useRef<HTMLDivElement>(null);

    const progress = item.totalSize > 0 ? (item.downloadedSize / item.totalSize) * 100 : 0;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextPos({ x: e.clientX, y: e.clientY });
        setShowContext(true);
    };

    const handleDelete = () => {
        onDelete(item.id);
        setShowContext(false);
    };

    // Click outside to close context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextRef.current && !contextRef.current.contains(event.target as Node)) {
                setShowContext(false);
            }
        };
        if (showContext) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showContext]);

    return (
        <>
            <div
                className="bg-surface border border-border rounded-lg p-4 mb-3 transition-colors hover:border-gray-500 cursor-pointer"
                onContextMenu={handleContextMenu}
                onClick={() => onOpenChunkDetails(item.id)}
            >
                <div className="flex justify-between mb-2">
                    <span className="font-medium truncate max-w-[70%]" title={item.filename}>{item.filename || 'Connecting...'}</span>
                    <span className={`text-xs font-bold uppercase tracking-wide 
            ${item.status === 'DOWNLOADING' ? 'text-blue-500' : ''}
            ${item.status === 'COMPLETED' ? 'text-green-500' : ''}
            ${item.status === 'ERROR' ? 'text-red-500' : ''}
            ${item.status === 'PAUSED' ? 'text-orange-500' : ''}
            ${item.status === 'PENDING' ? 'text-yellow-500' : ''}
            ${item.status === 'WAITING_FOR_SPACE' ? 'text-purple-500' : ''}
        `}>{item.status}</span>
                </div>

                <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="flex justify-between text-xs text-text-secondary">
                    <span>
                        {formatSize(item.downloadedSize)} / {item.totalSize ? formatSize(item.totalSize) : 'Unknown'}
                        {item.status === 'DOWNLOADING' && item.speed !== undefined && ` • ${formatSize(item.speed)}/s`}
                    </span>
                    <span className="truncate max-w-[50%]" title={item.url}>{item.url}</span>
                </div>

                <div className="flex gap-2 mt-2">
                    {item.status === 'DOWNLOADING' && (
                        <button onClick={(e) => { e.stopPropagation(); onPause(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white" title="Pause">⏸</button>
                    )}
                    {(item.status === 'PAUSED' || item.status === 'ERROR' || item.status === 'WAITING_FOR_SPACE') && (
                        <button onClick={(e) => { e.stopPropagation(); onResume(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white" title="Resume">▶</button>
                    )}
                    {item.status === 'COMPLETED' && (
                        <button onClick={(e) => { e.stopPropagation(); onOpenFolder(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white" title="Open Folder">📂</button>
                    )}
                    {(item.status === 'DOWNLOADING' || item.status === 'PAUSED') && (
                        <button onClick={(e) => { e.stopPropagation(); onOpenChunkDetails(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white" title="View Chunks">📊</button>
                    )}
                </div>

            </div>

            {/* Context Menu */}
            {showContext && (
                <div
                    ref={contextRef}
                    className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-2 z-50 min-w-[180px]"
                    style={{ left: `${contextPos.x}px`, top: `${contextPos.y}px` }}
                >
                    <button
                        onClick={handleDelete}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                        <span>🗑</span>
                        <span>Delete Download</span>
                    </button>
                </div>
            )}
        </>
    );
};

export default DownloadItem;
