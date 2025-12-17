import { useMemo, useState, useCallback, useRef } from 'react'
import uPlot from 'uplot'
import BaseChart from './BaseChart'
import { useMonitorStore } from '../../stores/monitor-store'
import { useMonitorData } from '../../hooks/useMonitorData'
import { PING_COLORS } from '@shared/constants'

export default function PingChart() {
  const [plotWidth, setPlotWidth] = useState(800)

  const timestamps = useMonitorStore((s) => s.timestamps)
  const pingHosts = useMonitorStore((s) => s.pingHosts)
  const rawPingData = useMonitorStore((s) => s.pingData)

  const processedData = useMonitorData(plotWidth)

  // Use ref to avoid unnecessary recalculations
  const prevFailedRef = useRef<boolean[]>([])

  const failedIndices = useMemo(() => {
    if (pingHosts.length === 0) return undefined
    const firstHostId = pingHosts[0].id
    const data = rawPingData[firstHostId]
    if (!data || data.length === 0) return undefined
    
    // Find first non-null value (when host actually started)
    const firstDataIdx = data.findIndex((v) => v !== null)
    
    // No data yet - no failures
    if (firstDataIdx === -1) return undefined
    
    const newFailed = data.map((v, i) => {
      // Before host started collecting: not a failure
      if (i < firstDataIdx) return false
      // After host started: null = failure (timeout)
      return v === null
    })
    
    // Check if actually changed
    const prev = prevFailedRef.current
    if (
      prev.length === newFailed.length &&
      prev.every((v, i) => v === newFailed[i])
    ) {
      return prev
    }
    
    prevFailedRef.current = newFailed
    return newFailed
  }, [pingHosts, rawPingData])
  
  const data = useMemo<uPlot.AlignedData>(() => {
    if (processedData.time.length === 0 || pingHosts.length === 0) {
      return [[], ...pingHosts.map(() => [])]
    }

    const result: uPlot.AlignedData = [processedData.time]

    for (const host of pingHosts) {
      const hostData = processedData.pingData[host.id]
      if (hostData && hostData.length === processedData.time.length) {
        result.push(hostData)
      } else {
        result.push(new Array(processedData.time.length).fill(null))
      }
    }

    return result
  }, [processedData.time, processedData.pingData, pingHosts])

  const series = useMemo<uPlot.Series[]>(() => {
    return pingHosts.map((host, idx) => ({
      label: host.label,
      stroke: PING_COLORS[idx % PING_COLORS.length],
      width: 2,
      spanGaps: false
    }))
  }, [pingHosts])

  const handleWidthChange = useCallback((width: number) => {
    setPlotWidth(width)
  }, [])

  return (
    <BaseChart
      title="Ping (ms)"
      yLabel="ms"
      data={data}
      series={series}
      visibleRange={processedData.visibleRange}
      failedIndices={failedIndices}
      timestamps={timestamps}
      isDownsampled={processedData.isDownsampled}
      onWidthChange={handleWidthChange}
    />
  )
}