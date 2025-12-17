import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ScanResult, ChannelInfo, Band } from '../../shared/types'
import {
  getChannelsForBand,
  freqToChannel,
  CHANNELS_2_4GHZ,
  CHANNELS_5GHZ
} from '../../shared/constants'
import { getCurrentBand } from './net'

const execFileAsync = promisify(execFile)

// ============================================
// Scan Cache Refresh
// ============================================

/**
 * Ask NetworkManager to refresh WiFi scan cache
 */
async function refreshScanCache(): Promise<boolean> {
  try {
    await execFileAsync('nmcli', ['device', 'wifi', 'rescan'], {
      timeout: 5000
    })
    // Give it time to populate
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return true
  } catch {
    return false
  }
}

// ============================================
// Channel Scanning
// ============================================

/**
 * Parse cached WiFi scan results to get channel congestion data.
 * Uses 'iw dev <iface> scan dump' which doesn't require root.
 */
export async function scanChannels(
  iface: string,
  options: { refreshCache?: boolean; band?: Band } = {}
): Promise<ScanResult | null> {
  const { refreshCache = true, band } = options

  // Auto-detect band from current connection
  const detectedBand = band ?? (await getCurrentBand(iface)) ?? '2.4'
  const channelList = getChannelsForBand(detectedBand)

  // Refresh cache if requested
  if (refreshCache) {
    await refreshScanCache()
  }

  // Get scan dump
  let output: string
  try {
    const { stdout } = await execFileAsync('iw', ['dev', iface, 'scan', 'dump'], {
      timeout: 10000,
      encoding: 'utf8'
    })
    output = stdout
  } catch {
    return null
  }

  // Initialize channels
  const channels: Record<number, ChannelInfo> = {}
  for (const ch of channelList) {
    channels[ch] = { count: 0, networks: [] }
  }

  // Parse BSS entries
  let currentChannel: number | null = null
  let currentFreq: number | null = null
  let currentSsid: string | null = null

  const lines = output.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // New BSS entry - save previous
    if (line.startsWith('BSS ')) {
      // Save previous entry
      const finalChannel = currentChannel ?? (currentFreq ? freqToChannel(currentFreq) : null)

      if (finalChannel !== null && channels[finalChannel]) {
        channels[finalChannel].count++
        if (currentSsid) {
          channels[finalChannel].networks.push(currentSsid)
        }
      }

      // Reset for new entry
      currentChannel = null
      currentFreq = null
      currentSsid = null
      continue
    }

    // Extract frequency
    const freqMatch = line.match(/^freq:\s*([\d.]+)/)
    if (freqMatch) {
      currentFreq = parseFloat(freqMatch[1])
      continue
    }

    // Extract channel from DS Parameter set (preferred)
    const channelMatch = line.match(/^DS Parameter set: channel (\d+)/)
    if (channelMatch) {
      currentChannel = parseInt(channelMatch[1], 10)
      continue
    }

    // Extract SSID
    const ssidMatch = line.match(/^SSID:\s*(.+)/)
    if (ssidMatch) {
      const ssid = ssidMatch[1].trim()
      if (ssid) {
        currentSsid = ssid
      }
      continue
    }
  }

  // Don't forget the last entry
  const finalChannel = currentChannel ?? (currentFreq ? freqToChannel(currentFreq) : null)
  if (finalChannel !== null && channels[finalChannel]) {
    channels[finalChannel].count++
    if (currentSsid) {
      channels[finalChannel].networks.push(currentSsid)
    }
  }

  // Deduplicate networks per channel
  for (const ch of Object.keys(channels)) {
    const chNum = parseInt(ch, 10)
    const uniqueNetworks = [...new Set(channels[chNum].networks)]
    channels[chNum].networks = uniqueNetworks
    // Update count to reflect unique networks
    channels[chNum].count = uniqueNetworks.length || channels[chNum].count
  }

  return {
    timestamp: Date.now(),
    band: detectedBand,
    channels
  }
}

/**
 * Simplified version - returns just channel -> count mapping
 */
export async function getChannelCounts(
  iface: string
): Promise<Record<number, number> | null> {
  const scan = await scanChannels(iface)
  if (!scan) return null

  const counts: Record<number, number> = {}
  for (const [ch, data] of Object.entries(scan.channels)) {
    counts[parseInt(ch, 10)] = data.count
  }
  return counts
}