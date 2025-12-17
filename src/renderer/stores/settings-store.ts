import { create } from 'zustand'
import type { TimeWindowKey } from '@shared/types'
import { DEFAULT_TIME_WINDOW, DEFAULT_REFRESH_INTERVAL, TIME_WINDOWS } from '@shared/constants'

interface SettingsState {
  // Time window
  timeWindow: TimeWindowKey
  timeWindowSeconds: number | null

  // Refresh
  refreshInterval: number

  // Playback state
  paused: boolean

  // Interface
  selectedInterface: string | null

  // Zoom state (times in SECONDS for uPlot)
  isZoomed: boolean
  zoomRange: { start: number; end: number } | null

  // Force update trigger
  updateTrigger: number

  // Actions
  setTimeWindow: (key: TimeWindowKey) => void
  setRefreshInterval: (ms: number) => void
  setPaused: (paused: boolean) => void
  togglePaused: () => void
  setSelectedInterface: (iface: string) => void
  setZoom: (startSec: number, endSec: number) => void
  resetZoom: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Initial state
  timeWindow: DEFAULT_TIME_WINDOW,
  timeWindowSeconds: TIME_WINDOWS[DEFAULT_TIME_WINDOW],
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
  paused: false,
  selectedInterface: null,
  isZoomed: false,
  zoomRange: null,
  updateTrigger: 0,

  // Actions
  setTimeWindow: (key) => {
    set((state) => ({
      timeWindow: key,
      timeWindowSeconds: TIME_WINDOWS[key],
      isZoomed: false,
      zoomRange: null,
      updateTrigger: state.updateTrigger + 1
    }))
  },

  setRefreshInterval: (ms) => {
    set({ refreshInterval: ms })
    window.api.setRefreshInterval(ms)
  },

  setPaused: (paused) => {
    set({ paused })
    if (paused) {
      window.api.stopMonitor()
    } else {
      window.api.startMonitor()
    }
  },

  togglePaused: () => {
    const { paused } = get()
    get().setPaused(!paused)
  },

  setSelectedInterface: (iface) => {
    set({ selectedInterface: iface })
  },

  setZoom: (startSec, endSec) => {
    set((state) => ({
      isZoomed: true,
      zoomRange: { start: startSec, end: endSec },
      updateTrigger: state.updateTrigger + 1
    }))
  },

  resetZoom: () => {
    set((state) => ({
      isZoomed: false,
      zoomRange: null,
      updateTrigger: state.updateTrigger + 1
    }))
  }
}))