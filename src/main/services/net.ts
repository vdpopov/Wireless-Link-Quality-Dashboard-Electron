import { execFile } from 'child_process'
import { promisify } from 'util'
import type { LinkInfo, WirelessInterface, Band } from '../../shared/types'

const execFileAsync = promisify(execFile)

// ============================================
// Command Execution Helper
// ============================================

async function runCommand(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: 5000,
      encoding: 'utf8'
    })
    return stdout
  } catch {
    return null
  }
}

// ============================================
// Network Information
// ============================================

/**
 * Get default gateway IP from `ip route`
 */
export async function getDefaultGateway(): Promise<string | null> {
  const output = await runCommand('ip', ['route'])
  if (!output) return null

  for (const line of output.split('\n')) {
    if (line.startsWith('default')) {
      const parts = line.split(/\s+/)
      const viaIndex = parts.indexOf('via')
      if (viaIndex !== -1 && parts[viaIndex + 1]) {
        return parts[viaIndex + 1]
      }
    }
  }
  return null
}

/**
 * Get list of wireless interfaces from `iw dev`
 */
export async function getWirelessInterfaces(): Promise<WirelessInterface[]> {
  const output = await runCommand('iw', ['dev'])
  if (!output) return []

  const interfaces: WirelessInterface[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    if (line.includes('Interface')) {
      const parts = line.trim().split(/\s+/)
      const name = parts[parts.length - 1]
      if (name) {
        // Check if interface is active (has an IP)
        const isActive = await checkInterfaceActive(name)
        interfaces.push({ name, isActive })
      }
    }
  }

  return interfaces
}

/**
 * Check if interface has an active connection
 */
async function checkInterfaceActive(iface: string): Promise<boolean> {
  const output = await runCommand('iw', ['dev', iface, 'link'])
  if (!output) return false
  return !output.includes('Not connected')
}

/**
 * Get link information (signal, rates, bandwidth) from `iw dev <iface> link`
 */
export async function getLinkInfo(iface: string): Promise<LinkInfo> {
  const result: LinkInfo = {
    signal: null,
    rxRate: null,
    txRate: null,
    bandwidth: null
  }

  const output = await runCommand('iw', ['dev', iface, 'link'])
  if (!output) return result

  // Signal: "signal: -52 dBm"
  const signalMatch = output.match(/signal:\s*(-?\d+)/)
  if (signalMatch) {
    result.signal = parseInt(signalMatch[1], 10)
  }

  // RX bitrate: "rx bitrate: 866.7 MBit/s ... 80MHz"
  const rxMatch = output.match(/rx bitrate:\s*([\d.]+)\s*MBit\/s.*?(\d+)MHz/)
  if (rxMatch) {
    result.rxRate = parseFloat(rxMatch[1])
    result.bandwidth = parseInt(rxMatch[2], 10)
  }

  // TX bitrate: "tx bitrate: 866.7 MBit/s ... 80MHz"
  const txMatch = output.match(/tx bitrate:\s*([\d.]+)\s*MBit\/s.*?(\d+)MHz/)
  if (txMatch) {
    result.txRate = parseFloat(txMatch[1])
    // Use TX bandwidth as fallback if RX didn't have it
    if (result.bandwidth === null) {
      result.bandwidth = parseInt(txMatch[2], 10)
    }
  }

  return result
}

/**
 * Get current connection frequency in MHz
 */
export async function getCurrentFrequency(iface: string): Promise<number | null> {
  const output = await runCommand('iw', ['dev', iface, 'link'])
  if (!output) return null

  const freqMatch = output.match(/freq:\s*([\d.]+)/)
  if (freqMatch) {
    return parseFloat(freqMatch[1])
  }
  return null
}

/**
 * Detect if connected to 2.4GHz or 5GHz band
 */
export async function getCurrentBand(iface: string): Promise<Band | null> {
  const freq = await getCurrentFrequency(iface)
  if (freq === null) return null

  // 2.4GHz: 2412-2484 MHz
  // 5GHz: 5180-5825 MHz
  return freq < 3000 ? '2.4' : '5'
}

/**
 * Get connected SSID
 */
export async function getConnectedSSID(iface: string): Promise<string | null> {
  const output = await runCommand('iw', ['dev', iface, 'link'])
  if (!output) return null

  const ssidMatch = output.match(/SSID:\s*(.+)/)
  if (ssidMatch) {
    return ssidMatch[1].trim()
  }
  return null
}