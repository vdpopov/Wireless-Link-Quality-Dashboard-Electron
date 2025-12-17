import { useMemo, useState, useCallback } from 'react'
import uPlot from 'uplot'
import BaseChart from './BaseChart'
import { useMonitorStore } from '../../stores/monitor-store'
import { useMonitorData } from '../../hooks/useMonitorData'
import { CHART_COLORS } from '@shared/constants'

export default function RateChart() {
  const [plotWidth, setPlotWidth] = useState(800)

  const timestamps = useMonitorStore((s) => s.timestamps)
  const rxRate = useMonitorStore((s) => s.rxRate)
  const txRate = useMonitorStore((s) => s.txRate)

  const processedData = useMonitorData(plotWidth)

  const failedIndices = useMemo(() => {
    return rxRate.map((rx, i) => rx === null && txRate[i] === null)
  }, [rxRate, txRate])

  const data = useMemo<uPlot.AlignedData>(() => {
    if (processedData.time.length === 0) {
      return [[], [], []]
    }
    return [processedData.time, processedData.rxRate, processedData.txRate]
  }, [processedData.time, processedData.rxRate, processedData.txRate])

  const series = useMemo<uPlot.Series[]>(() => {
    return [
      {
        label: 'RX',
        stroke: CHART_COLORS.rxRate,
        width: 2,
        spanGaps: false
      },
      {
        label: 'TX',
        stroke: CHART_COLORS.txRate,
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
      title="RX / TX (Mbps)"
      yLabel="Mbps"
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