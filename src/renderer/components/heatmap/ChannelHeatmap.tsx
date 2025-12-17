import { useState, useMemo, useCallback } from 'react'
import { useHeatmap } from '../../hooks/useHeatmap'
import { HEATMAP_DAYS_OPTIONS } from '@shared/constants'

// Color scale: gray (no data) -> green (clear) -> yellow -> orange -> red (congested)
const HEATMAP_COLORS = [
  { threshold: -1, color: 'rgb(77, 77, 77)' }, // No data (gray)
  { threshold: 0, color: 'rgb(0, 192, 0)' }, // Clear (green)
  { threshold: 2, color: 'rgb(128, 217, 0)' }, // Light green
  { threshold: 4, color: 'rgb(230, 230, 0)' }, // Yellow
  { threshold: 6, color: 'rgb(255, 128, 0)' }, // Orange
  { threshold: 8, color: 'rgb(255, 0, 0)' } // Congested (red)
]

function getColorForValue(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return HEATMAP_COLORS[0].color // Gray for no data
  }

  for (let i = HEATMAP_COLORS.length - 1; i >= 0; i--) {
    if (value >= HEATMAP_COLORS[i].threshold) {
      return HEATMAP_COLORS[i].color
    }
  }

  return HEATMAP_COLORS[1].color // Default to green
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  content: string
}

export default function ChannelHeatmap() {
  const { data, details, loading, error, setDays, days } = useHeatmap()

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: ''
  })

  // Handle cell hover
  const handleCellHover = useCallback(
    (
      e: React.MouseEvent,
      dateStr: string,
      channel: number,
      value: number | null
    ) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top

      // Build tooltip content
      const dateDisplay = formatDate(dateStr)
      let content = `Ch ${channel} | ${dateDisplay}\n`

      if (value === null || Number.isNaN(value)) {
        content += 'No scan data'
      } else {
        const networks = details[dateStr]?.[channel] || []
        if (networks.length > 0) {
          content += `${networks.length} networks\n`
          const displayNetworks = networks.slice(0, 8)
          content += displayNetworks.map((n) => `  ${n}`).join('\n')
          if (networks.length > 8) {
            content += `\n  +${networks.length - 8} more`
          }
        } else {
          content += 'Clear (no networks)'
        }
      }

      setTooltip({ visible: true, x, y, content })
    },
    [details]
  )

  const handleCellLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }, [])

  // Memoize grid rendering with dates sorted descending
  const grid = useMemo(() => {
    if (!data) return null

    const { data: heatmapData, dates, channels } = data

    // Create array of date indices sorted by date descending
    const sortedDateIndices = dates
      .map((date, idx) => ({ date, idx }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return (
      <div className="flex flex-col gap-0.5 h-full">
        {/* Header row - channels */}
        <div className="flex gap-0.5 ml-16">
          {channels.map((ch) => (
            <div
              key={ch}
              className="flex-1 min-w-8 h-6 flex items-center justify-center text-xs text-gray-400"
            >
              {ch}
            </div>
          ))}
        </div>

        {/* Data rows - sorted by date descending */}
        {sortedDateIndices.map(({ date: dateStr, idx: rowIdx }) => (
          <div key={dateStr} className="flex gap-0.5 items-center flex-1 min-h-6">
            {/* Date label */}
            <div className="w-16 text-xs text-gray-400 text-right pr-2 shrink-0">
              {formatDate(dateStr)}
            </div>

            {/* Cells */}
            {channels.map((channel, colIdx) => {
              const value = heatmapData[rowIdx]?.[colIdx] ?? null
              const color = getColorForValue(value)

              return (
                <div
                  key={channel}
                  className="flex-1 min-w-8 h-full rounded-sm heatmap-cell cursor-pointer"
                  style={{ backgroundColor: color }}
                  onMouseEnter={(e) => handleCellHover(e, dateStr, channel, value)}
                  onMouseLeave={handleCellLeave}
                />
              )
            })}
          </div>
        ))}
      </div>
    )
  }, [data, handleCellHover, handleCellLeave])

  return (
    <div className="h-full flex flex-col bg-surface-light rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">
            Channel Congestion
            {data && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({data.band === '5' ? '5GHz' : '2.4GHz'})
              </span>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Days:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="select"
          >
            {HEATMAP_DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Loading...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-gray-400">{error}</p>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-gray-400">No scan data available</p>
          </div>
        ) : (
          <div className="h-full">{grid}</div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 text-xs rounded shadow-lg bg-yellow-100 text-gray-900 border border-yellow-300 whitespace-pre-line max-w-xs"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%) translateY(-8px)'
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}