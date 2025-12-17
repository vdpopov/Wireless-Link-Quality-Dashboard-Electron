/**
 * Renderer-specific constants
 */

// uPlot default options
export const UPLOT_DEFAULTS = {
  padding: [10, 10, 0, 0] as [number, number, number, number],
  cursor: {
    show: true,
    x: true,
    y: false,
    drag: { x: false, y: false }
  },
  legend: {
    show: false
  },
  scales: {
    x: { time: true }
  }
}

// Chart heights (as percentages)
export const CHART_HEIGHTS = {
  signal: 0.22,
  ping: 0.22,
  rate: 0.22,
  bandwidth: 0.22
}

// Axis formatting
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function formatTimeWithDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}