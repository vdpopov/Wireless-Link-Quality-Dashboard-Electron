import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import type { PingHost, PingResult } from '../../shared/types'
import { PING_INTERVAL, PING_TIMEOUT } from '../../shared/constants'

// ============================================
// Ping Worker
// ============================================

class PingWorker extends EventEmitter {
  private hosts: Map<string, PingHost> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private running = false

  /**
   * Start the ping worker
   */
  start(): void {
    if (this.running) return
    this.running = true

    // Restart intervals for all existing hosts
    for (const host of this.hosts.values()) {
      if (!this.intervals.has(host.id)) {
        this.startPingingHost(host)
      }
    }
  }


  /**
   * Stop all ping operations
   */
  stop(): void {
    this.running = false
    for (const [hostId, interval] of this.intervals) {
      clearInterval(interval)
      this.intervals.delete(hostId)
    }
  }

  /**
   * Add a host to ping
   */
  addHost(host: PingHost): void {
    if (this.hosts.has(host.id)) return

    this.hosts.set(host.id, host)
    this.startPingingHost(host)
  }

  /**
   * Remove a host
   */
  removeHost(hostId: string): void {
    const interval = this.intervals.get(hostId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(hostId)
    }
    this.hosts.delete(hostId)
  }

  /**
   * Get all current hosts
   */
  getHosts(): PingHost[] {
    return Array.from(this.hosts.values())
  }

  /**
   * Update host enabled state
   */
  setHostEnabled(hostId: string, enabled: boolean): void {
    const host = this.hosts.get(hostId)
    if (host) {
      host.enabled = enabled
    }
  }

  /**
   * Start pinging a specific host
   */
  private startPingingHost(host: PingHost): void {
    const interval = setInterval(async () => {
      if (!this.running || !host.enabled) return

      const result = await this.pingOnce(host.host)
      host.latest = result

      const pingResult: PingResult = {
        hostId: host.id,
        latency: result,
        timestamp: Date.now()
      }

      this.emit('result', pingResult)
    }, PING_INTERVAL)

    this.intervals.set(host.id, interval)

    // Do an immediate ping
    if (this.running && host.enabled) {
      this.pingOnce(host.host).then((result) => {
        host.latest = result
        this.emit('result', {
          hostId: host.id,
          latency: result,
          timestamp: Date.now()
        } as PingResult)
      })
    }
  }

  /**
   * Execute a single ping
   */
  private pingOnce(host: string): Promise<number | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null)
      }, PING_TIMEOUT + 500)

      const proc = spawn('ping', ['-c', '1', '-W', '1', host], {
        stdio: ['ignore', 'pipe', 'ignore']
      })

      let stdout = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.on('close', (code) => {
        clearTimeout(timeout)

        if (code !== 0) {
          resolve(null)
          return
        }

        // Parse "time=12.3 ms" or "time=12.3ms"
        const match = stdout.match(/time=([\d.]+)\s*ms/i)
        if (match) {
          resolve(parseFloat(match[1]))
        } else {
          resolve(null)
        }
      })

      proc.on('error', () => {
        clearTimeout(timeout)
        resolve(null)
      })
    })
  }
}

// ============================================
// Singleton Export
// ============================================

export const pingWorker = new PingWorker()

// ============================================
// Helper Functions
// ============================================

let hostIdCounter = 0

export function createPingHost(
  host: string,
  label?: string,
  isGateway = false
): PingHost {
  return {
    id: `host-${++hostIdCounter}-${Date.now()}`,
    host,
    label: label || host,
    enabled: true,
    latest: null,
    isGateway
  }
}