import { useMemo, useState, useCallback } from 'react'
import uPlot from 'uplot'
import BaseChart from './BaseChart'
import { useMonitorStore } from '../../stores/monitor-store'
import { useMonitorData } from '../../hooks/useMonitorData'
import { CHART_COLORS } from '@shared/constants'

export default function SignalChart() {
  const [plotWidth, setPlotWidth] = useState(800)

  const timestamps = useMonitorStore((s) => s.timestamps)
  const signal = useMonitorStore((s) => s.signal)

  const processedData = useMonitorData(plotWidth)

  const failedIndices = useMemo(() => {
    return signal.map((v) => v === null)
  }, [signal])

  const data = useMemo<uPlot.AlignedData>(() => {
    if (processedData.time.length === 0) {
      return [[], []]
    }
    return [processedData.time, processedData.signal]
  }, [processedData.time, processedData.signal])

  const series = useMemo<uPlot.Series[]>(() => {
    return [
      {
        label: 'Signal',
        stroke: CHART_COLORS.signal,
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
      title="Signal (dBm)"
      yLabel="dBm"
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