import { useMemo } from 'react'
import { useMonitorStore } from '../stores/monitor-store'
import { useSettingsStore } from '../stores/settings-store'
import { TIME_WINDOWS } from '@shared/constants'

export interface ProcessedChartData {
  time: number[]
  signal: (number | null)[]
  rxRate: (number | null)[]
  txRate: (number | null)[]
  bandwidth: (number | null)[]
  pingData: Record<string, (number | null)[]>
  visibleRange: { start: number; end: number }
  startIdx: number
  isDownsampled: boolean
}

export function useMonitorData(plotWidth: number = 800): ProcessedChartData {
  const timestamps = useMonitorStore((s) => s.timestamps)
  const signal = useMonitorStore((s) => s.signal)
  const rxRate = useMonitorStore((s) => s.rxRate)
  const txRate = useMonitorStore((s) => s.txRate)
  const bandwidth = useMonitorStore((s) => s.bandwidth)
  const pingData = useMonitorStore((s) => s.pingData)
  const lastUpdateTime = useMonitorStore((s) => s.lastUpdateTime)

  const timeWindow = useSettingsStore((s) => s.timeWindow)
  const isZoomed = useSettingsStore((s) => s.isZoomed)
  const zoomRange = useSettingsStore((s) => s.zoomRange)
  const updateTrigger = useSettingsStore((s) => s.updateTrigger)

  return useMemo(() => {
    const nowMs = Date.now()
    const nowSec = nowMs / 1000
    const windowSeconds = TIME_WINDOWS[timeWindow]

    // Calculate visible range
    let visibleStartSec: number
    let visibleEndSec: number

    if (isZoomed && zoomRange) {
      visibleStartSec = zoomRange.start
      visibleEndSec = zoomRange.end
    } else if (windowSeconds === null) {
      visibleStartSec = timestamps.length > 0 ? timestamps[0] / 1000 : nowSec - 600
      visibleEndSec = nowSec
    } else {
      visibleStartSec = nowSec - windowSeconds
      visibleEndSec = nowSec
    }

    // Find start index
    let startIdx = 0
    if (timestamps.length > 0 && windowSeconds !== null) {
      const cutoffMs = nowMs - windowSeconds * 1000
      for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] >= cutoffMs) {
          startIdx = i
          break
        }
      }
    }

    // Slice visible data
    const visTimeMs = timestamps.slice(startIdx)
    const visSignal = signal.slice(startIdx)
    const visRxRate = rxRate.slice(startIdx)
    const visTxRate = txRate.slice(startIdx)
    const visBandwidth = bandwidth.slice(startIdx)

    const visPingData: Record<string, (number | null)[]> = {}
    for (const [hostId, data] of Object.entries(pingData)) {
      visPingData[hostId] = data.slice(startIdx)
    }

    // Empty data
    if (visTimeMs.length === 0) {
      return {
        time: [],
        signal: [],
        rxRate: [],
        txRate: [],
        bandwidth: [],
        pingData: {},
        visibleRange: { start: visibleStartSec, end: visibleEndSec },
        startIdx: 0,
        isDownsampled: false
      }
    }

    // Convert to seconds
    const visTimeSec = visTimeMs.map((t) => t / 1000)

    // Your original resize logic
    const dataSpan = visTimeSec[visTimeSec.length - 1] - visTimeSec[0]
    const windowSpan = windowSeconds ?? dataSpan
    const dataFraction = dataSpan / windowSpan
    const dataPixels = plotWidth * dataFraction
    const targetPoints = Math.max(5, Math.floor(dataPixels * 0.5))

    // No downsampling needed
    if (visTimeSec.length <= targetPoints) {
      return {
        time: visTimeSec,
        signal: visSignal,
        rxRate: visRxRate,
        txRate: visTxRate,
        bandwidth: visBandwidth,
        pingData: visPingData,
        visibleRange: { start: visibleStartSec, end: visibleEndSec },
        startIdx,
        isDownsampled: false
      }
    }

    const dsTime: number[] = []
    const dsSignal: (number | null)[] = []
    const dsRxRate: (number | null)[] = []
    const dsTxRate: (number | null)[] = []
    const dsBandwidth: (number | null)[] = []
    const dsPingData: Record<string, (number | null)[]> = {}

    for (const hostId of Object.keys(visPingData)) {
      dsPingData[hostId] = []
    }

    if (windowSeconds !== null) {
      const stableBucketCount = Math.max(5, Math.floor(plotWidth * 0.5))
      const bucketSize = windowSeconds / stableBucketCount
      const anchoredStart = Math.floor(visibleStartSec / bucketSize) * bucketSize

      let bucketStart = anchoredStart
      let bucketEnd = bucketStart + bucketSize
      let lastIdxInBucket = -1

      for (let i = 0; i < visTimeSec.length; i++) {
        const t = visTimeSec[i]

        if (t < bucketStart) continue

        while (t >= bucketEnd) {
          if (lastIdxInBucket >= 0) {
            dsTime.push(visTimeSec[lastIdxInBucket])
            dsSignal.push(visSignal[lastIdxInBucket])
            dsRxRate.push(visRxRate[lastIdxInBucket])
            dsTxRate.push(visTxRate[lastIdxInBucket])
            dsBandwidth.push(visBandwidth[lastIdxInBucket])
            for (const [hostId, data] of Object.entries(visPingData)) {
              dsPingData[hostId].push(data[lastIdxInBucket])
            }
            lastIdxInBucket = -1
          }
          bucketStart = bucketEnd
          bucketEnd = bucketStart + bucketSize
        }

        lastIdxInBucket = i
      }

      if (lastIdxInBucket >= 0) {
        dsTime.push(visTimeSec[lastIdxInBucket])
        dsSignal.push(visSignal[lastIdxInBucket])
        dsRxRate.push(visRxRate[lastIdxInBucket])
        dsTxRate.push(visTxRate[lastIdxInBucket])
        dsBandwidth.push(visBandwidth[lastIdxInBucket])
        for (const [hostId, data] of Object.entries(visPingData)) {
          dsPingData[hostId].push(data[lastIdxInBucket])
        }
      }
    } else {
      // Infinite window: use original step method
      const step = Math.ceil(visTimeSec.length / targetPoints)

      for (let i = 0; i < visTimeSec.length; i += step) {
        dsTime.push(visTimeSec[i])
        dsSignal.push(visSignal[i])
        dsRxRate.push(visRxRate[i])
        dsTxRate.push(visTxRate[i])
        dsBandwidth.push(visBandwidth[i])

        for (const [hostId, data] of Object.entries(visPingData)) {
          dsPingData[hostId].push(data[i])
        }
      }
    }

    // After downsampling, exclude the last downsampled point to make it stable
    if (dsTime.length > 0) {
      dsTime.pop()
      dsSignal.pop()
      dsRxRate.pop()
      dsTxRate.pop()
      dsBandwidth.pop()
      for (const hostId of Object.keys(dsPingData)) {
        dsPingData[hostId].pop()
      }
    }



    return {
      time: dsTime,
      signal: dsSignal,
      rxRate: dsRxRate,
      txRate: dsTxRate,
      bandwidth: dsBandwidth,
      pingData: dsPingData,
      visibleRange: { start: visibleStartSec, end: visibleEndSec },
      startIdx,
      isDownsampled: true
    }
  }, [
    timestamps,
    signal,
    rxRate,
    txRate,
    bandwidth,
    pingData,
    timeWindow,
    isZoomed,
    zoomRange,
    updateTrigger,
    lastUpdateTime,
    plotWidth
  ])
}
