// ============================================
// Network & Link Types
// ============================================

export interface LinkInfo {
  signal: number | null // dBm
  rxRate: number | null // Mbps
  txRate: number | null // Mbps
  bandwidth: number | null // MHz
}

export interface WirelessInterface {
  name: string
  isActive: boolean
}

export type Band = '2.4' | '5'

// ============================================
// Ping Types
// ============================================

export interface PingHost {
  id: string // unique identifier
  host: string // IP or domain
  label: string // display name
  enabled: boolean
  latest: number | null // most recent ping (ms)
  isGateway: boolean
}

export interface PingResult {
  hostId: string
  latency: number | null // null = timeout/failure
  timestamp: number
}

// ============================================
// Time Series Data
// ============================================

export interface DataPoint {
  timestamp: number // unix ms
  value: number | null // null = failed reading
}

export interface MonitorData {
  // Timestamps (shared x-axis)
  timestamps: number[]

  // Signal strength
  signal: (number | null)[]

  // Link rates
  rxRate: (number | null)[]
  txRate: (number | null)[]

  // Bandwidth
  bandwidth: (number | null)[]

  // Ping data per host
  pingData: Map<string, (number | null)[]>
}

// For IPC transfer (Map doesn't serialize well)
export interface SerializedMonitorData {
  timestamps: number[]
  signal: (number | null)[]
  rxRate: (number | null)[]
  txRate: (number | null)[]
  bandwidth: (number | null)[]
  pingData: Record<string, (number | null)[]>
}

// ============================================
// Channel Scanning / Heatmap
// ============================================

export interface ChannelInfo {
  count: number
  networks: string[]
}

export interface ScanResult {
  timestamp: number
  band: Band
  channels: Record<number, ChannelInfo>
}

export interface HeatmapData {
  data: number[][] // [days][channels], NaN for no data
  dates: string[] // 'YYYY-MM-DD' format
  channels: number[]
  band: Band
}

// ============================================
// Settings & State
// ============================================

export type TimeWindowKey = '10m' | '30m' | '60m' | '4h' | '1D' | '∞'

export interface Settings {
  timeWindow: TimeWindowKey
  refreshInterval: number // ms
  paused: boolean
  selectedInterface: string | null
}

// ============================================
// Chart Interaction
// ============================================

export interface SelectionRange {
  startTime: number
  endTime: number
}

export interface HoverInfo {
  timestamp: number
  x: number // pixel position
  y: number
  plotIndex: number
}

// ============================================
// IPC Channel Types
// ============================================

export type IpcChannels = {
  // Main -> Renderer
  'monitor:data': SerializedMonitorData
  'monitor:link-info': LinkInfo
  'ping:result': PingResult
  'ping:hosts-changed': PingHost[]
  'scan:complete': ScanResult
  'scan:progress': string

  // Renderer -> Main
  'app:get-interfaces': void
  'app:select-interface': string
  'monitor:start': void
  'monitor:stop': void
  'monitor:set-interval': number
  'ping:add-host': { host: string; label?: string }
  'ping:remove-host': string
  'scan:start': { band?: Band }
  'heatmap:get-data': { days: number; band?: Band }
  'settings:get': void
  'settings:set': Partial<Settings>
}

// IPC Response types
export type IpcResponses = {
  'app:get-interfaces': WirelessInterface[]
  'heatmap:get-data': HeatmapData
  'settings:get': Settings
}