import { contextBridge, ipcRenderer } from 'electron'
import type {
  WirelessInterface,
  PingHost,
  HeatmapData,
  Settings,
  Band,
  SerializedMonitorData,
  LinkInfo,
  ScanResult
} from '../shared/types'

// ============================================
// Type-safe API
// ============================================

const api = {
  // ------------------------------------------
  // App / Interface
  // ------------------------------------------
  getInterfaces: (): Promise<WirelessInterface[]> => {
    return ipcRenderer.invoke('app:get-interfaces')
  },

  selectInterface: (iface: string): Promise<boolean> => {
    return ipcRenderer.invoke('app:select-interface', iface)
  },

  // ------------------------------------------
  // Monitor
  // ------------------------------------------
  startMonitor: (): Promise<void> => {
    return ipcRenderer.invoke('monitor:start')
  },

  stopMonitor: (): Promise<void> => {
    return ipcRenderer.invoke('monitor:stop')
  },

  setRefreshInterval: (ms: number): Promise<void> => {
    return ipcRenderer.invoke('monitor:set-interval', ms)
  },

  getMonitorData: (): Promise<SerializedMonitorData> => {
    return ipcRenderer.invoke('monitor:get-data')
  },

  clearMonitorData: (): Promise<void> => {
    return ipcRenderer.invoke('monitor:clear-data')
  },

  onMonitorData: (callback: (data: SerializedMonitorData) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: SerializedMonitorData) => callback(data)
    ipcRenderer.on('monitor:data', handler)
    return () => ipcRenderer.removeListener('monitor:data', handler)
  },

  onLinkInfo: (callback: (info: LinkInfo) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: LinkInfo) => callback(info)
    ipcRenderer.on('monitor:link-info', handler)
    return () => ipcRenderer.removeListener('monitor:link-info', handler)
  },

  // ------------------------------------------
  // Ping
  // ------------------------------------------
  getPingHosts: (): Promise<PingHost[]> => {
    return ipcRenderer.invoke('ping:get-hosts')
  },

  addPingHost: (host: string, label?: string): Promise<PingHost> => {
    return ipcRenderer.invoke('ping:add-host', { host, label })
  },

  removePingHost: (hostId: string): Promise<void> => {
    return ipcRenderer.invoke('ping:remove-host', hostId)
  },

  onPingHostsChanged: (callback: (hosts: PingHost[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, hosts: PingHost[]) => callback(hosts)
    ipcRenderer.on('ping:hosts-changed', handler)
    return () => ipcRenderer.removeListener('ping:hosts-changed', handler)
  },

  // ------------------------------------------
  // Scanning
  // ------------------------------------------
  startScan: (options?: { band?: Band }): Promise<boolean> => {
    return ipcRenderer.invoke('scan:start', options)
  },

  onScanComplete: (callback: (result: ScanResult) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, result: ScanResult) => callback(result)
    ipcRenderer.on('scan:complete', handler)
    return () => ipcRenderer.removeListener('scan:complete', handler)
  },

  onScanProgress: (callback: (message: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },

  // ------------------------------------------
  // Heatmap
  // ------------------------------------------
  getHeatmapData: (days: number, band?: Band): Promise<HeatmapData | null> => {
    return ipcRenderer.invoke('heatmap:get-data', { days, band })
  },

  getHeatmapDetails: (
    days: number,
    band: Band
  ): Promise<Record<string, Record<number, string[]>>> => {
    return ipcRenderer.invoke('heatmap:get-details', { days, band })
  },

  // ------------------------------------------
  // Settings
  // ------------------------------------------
  getSettings: (): Promise<Settings> => {
    return ipcRenderer.invoke('settings:get')
  },

  setSettings: (settings: Partial<Settings>): Promise<Settings> => {
    return ipcRenderer.invoke('settings:set', settings)
  },

  // ------------------------------------------
  // Storage
  // ------------------------------------------
  cleanupStorage: (keepDays?: number): Promise<void> => {
    return ipcRenderer.invoke('storage:cleanup', keepDays)
  }
}

// ============================================
// Expose to Renderer
// ============================================

contextBridge.exposeInMainWorld('api', api)

// ============================================
// Type Declaration for Renderer
// ============================================

export type Api = typeof api