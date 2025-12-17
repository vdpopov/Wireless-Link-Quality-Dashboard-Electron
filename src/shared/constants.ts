import type { TimeWindowKey, Band } from './types'

// ============================================
// Time Windows (seconds)
// ============================================

export const TIME_WINDOWS: Record<TimeWindowKey, number | null> = {
  '10m': 600,
  '30m': 1800,
  '60m': 3600,
  '4h': 14400,
  '1D': 86400,
  '∞': null
}

export const TIME_WINDOW_LABELS: TimeWindowKey[] = ['10m', '30m', '60m', '4h', '1D', '∞']

// ============================================
// Colors
// ============================================

export const PING_COLORS = [
  '#FF0000',
  '#FFA500',
  '#800080',
  '#8B4513',
  '#FF1493',
  '#00FFFF'
] as const

export const CHART_COLORS = {
  signal: '#3b82f6',
  rxRate: '#22c55e',
  txRate: '#a855f7',
  bandwidth: '#f97316'
} as const

// ============================================
// Channel Definitions
// ============================================

export const CHANNELS_2_4GHZ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const

export const CHANNELS_5GHZ = [
  36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149,
  153, 157, 161, 165
] as const

export const FREQ_TO_CHANNEL_2_4GHZ: Record<number, number> = {
  2412: 1, 2417: 2, 2422: 3, 2427: 4, 2432: 5, 2437: 6, 2442: 7,
  2447: 8, 2452: 9, 2457: 10, 2462: 11, 2467: 12, 2472: 13, 2484: 14
}

export const FREQ_TO_CHANNEL_5GHZ: Record<number, number> = {
  5180: 36, 5200: 40, 5220: 44, 5240: 48,
  5260: 52, 5280: 56, 5300: 60, 5320: 64,
  5500: 100, 5520: 104, 5540: 108, 5560: 112,
  5580: 116, 5600: 120, 5620: 124, 5640: 128,
  5660: 132, 5680: 136, 5700: 140, 5720: 144,
  5745: 149, 5765: 153, 5785: 157, 5805: 161, 5825: 165
}

export function getChannelsForBand(band: Band): readonly number[] {
  return band === '5' ? CHANNELS_5GHZ : CHANNELS_2_4GHZ
}

export function freqToChannel(freqMhz: number): number | null {
  return FREQ_TO_CHANNEL_5GHZ[freqMhz] ?? FREQ_TO_CHANNEL_2_4GHZ[freqMhz] ?? null
}

// ============================================
// Defaults
// ============================================

export const DEFAULT_REFRESH_INTERVAL = 1000
export const DEFAULT_TIME_WINDOW: TimeWindowKey = '10m'
export const PING_INTERVAL = 300
export const PING_TIMEOUT = 1000

// ============================================
// Heatmap
// ============================================

export const HEATMAP_DAYS_OPTIONS = [7, 14, 30] as const
export const AUTO_SCAN_INTERVAL = 60 * 60 * 1000

// ============================================
// Failure Regions
// ============================================

export function getMinFailureClusterSize(windowSeconds: number | null): number {
  if (windowSeconds === null) return 100
  if (windowSeconds >= 86400) return 50
  if (windowSeconds >= 14400) return 25
  if (windowSeconds >= 3600) return 15
  if (windowSeconds >= 1800) return 5
  return 1
}

// ============================================
// Storage
// ============================================

export const STORAGE_DIR_NAME = 'wifi-monitor'
export const SCAN_RETENTION_DAYS = 90