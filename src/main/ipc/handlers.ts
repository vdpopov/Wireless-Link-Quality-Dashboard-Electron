import { ipcMain, BrowserWindow } from 'electron'
import type {
  WirelessInterface,
  PingHost,
  HeatmapData,
  Settings,
  Band,
  SerializedMonitorData,
  LinkInfo
} from '../../shared/types'
import { DEFAULT_REFRESH_INTERVAL, DEFAULT_TIME_WINDOW } from '../../shared/constants'
import { getWirelessInterfaces, getDefaultGateway } from '../services/net'
import { scanChannels } from '../services/scanner'
import { saveScan, getHeatmapData, getScanDetails, cleanupOldScans } from '../storage/scans'
import { dataCollector } from '../collectors/data-collector'

// ============================================
// State
// ============================================

let selectedInterface: string | null = null
let currentSettings: Settings = {
  timeWindow: DEFAULT_TIME_WINDOW,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
  paused: false,
  selectedInterface: null
}

// Auto-scan interval (1 hour in ms)
const AUTO_SCAN_INTERVAL = 60 * 60 * 1000
let autoScanTimer: NodeJS.Timeout | null = null

// ============================================
// Helper: Get Main Window
// ============================================

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

/**
 * Send data to renderer
 */
function sendToRenderer(channel: string, data: unknown): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

/**
 * Perform a network scan and notify renderer
 */
async function performScan(): Promise<boolean> {
  if (!selectedInterface) return false

  sendToRenderer('scan:progress', 'Scanning...')

  const result = await scanChannels(selectedInterface, { refreshCache: true })

  if (result) {
    saveScan(result)
    sendToRenderer('scan:complete', result)
    return true
  }

  return false
}

/**
 * Start automatic scanning every hour
 */
function startAutoScan(): void {
  // Clear any existing timer
  stopAutoScan()

  // Run initial scan after a short delay (allow UI to settle)
  setTimeout(() => {
    performScan()
  }, 3000)

  // Schedule hourly scans
  autoScanTimer = setInterval(() => {
    performScan()
  }, AUTO_SCAN_INTERVAL)
}

/**
 * Stop automatic scanning
 */
function stopAutoScan(): void {
  if (autoScanTimer) {
    clearInterval(autoScanTimer)
    autoScanTimer = null
  }
}

// ============================================
// Register All Handlers
// ============================================

export function registerIpcHandlers(): void {
  // ------------------------------------------
  // App / Interface
  // ------------------------------------------

  ipcMain.handle('app:get-interfaces', async (): Promise<WirelessInterface[]> => {
    return getWirelessInterfaces()
  })

  ipcMain.handle('app:select-interface', async (_, iface: string): Promise<boolean> => {
    selectedInterface = iface
    currentSettings.selectedInterface = iface

    // Setup default ping hosts
    const gateway = await getDefaultGateway()
    if (gateway) {
      dataCollector.addPingHost(gateway, 'gateway', true)
    }
    dataCollector.addPingHost('1.1.1.1', 'internet', false)

    // Start collecting
    await dataCollector.start(iface)

    // Start automatic network scanning (initial scan + hourly)
    startAutoScan()

    return true
  })

  // ------------------------------------------
  // Monitor Control
  // ------------------------------------------

  ipcMain.handle('monitor:start', async (): Promise<void> => {
    if (selectedInterface) {
      await dataCollector.start(selectedInterface)
      currentSettings.paused = false
    }
  })

  ipcMain.handle('monitor:stop', async (): Promise<void> => {
    dataCollector.stop()
    currentSettings.paused = true
  })

  ipcMain.handle('monitor:set-interval', async (_, ms: number): Promise<void> => {
    dataCollector.setRefreshRate(ms)
    currentSettings.refreshInterval = ms
  })

  ipcMain.handle('monitor:get-data', async (): Promise<SerializedMonitorData> => {
    return dataCollector.getSerializedData()
  })

  ipcMain.handle('monitor:clear-data', async (): Promise<void> => {
    dataCollector.clearData()
  })

  // ------------------------------------------
  // Ping Hosts
  // ------------------------------------------

  ipcMain.handle('ping:get-hosts', async (): Promise<PingHost[]> => {
    return dataCollector.getPingHosts()
  })

  ipcMain.handle(
    'ping:add-host',
    async (_, { host, label }: { host: string; label?: string }): Promise<PingHost> => {
      return dataCollector.addPingHost(host, label)
    }
  )

  ipcMain.handle('ping:remove-host', async (_, hostId: string): Promise<void> => {
    dataCollector.removePingHost(hostId)
  })

  // ------------------------------------------
  // Channel Scanning
  // ------------------------------------------

  ipcMain.handle(
    'scan:start',
    async (_, options?: { band?: Band }): Promise<boolean> => {
      if (!selectedInterface) return false

      sendToRenderer('scan:progress', 'Scanning...')

      const result = await scanChannels(selectedInterface, {
        refreshCache: true,
        band: options?.band
      })

      if (result) {
        saveScan(result)
        sendToRenderer('scan:complete', result)
        return true
      }

      return false
    }
  )

  // ------------------------------------------
  // Heatmap
  // ------------------------------------------

  ipcMain.handle(
    'heatmap:get-data',
    async (_, { days, band }: { days: number; band?: Band }): Promise<HeatmapData | null> => {
      if (!selectedInterface) return null
      return getHeatmapData(days, selectedInterface, band)
    }
  )

  ipcMain.handle(
    'heatmap:get-details',
    async (
      _,
      { days, band }: { days: number; band: Band }
    ): Promise<Record<string, Record<number, string[]>>> => {
      return getScanDetails(days, band)
    }
  )

  // ------------------------------------------
  // Settings
  // ------------------------------------------

  ipcMain.handle('settings:get', async (): Promise<Settings> => {
    return currentSettings
  })

  ipcMain.handle('settings:set', async (_, settings: Partial<Settings>): Promise<Settings> => {
    currentSettings = { ...currentSettings, ...settings }

    if (settings.refreshInterval !== undefined) {
      dataCollector.setRefreshRate(settings.refreshInterval)
    }

    if (settings.paused !== undefined) {
      if (settings.paused) {
        dataCollector.stop()
      } else if (selectedInterface) {
        await dataCollector.start(selectedInterface)
      }
    }

    return currentSettings
  })

  // ------------------------------------------
  // Cleanup
  // ------------------------------------------

  ipcMain.handle('storage:cleanup', async (_, keepDays?: number): Promise<void> => {
    cleanupOldScans(keepDays)
  })
}

// ============================================
// Setup Data Collector Events -> Renderer
// ============================================

export function setupCollectorBridge(): void {
  dataCollector.on('data', (data: SerializedMonitorData) => {
    sendToRenderer('monitor:data', data)
  })

  dataCollector.on('link-info', (info: LinkInfo) => {
    sendToRenderer('monitor:link-info', info)
  })

  dataCollector.on('hosts-changed', (hosts: PingHost[]) => {
    sendToRenderer('ping:hosts-changed', hosts)
  })
}

// ============================================
// Cleanup
// ============================================

export function cleanupIpc(): void {
  stopAutoScan()
  dataCollector.stop()
  ipcMain.removeAllListeners()
}