import { app, BrowserWindow, ipcMain, Menu, clipboard } from 'electron'
import path from 'node:path'
import { downloadManager } from './DownloadManager'
import { configManager } from './ConfigManager'


process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Track open chunk detail windows by download ID to prevent duplicates
const chunkWindows = new Map<string, BrowserWindow>();

// Window Creation Helpers
function createMainWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Register main window with manager for updates
  downloadManager.setMainWindow(win);

  // Register Cmd/Ctrl+V to open New Download window with clipboard URL
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.meta || input.control) && input.key.toLowerCase() === 'v' && input.type === 'keyDown') {
      // Prevent default paste behavior
      event.preventDefault();
      // Read clipboard content
      const clipboardText = clipboard.readText();
      // Open New Download window with clipboard URL
      createAddDownloadWindow(clipboardText);
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL) // Loads index.html by default
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createAddDownloadWindow(prefilledUrl?: string) {
  const addWin = new BrowserWindow({
    width: 500,
    height: 500,
    title: 'Add Download - Bolt Downloader',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'), // Re-use preload
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    // In dev, we route manually or use specific HTML if Vite is configured for MPA
    // Vite MPA dev server URL pattern: http://localhost:5173/add-download.html
    addWin.loadURL(`${VITE_DEV_SERVER_URL}/add-download.html`)
  } else {
    addWin.loadFile(path.join(RENDERER_DIST, 'add-download.html'))
  }

  // Send prefilled URL after window loads
  if (prefilledUrl) {
    addWin.webContents.on('did-finish-load', () => {
      addWin.webContents.send('prefill-url', prefilledUrl);
    });
  }
}

function createSettingsWindow() {
  const settingsWin = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'Settings - Bolt Downloader',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}/settings.html`)
  } else {
    settingsWin.loadFile(path.join(RENDERER_DIST, 'settings.html'))
  }
}

function createChunkDetailsWindow(downloadId: string) {
  // Check if window already exists for this download
  const existingWindow = chunkWindows.get(downloadId);
  if (existingWindow && !existingWindow.isDestroyed()) {
    // Focus existing window instead of creating new one
    existingWindow.focus();
    return;
  }

  const chunkWin = new BrowserWindow({
    width: 600,
    height: 700,
    title: 'Chunk Details - Bolt Downloader',
    autoHideMenuBar: true,
    resizable: false, // Fixed size as requested
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    chunkWin.loadURL(`${VITE_DEV_SERVER_URL}/chunk-details.html?id=${downloadId}`)
  } else {
    chunkWin.loadFile(path.join(RENDERER_DIST, 'chunk-details.html'), {
      query: { id: downloadId }
    })
  }

  // Track this window
  chunkWindows.set(downloadId, chunkWin);

  // Clean up tracking when window is closed
  chunkWin.on('closed', () => {
    chunkWindows.delete(downloadId);
  });
}

// Global IPC to open windows
ipcMain.handle('open-add-download', () => createAddDownloadWindow());
ipcMain.handle('open-settings', () => createSettingsWindow());
ipcMain.handle('open-chunk-details', (_, id: string) => createChunkDetailsWindow(id));

// Create Application Menu
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu (required to keep File menu separate)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    // File menu (appears on all platforms)
    {
      label: 'File',
      submenu: [
        {
          label: 'New Download',
          accelerator: 'CmdOrCtrl+N',
          click: () => createAddDownloadWindow()
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => createSettingsWindow()
        }
      ]
    },
    // Edit menu (required for Copy/Paste shortcuts to work on Mac)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    // View menu for development
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App Lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

app.whenReady().then(() => {
  // Ensure config loaded
  console.log('Config loaded:', configManager.getAll());
  createMainWindow();
  createMenu(); // Set up application menu
})
