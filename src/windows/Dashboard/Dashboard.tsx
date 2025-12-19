import { useDownloads } from '../../hooks/useDownloads';
import DownloadItem from '../../components/DownloadItem';

function Dashboard() {
  const { downloads, pause, resume, openAddWindow, openSettings, openFolder, openChunkDetails, deleteDownload, clearAll } = useDownloads();

  return (
    <div className="flex flex-col h-screen bg-bg text-text-primary">
      <header className="px-6 py-4 bg-surface/50 backdrop-blur-md border-b border-white/5 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Bolt Downloader</h1>
        <div className="flex gap-3">
          <button onClick={openAddWindow} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors shadow-lg shadow-blue-500/20">
            + New Download
          </button>
          {downloads.length > 0 && (
            <button onClick={clearAll} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-sm transition-colors shadow-lg shadow-red-500/20">
              🗑 Clear All
            </button>
          )}
          <button onClick={openSettings} className="px-4 py-2 bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 rounded-md font-medium text-sm transition-colors">
            ⚙ Settings
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70vh] text-gray-500">
            <div className="text-6xl mb-4 opacity-20">⬇</div>
            <p>No downloads yet.</p>
          </div>
        ) : (
          downloads.map(item => (
            <DownloadItem
              key={item.id}
              item={item}
              onPause={pause}
              onResume={resume}
              onOpenFolder={openFolder}
              onOpenChunkDetails={openChunkDetails}
              onDelete={deleteDownload}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default Dashboard;
