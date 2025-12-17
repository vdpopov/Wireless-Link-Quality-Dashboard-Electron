import { useMemo, useCallback, useRef, useEffect, useLayoutEffect, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useChartSelection } from '../../hooks/useChartSelection'
import SelectionOverlay from '../overlays/SelectionOverlay'
import FailureRegions from '../overlays/FailureRegions'
import HoverOverlay from '../overlays/HoverOverlay'

export interface BaseChartProps {
  title: string
  yLabel: string
  data: uPlot.AlignedData
  series: uPlot.Series[]
  visibleRange: { start: number; end: number }
  failedIndices?: boolean[]
  timestamps?: number[]
  isDownsampled?: boolean
  onWidthChange?: (width: number) => void
}

export default function BaseChart({
  title,
  yLabel,
  data,
  series,
  visibleRange,
  failedIndices,
  timestamps,
  isDownsampled = false,
  onWidthChange
}: BaseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const seriesKeyRef = useRef<string>('')
  const visibleRangeRef = useRef(visibleRange)
  visibleRangeRef.current = visibleRange


  const { selection, handlers } = useChartSelection()
  const [chartGeneration, setChartGeneration] = useState(0)
  const [tooltip, setTooltip] = useState({
  x: 0,
  y: 0,
  content: '',
  visible: false
})

  // Create a stable key for series config to detect when we need to recreate
  const seriesKey = useMemo(() => {
    return series.map((s) => `${s.label}-${s.stroke}`).join('|')
  }, [series])

  // Build options - but don't include size (we'll handle that separately)
  const baseOptions = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(() => {
    return {
      padding: [10, 10, 0, 0],
      cursor: {
        show: true,
        x: true,
        y: false,
        drag: { x: false, y: false }
      },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: { auto: true }
      },
      axes: [
        {
          stroke: '#888',
          grid: { stroke: 'rgba(255,255,255,0.1)', width: 1 },
          ticks: { stroke: 'rgba(255,255,255,0.2)', width: 1 },
          values: (_, ticks) => {
            if (ticks.length === 0) return []
            const span = ticks[ticks.length - 1] - ticks[0]
            const useDate = span > 86400

            return ticks.map((t) => {
              const date = new Date(t * 1000)
              if (useDate) {
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })
              }
              return date.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
            })
          }
        },
        {
          stroke: '#888',
          grid: { stroke: 'rgba(255,255,255,0.1)', width: 1 },
          ticks: { stroke: 'rgba(255,255,255,0.2)', width: 1 },
          label: yLabel,
          labelSize: 14,
          labelGap: 0,
          size: 50
        }
      ],
      series: [{ label: 'Time' }, ...series]
    }
  }, [yLabel, series])

  const getValueAtTime = useCallback((time: number, seriesIdx: number): number | null => {
    const times = data[0]
    const values = data[seriesIdx]
    if (!times || !values || times.length === 0) return null

    // Find bracketing indices
    let i = 0
    while (i < times.length - 1 && times[i + 1] < time) i++

    if (i >= times.length - 1) return values[values.length - 1] ?? null
    if (time <= times[0]) return values[0] ?? null

    // Linear interpolation
    const t0 = times[i], t1 = times[i + 1]
    const v0 = values[i], v1 = values[i + 1]
    if (v0 == null || v1 == null) return v0 ?? v1

    const frac = (time - t0) / (t1 - t0)
    return v0 + frac * (v1 - v0)
  }, [data])


  // Create chart once on mount, recreate only when series config changes
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()

    // Skip if no size yet
    if (rect.width === 0 || rect.height === 0) return

    // Check if we need to recreate (series changed)
    if (chartRef.current && seriesKeyRef.current === seriesKey) {
      return // No need to recreate
    }

    // Destroy old chart
    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    // Clear container
    container.innerHTML = ''

    // Create new chart
    const chart = new uPlot(
      {
        ...baseOptions,
        width: rect.width,
        height: rect.height
      },
      data,
      container
    )

    chartRef.current = chart
    seriesKeyRef.current = seriesKey

    // Notify parent of initial width
    onWidthChange?.(rect.width)

    // Set initial scale
    chart.setScale('x', {
      min: visibleRange.start,
      max: visibleRange.end
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [baseOptions, seriesKey]) // Only recreate when options or series change

  // Handle resize - increment chartGeneration
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && chartRef.current) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          chartRef.current.setSize({ width, height })
          onWidthChange?.(width)
          // Only increment on resize
          setChartGeneration(g => g + 1)
        }
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [onWidthChange])


  useLayoutEffect(() => {
    if (!chartRef.current) return
    
    const u = chartRef.current
    
    // Guard: data columns must match chart's ACTUAL series count
    const chartSeriesCount = u.series.length
    if (data.length !== chartSeriesCount) {
      return
    }
    
    // Guard against undefined/empty arrays
    if (data.some(arr => !arr || arr.length === 0)) {
      return
    }
    
    u.batch(() => {
      u.setData(data)
      u.setScale('x', {
        min: visibleRange.start,
        max: visibleRange.end
      })
    })
  }, [data, visibleRange.start, visibleRange.end])




  const xAtTime = useCallback((timeSec: number): number | null => {
    const u = chartRef.current
    if (!u || !u.bbox || u.bbox.width === 0) return null
    
    const plotLeft = u.bbox.left / devicePixelRatio
    const plotWidth = u.bbox.width / devicePixelRatio
    
    // Use ref - always has latest value, but doesn't change callback identity
    const range = visibleRangeRef.current
    const fraction = (timeSec - range.start) / (range.end - range.start)
    const x = plotLeft + fraction * plotWidth
    
    if (fraction < 0 || fraction > 1) return null
    
    return x
  }, [])

  // Same for timeAtX
  const timeAtX = useCallback((x: number): number | null => {
    const u = chartRef.current
    if (!u || !u.bbox || u.bbox.width === 0) return null
    
    const plotLeft = u.bbox.left / devicePixelRatio
    const plotWidth = u.bbox.width / devicePixelRatio
    
    const fraction = (x - plotLeft) / plotWidth
    if (fraction < 0 || fraction > 1) return null
    
    const range = visibleRangeRef.current
    return range.start + fraction * (range.end - range.start)
  }, [])


  const handleMouseLeave = useCallback(() => {
    handlers.onMouseLeave()
    setTooltip(prev => ({ ...prev, visible: false }))
  }, [handlers])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => handlers.onMouseDown(e, timeAtX),
    [handlers, timeAtX]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handlers.onMouseMove(e, timeAtX)

      if (selection.isSelecting) {
        setTooltip(prev => ({ ...prev, visible: false }))
        return
      }

      const u = chartRef.current
      if (!u) return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Hide if outside plot area (over axes)
      const plotLeft = u.bbox.left / devicePixelRatio
      const plotTop = u.bbox.top / devicePixelRatio
      const plotWidth = u.bbox.width / devicePixelRatio
      const plotHeight = u.bbox.height / devicePixelRatio

      if (x < plotLeft || x > plotLeft + plotWidth || y < plotTop || y > plotTop + plotHeight) {
        setTooltip(prev => ({ ...prev, visible: false }))
        return
      }

      const time = timeAtX(x)

      if (time === null) {
        setTooltip(prev => ({ ...prev, visible: false }))
        return
      }

      // Hide if outside data range
      const times = data[0]
      if (!times || times.length === 0 || time < times[0] || time > times[times.length - 1]) {
        setTooltip(prev => ({ ...prev, visible: false }))
        return
      }

      // Get all series values
      const lines: string[] = []
      for (let i = 1; i < data.length; i++) {
        const value = getValueAtTime(time, i)
        if (value == null) continue
        const label = series[i - 1]?.label ?? 'Value'
        lines.push(`${label}: ${value.toFixed(2)}`)
      }

      if (lines.length === 0) {
        setTooltip(prev => ({ ...prev, visible: false }))
        return
      }

      const date = new Date(time * 1000)
      const content = `${date.toLocaleString()}\n${lines.join('\n')}`

      setTooltip({
        x: e.clientX,
        y: e.clientY,
        content,
        visible: true
      })
    },
    [handlers, timeAtX, selection.isSelecting, data, series, getValueAtTime]
  )



  // Point count for downsampling indicator
  const pointCount = data[0]?.length ?? 0

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Title - in its own row, not overlapping */}
      <div className="px-2 py-1 shrink-0">
        <span className="text-xs font-semibold text-gray-400">{title}</span>
      </div>

      {/* Chart area */}
      <div
        className="relative flex-1 min-h-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handlers.onMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handlers.onDoubleClick}
      >
        {/* uPlot container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Selection overlay */}
        {selection.isSelecting && selection.startX !== null && selection.currentX !== null && (
          <SelectionOverlay
            startX={Math.min(selection.startX, selection.currentX)}
            endX={Math.max(selection.startX, selection.currentX)}
          />
        )}

        {/* Failure regions - add chartGeneration */}
        {failedIndices && timestamps && timestamps.length > 0 && (
          <FailureRegions
            failedIndices={failedIndices}
            timestamps={timestamps}
            xAtTime={xAtTime}
            visibleRange={visibleRange}
          />
        )}

        <HoverOverlay {...tooltip} />
      </div>
    </div>
  )
}