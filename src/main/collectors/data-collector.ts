import { EventEmitter } from 'events'
import type { LinkInfo, SerializedMonitorData, PingHost } from '../../shared/types'
import { DEFAULT_REFRESH_INTERVAL } from '../../shared/constants'
import { getLinkInfo, getDefaultGateway } from '../services/net'
import { pingWorker, createPingHost } from '../services/ping'

// ============================================
// Data Store (in-memory)
// ============================================

interface DataStore {
  timestamps: number[]
  signal: (number | null)[]
  rxRate: (number | null)[]
  txRate: (number | null)[]
  bandwidth: (number | null)[]
  pingData: Map<string, (number | null)[]>
}

const store: DataStore = {
  timestamps: [],
  signal: [],
  rxRate: [],
  txRate: [],
  bandwidth: [],
  pingData: new Map()
}

// ============================================
// Data Collector
// ============================================

class DataCollector extends EventEmitter {
  private interval: NodeJS.Timeout | null = null
  private refreshRate = DEFAULT_REFRESH_INTERVAL
  private iface: string | null = null
  private running = false
  private gatewayHostId: string | null = null
  private gatewayRemovedByUser = false

  /**
   * Start collecting data
   */
  async start(iface: string): Promise<void> {
    if (this.running) return

    this.iface = iface
    this.running = true

    // Start ping worker
    pingWorker.start()

    // Listen for ping results
    pingWorker.on('result', this.onPingResult.bind(this))

    // Start collection loop
    this.startLoop()

    // Do initial collection immediately
    await this.collect()
  }

  /**
   * Stop collecting
   */
  stop(): void {
    this.running = false

    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    pingWorker.stop()
    pingWorker.removeAllListeners('result')
  }

  /**
   * Set refresh interval
   */
  setRefreshRate(ms: number): void {
    this.refreshRate = ms

    if (this.running && this.interval) {
      clearInterval(this.interval)
      this.startLoop()
    }
  }

  /**
   * Add a ping host
   */
  addPingHost(host: string, label?: string, isGateway = false): PingHost {
    const pingHost = createPingHost(host, label, isGateway)

    // Initialize data array with nulls to match current timestamps
    store.pingData.set(pingHost.id, new Array(store.timestamps.length).fill(null))

    pingWorker.addHost(pingHost)

    if (isGateway) {
      this.gatewayHostId = pingHost.id
    }

    this.emit('hosts-changed', pingWorker.getHosts())
    return pingHost
  }

  /**
   * Remove a ping host
   */
  removePingHost(hostId: string): void {
    const hosts = pingWorker.getHosts()
    const host = hosts.find((h) => h.id === hostId)

    if (host?.isGateway) {
      this.gatewayHostId = null
      this.gatewayRemovedByUser = true
    }

    pingWorker.removeHost(hostId)
    store.pingData.delete(hostId)

    this.emit('hosts-changed', pingWorker.getHosts())
  }

  /**
   * Get current ping hosts
   */
  getPingHosts(): PingHost[] {
    return pingWorker.getHosts()
  }

  /**
   * Get serialized data for IPC transfer
   */
  getSerializedData(): SerializedMonitorData {
    const pingData: Record<string, (number | null)[]> = {}
    for (const [hostId, data] of store.pingData) {
      pingData[hostId] = data
    }

    return {
      timestamps: store.timestamps,
      signal: store.signal,
      rxRate: store.rxRate,
      txRate: store.txRate,
      bandwidth: store.bandwidth,
      pingData
    }
  }

  /**
   * Clear all stored data
   */
  clearData(): void {
    store.timestamps = []
    store.signal = []
    store.rxRate = []
    store.txRate = []
    store.bandwidth = []
    store.pingData.clear()

    // Re-initialize ping data arrays for existing hosts
    for (const host of pingWorker.getHosts()) {
      store.pingData.set(host.id, [])
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private startLoop(): void {
    this.interval = setInterval(() => {
      if (this.running) {
        this.collect()
      }
    }, this.refreshRate)
  }

  private async collect(): Promise<void> {
    if (!this.iface) return

    const timestamp = Date.now()
    const linkInfo = await getLinkInfo(this.iface)

    // Append to store
    store.timestamps.push(timestamp)
    store.signal.push(linkInfo.signal)
    store.rxRate.push(linkInfo.rxRate)
    store.txRate.push(linkInfo.txRate)
    store.bandwidth.push(linkInfo.bandwidth)

    // Append ping data (using latest values from ping worker)
    for (const host of pingWorker.getHosts()) {
      const data = store.pingData.get(host.id)
      if (data) {
        data.push(host.enabled ? host.latest : null)
      }
    }

    // Check gateway periodically (every 5 samples)
    if (store.timestamps.length % 5 === 0) {
      await this.checkGateway()
    }

    // Emit update
    this.emit('data', this.getSerializedData())
    this.emit('link-info', linkInfo)
  }

  private async checkGateway(): Promise<void> {
    const newGateway = await getDefaultGateway()

    const currentGatewayHost = this.gatewayHostId
      ? pingWorker.getHosts().find((h) => h.id === this.gatewayHostId)
      : null

    if (currentGatewayHost && newGateway && newGateway !== currentGatewayHost.host) {
      // Gateway changed - update it
      currentGatewayHost.host = newGateway
      this.emit('hosts-changed', pingWorker.getHosts())
    } else if (!currentGatewayHost && newGateway && !this.gatewayRemovedByUser) {
      // No gateway host but we found one - add it
      this.addPingHost(newGateway, 'gateway', true)
    }
  }

  private onPingResult(): void {
    // Ping results are handled in collect() using host.latest
    // This handler is for potential future real-time updates
  }
}

// ============================================
// Singleton Export
// ============================================

export const dataCollector = new DataCollector()