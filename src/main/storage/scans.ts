import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { ScanResult, HeatmapData, Band } from '../../shared/types'
import { getChannelsForBand, SCAN_RETENTION_DAYS, STORAGE_DIR_NAME } from '../../shared/constants'
import { getCurrentBand } from '../services/net'

// ============================================
// Storage Directory
// ============================================

function getStorageDir(): string {
  const configPath = app.getPath('userData')
  return join(configPath, 'scans')
}

function ensureStorageDir(): void {
  const dir = getStorageDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0] // 'YYYY-MM-DD'
}

function getDayFilePath(dateStr: string): string {
  return join(getStorageDir(), `${dateStr}.json`)
}

// ============================================
// Save / Load Operations
// ============================================

/**
 * Save a scan to today's file (appends to existing scans)
 */
export function saveScan(scanData: ScanResult): boolean {
  if (!scanData) return false

  ensureStorageDir()
  const filepath = getDayFilePath(getDateString())

  // Load existing scans
  let scans: ScanResult[] = []
  if (existsSync(filepath)) {
    try {
      const content = readFileSync(filepath, 'utf8')
      scans = JSON.parse(content)
    } catch {
      scans = []
    }
  }

  // Append new scan
  scans.push(scanData)

  // Save back
  try {
    writeFileSync(filepath, JSON.stringify(scans, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * Load all scans for a specific date
 */
export function loadDayScans(dateStr: string): ScanResult[] {
  const filepath = getDayFilePath(dateStr)

  if (!existsSync(filepath)) {
    return []
  }

  try {
    const content = readFileSync(filepath, 'utf8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

/**
 * Load scans from the last N days
 */
export function loadScans(days: number): Record<string, ScanResult[]> {
  const result: Record<string, ScanResult[]> = {}
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = getDateString(date)
    const scans = loadDayScans(dateStr)
    if (scans.length > 0) {
      result[dateStr] = scans
    }
  }

  return result
}

/**
 * Get timestamp of the most recent scan
 */
export function getLastScanTime(): Date | null {
  const today = new Date()

  // Look back up to 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const scans = loadDayScans(getDateString(date))

    if (scans.length > 0) {
      const latest = scans.reduce((prev, curr) =>
        (curr.timestamp > prev.timestamp) ? curr : prev
      )
      return new Date(latest.timestamp)
    }
  }

  return null
}

// ============================================
// Heatmap Data
// ============================================

/**
 * Count total networks in a scan
 */
function scanTotalNetworks(scan: ScanResult): number {
  let total = 0
  for (const chData of Object.values(scan.channels)) {
    total += chData.count
  }
  return total
}

/**
 * Build 2D array for heatmap display
 */
export async function getHeatmapData(
  days: number,
  iface: string,
  band?: Band
): Promise<HeatmapData> {
  // Auto-detect band if not specified
  const detectedBand = band ?? (await getCurrentBand(iface)) ?? '2.4'
  const channels = [...getChannelsForBand(detectedBand)]
  const today = new Date()

  // Build list of dates (oldest first)
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    dates.push(getDateString(date))
  }

  // Build data array
  const data: number[][] = []

  for (const dateStr of dates) {
    const row: number[] = new Array(channels.length).fill(NaN)
    const scans = loadDayScans(dateStr)

    if (scans.length === 0) {
      data.push(row)
      continue
    }

    // Filter scans by band
    let bandScans = scans.filter((s) => s.band === detectedBand)

    // Old scans without band info - assume 2.4GHz
    if (bandScans.length === 0 && detectedBand === '2.4') {
      bandScans = scans.filter((s) => !s.band)
    }

    if (bandScans.length === 0) {
      data.push(row)
      continue
    }

    // Use scan with most networks (cache freshness varies)
    const bestScan = bandScans.reduce((prev, curr) =>
      scanTotalNetworks(curr) > scanTotalNetworks(prev) ? curr : prev
    )

    // Fill in channel counts
    for (let colIdx = 0; colIdx < channels.length; colIdx++) {
      const ch = channels[colIdx]
      const chData = bestScan.channels[ch]
      if (chData) {
        row[colIdx] = chData.count
      }
    }

    data.push(row)
  }

  return {
    data,
    dates,
    channels,
    band: detectedBand
  }
}

/**
 * Get scan details for tooltips (network names per channel per day)
 */
export function getScanDetails(
  days: number,
  band: Band
): Record<string, Record<number, string[]>> {
  const details: Record<string, Record<number, string[]>> = {}
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = getDateString(date)
    const scans = loadDayScans(dateStr)

    if (scans.length === 0) continue

    // Filter by band
    let bandScans = scans.filter((s) => s.band === band)
    if (bandScans.length === 0 && band === '2.4') {
      bandScans = scans.filter((s) => !s.band)
    }
    if (bandScans.length === 0) continue

    // Get best scan
    const bestScan = bandScans.reduce((prev, curr) =>
      scanTotalNetworks(curr) > scanTotalNetworks(prev) ? curr : prev
    )

    details[dateStr] = {}
    for (const [ch, chData] of Object.entries(bestScan.channels)) {
      details[dateStr][parseInt(ch, 10)] = chData.networks
    }
  }

  return details
}

/**
 * Get list of dates that have scan data
 */
export function getScanDates(): string[] {
  const dir = getStorageDir()
  if (!existsSync(dir)) return []

  try {
    const files = readdirSync(dir)
    const dates: string[] = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        const dateStr = file.replace('.json', '')
        // Validate date format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          dates.push(dateStr)
        }
      }
    }

    return dates.sort().reverse()
  } catch {
    return []
  }
}

/**
 * Remove scan files older than keepDays
 */
export function cleanupOldScans(keepDays: number = SCAN_RETENTION_DAYS): void {
  const dir = getStorageDir()
  if (!existsSync(dir)) return

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - keepDays)
  const cutoffStr = getDateString(cutoff)

  try {
    const files = readdirSync(dir)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const dateStr = file.replace('.json', '')
        if (dateStr < cutoffStr) {
          unlinkSync(join(dir, file))
        }
      }
    }
  } catch {
    // Silent fail
  }
}