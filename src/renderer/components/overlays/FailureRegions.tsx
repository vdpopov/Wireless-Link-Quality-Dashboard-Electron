import { useMemo, memo } from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import { getMinFailureClusterSize, TIME_WINDOWS } from '@shared/constants'

interface FailureRegionsProps {
  failedIndices: boolean[]
  timestamps: number[]
  xAtTime: (time: number) => number | null
  visibleRange: { start: number; end: number }
}

interface TimeRegion {
  startMs: number
  endMs: number
  isOngoing: boolean
}

const MIN_REGION_WIDTH_PX = 4

function FailureRegions({
  failedIndices,
  timestamps,
  xAtTime,
  visibleRange
}: FailureRegionsProps) {
  const timeWindow = useSettingsStore((s) => s.timeWindow)
  const windowSeconds = TIME_WINDOWS[timeWindow]

  const timeRegions = useMemo<TimeRegion[]>(() => {
    const len = Math.min(failedIndices.length, timestamps.length)
    if (len === 0) return []

    const minClusterSize = getMinFailureClusterSize(windowSeconds)
    const result: TimeRegion[] = []

    let startIdx = 0
    if (timestamps.length > 0) {
      const cutoffMs = visibleRange.start * 1000
      startIdx = binarySearchLeft(timestamps, cutoffMs)
    }

    let clusterStart: number | null = null

    for (let i = startIdx; i < len; i++) {
      if (failedIndices[i]) {
        if (clusterStart === null) {
          clusterStart = i
        }
      } else if (clusterStart !== null) {
        addRegion(clusterStart, i - 1, false)
        clusterStart = null
      }
    }

    if (clusterStart !== null) {
      addRegion(clusterStart, len - 1, true)
    }

    function addRegion(firstFailIdx: number, lastFailIdx: number, isOngoing: boolean) {
      const clusterSize = lastFailIdx - firstFailIdx + 1
      if (clusterSize < minClusterSize) return

      const startMs = firstFailIdx > 0
        ? (timestamps[firstFailIdx - 1] + timestamps[firstFailIdx]) / 2
        : timestamps[firstFailIdx]

      const endMs = lastFailIdx < len - 1
        ? (timestamps[lastFailIdx] + timestamps[lastFailIdx + 1]) / 2
        : timestamps[lastFailIdx]

      result.push({ startMs, endMs, isOngoing })
    }

    const firstTimestamp = timestamps[0]
    return result.filter(region => region.startMs > firstTimestamp + 2000)

  }, [failedIndices, timestamps, windowSeconds, visibleRange.start])

  // Calculate plot width in pixels (needed for ongoing regions)
  const plotMetrics = useMemo(() => {
    const leftX = xAtTime(visibleRange.start + 0.001) // Slightly inside to avoid boundary
    const midX = xAtTime((visibleRange.start + visibleRange.end) / 2)
    
    if (leftX === null || midX === null) return null
    
    // Calculate pixels per second
    const midTimeSec = (visibleRange.start + visibleRange.end) / 2
    const pxPerSec = (midX - leftX) / (midTimeSec - visibleRange.start - 0.001)
    const plotLeft = leftX - (0.001 * pxPerSec)
    const plotRight = plotLeft + (visibleRange.end - visibleRange.start) * pxPerSec
    
    return { plotLeft, plotRight, pxPerSec }
  }, [xAtTime, visibleRange.start, visibleRange.end])

  // Convert to pixels
  const pixelRegions = useMemo(() => {
    if (!plotMetrics) return []
    
    return timeRegions
      .map(({ startMs, endMs, isOngoing }) => {
        const startX = xAtTime(startMs / 1000)
        let endX = xAtTime(endMs / 1000)

        if (startX === null) return null

        if (endX === null || isOngoing) {
          endX = plotMetrics.plotRight
        }

        const width = Math.max(endX - startX, MIN_REGION_WIDTH_PX)
        return { startX, width }
      })
      .filter((r): r is { startX: number; width: number } => r !== null)
  }, [timeRegions, xAtTime, plotMetrics, visibleRange.start, visibleRange.end])

  if (pixelRegions.length === 0) return null

  return (
    <>
      {pixelRegions.map((region, idx) => (
        <div
          key={idx}
          className="overlay-failure"
          style={{
            position: 'absolute',
            left: region.startX,
            top: 0,
            width: region.width,
            height: '100%'
          }}
        />
      ))}
    </>
  )
}

export default memo(FailureRegions)

function binarySearchLeft(arr: number[], target: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}