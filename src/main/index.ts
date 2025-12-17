import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setupCollectorBridge, cleanupIpc } from './ipc/handlers'
import { cleanupOldScans } from './storage/scans'

// ============================================
// Window Creation
// ============================================

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: 'WiFi Monitor',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    // Dev server
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (rendererUrl) {
      mainWindow.loadURL(rendererUrl)
    } else {
      mainWindow.loadURL('http://localhost:5173')
    }
    mainWindow.webContents.openDevTools()
  } else {
    // Production build
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(() => {
  // Register IPC handlers before creating window
  registerIpcHandlers()
  setupCollectorBridge()

  // Cleanup old scan files on startup
  cleanupOldScans()

  // Create the main window
  createWindow()

  // macOS: Re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup before quit
app.on('before-quit', () => {
  cleanupIpc()
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})