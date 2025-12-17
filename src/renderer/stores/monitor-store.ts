import { create } from 'zustand'
import type { PingHost, SerializedMonitorData } from '@shared/types'

// ============================================
// Types
// ============================================

interface MonitorState {
  // Timestamps (shared x-axis)
  timestamps: number[]

  // Signal data
  signal: (number | null)[]

  // Rate data
  rxRate: (number | null)[]
  txRate: (number | null)[]

  // Bandwidth
  bandwidth: (number | null)[]

  // Ping data (hostId -> values)
  pingData: Record<string, (number | null)[]>

  // Ping hosts list
  pingHosts: PingHost[]

  // Latest values (for status display)
  latestSignal: number | null
  latestRxRate: number | null
  latestTxRate: number | null
  latestBandwidth: number | null

  // Flags
  needsRedraw: boolean
  lastUpdateTime: number

  // Actions
  updateData: (data: SerializedMonitorData) => void
  setPingHosts: (hosts: PingHost[]) => void
  addPingHost: (host: string, label?: string) => Promise<void>
  removePingHost: (hostId: string) => Promise<void>
  clearData: () => void
  setNeedsRedraw: (needs: boolean) => void
}

// ============================================
// Store
// ============================================

export const useMonitorStore = create<MonitorState>((set, get) => ({
  // Initial state
  timestamps: [],
  signal: [],
  rxRate: [],
  txRate: [],
  bandwidth: [],
  pingData: {},
  pingHosts: [],
  latestSignal: null,
  latestRxRate: null,
  latestTxRate: null,
  latestBandwidth: null,
  needsRedraw: false,
  lastUpdateTime: 0,

  // Actions
  updateData: (data) => {
    const len = data.timestamps.length

    set({
      timestamps: data.timestamps,
      signal: data.signal,
      rxRate: data.rxRate,
      txRate: data.txRate,
      bandwidth: data.bandwidth,
      pingData: data.pingData,
      latestSignal: len > 0 ? data.signal[len - 1] : null,
      latestRxRate: len > 0 ? data.rxRate[len - 1] : null,
      latestTxRate: len > 0 ? data.txRate[len - 1] : null,
      latestBandwidth: len > 0 ? data.bandwidth[len - 1] : null,
      needsRedraw: true,
      lastUpdateTime: Date.now()
    })
  },

  setPingHosts: (hosts) => {
    set({ pingHosts: hosts })
  },

  addPingHost: async (host, label) => {
    await window.api.addPingHost(host, label)
  },


  removePingHost: async (hostId) => {
    await window.api.removePingHost(hostId)
  },


  clearData: () => {
    set({
      timestamps: [],
      signal: [],
      rxRate: [],
      txRate: [],
      bandwidth: [],
      pingData: {},
      latestSignal: null,
      latestRxRate: null,
      latestTxRate: null,
      latestBandwidth: null,
      needsRedraw: true
    })
    window.api.clearMonitorData()
  },

  setNeedsRedraw: (needs) => {
    set({ needsRedraw: needs })
  }
}))

// ============================================
// Selectors (for performance)
// ============================================

export const selectTimestamps = (state: MonitorState) => state.timestamps
export const selectSignal = (state: MonitorState) => state.signal
export const selectRxRate = (state: MonitorState) => state.rxRate
export const selectTxRate = (state: MonitorState) => state.txRate
export const selectBandwidth = (state: MonitorState) => state.bandwidth
export const selectPingData = (state: MonitorState) => state.pingData
export const selectPingHosts = (state: MonitorState) => state.pingHosts

export const selectLatestValues = (state: MonitorState) => ({
  signal: state.latestSignal,
  rxRate: state.latestRxRate,
  txRate: state.latestTxRate,
  bandwidth: state.latestBandwidth
})