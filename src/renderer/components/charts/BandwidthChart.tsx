import { useMemo, useState, useCallback } from 'react'
import uPlot from 'uplot'
import BaseChart from './BaseChart'
import { useMonitorStore } from '../../stores/monitor-store'
import { useMonitorData } from '../../hooks/useMonitorData'
import { CHART_COLORS } from '@shared/constants'

export default function BandwidthChart() {
  const [plotWidth, setPlotWidth] = useState(800)

  const timestamps = useMonitorStore((s) => s.timestamps)
  const bandwidth = useMonitorStore((s) => s.bandwidth)

  // Pass plotWidth to enable adaptive downsampling
  const processedData = useMonitorData(plotWidth)

  const failedIndices = useMemo(() => {
    return bandwidth.map((v) => v === null)
  }, [bandwidth])

  const data = useMemo<uPlot.AlignedData>(() => {
    if (processedData.time.length === 0) {
      return [[], []]
    }
    return [processedData.time, processedData.bandwidth]
  }, [processedData.time, processedData.bandwidth])

  const series = useMemo<uPlot.Series[]>(() => {
    return [
      {
        label: 'Bandwidth',
        stroke: CHART_COLORS.bandwidth,
        width: 2,
        spanGaps: false
      }
    ]
  }, [])

  const handleWidthChange = useCallback((width: number) => {
    setPlotWidth(width)
  }, [])

  return (
    <BaseChart
      title="Bandwidth (MHz)"
      yLabel="MHz"
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