import { useCallback, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settings-store'

export interface SelectionState {
  isSelecting: boolean
  startX: number | null
  currentX: number | null
  startTime: number | null
  currentTime: number | null
}

export interface UseChartSelectionReturn {
  selection: SelectionState
  handlers: {
    onMouseDown: (e: React.MouseEvent, timeAtX: (x: number) => number | null) => void
    onMouseMove: (e: React.MouseEvent, timeAtX: (x: number) => number | null) => void
    onMouseUp: () => void
    onMouseLeave: () => void
    onDoubleClick: () => void
  }
}

/**
 * Hook for handling chart drag-to-zoom selection
 */
export function useChartSelection(): UseChartSelectionReturn {
  const setZoom = useSettingsStore((s) => s.setZoom)
  const resetZoom = useSettingsStore((s) => s.resetZoom)

  const [selection, setSelection] = useState<SelectionState>({
    isSelecting: false,
    startX: null,
    currentX: null,
    startTime: null,
    currentTime: null
  })

  const selectionRef = useRef(selection)
  selectionRef.current = selection

  const onMouseDown = useCallback(
    (e: React.MouseEvent, timeAtX: (x: number) => number | null) => {
      if (e.button !== 0) return // Left click only

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = timeAtX(x)

      if (time !== null) {
        setSelection({
          isSelecting: true,
          startX: x,
          currentX: x,
          startTime: time,
          currentTime: time
        })
      }
    },
    []
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent, timeAtX: (x: number) => number | null) => {
      if (!selectionRef.current.isSelecting) return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = timeAtX(x)

      if (time !== null) {
        setSelection((prev) => ({
          ...prev,
          currentX: x,
          currentTime: time
        }))
      }
    },
    []
  )

  const onMouseUp = useCallback(() => {
    const { isSelecting, startTime, currentTime } = selectionRef.current

    if (isSelecting && startTime !== null && currentTime !== null) {
      const minTime = Math.min(startTime, currentTime)
      const maxTime = Math.max(startTime, currentTime)

      if (maxTime - minTime > 0.5) {
        setZoom(minTime, maxTime)
      }
    }

    setSelection({
      isSelecting: false,
      startX: null,
      currentX: null,
      startTime: null,
      currentTime: null
    })
  }, [setZoom])

  const onMouseLeave = useCallback(() => {
    if (selectionRef.current.isSelecting) {
      setSelection({
        isSelecting: false,
        startX: null,
        currentX: null,
        startTime: null,
        currentTime: null
      })
    }
  }, [])

  const onDoubleClick = useCallback(() => {
    resetZoom()
  }, [resetZoom])

  return {
    selection,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onDoubleClick
    }
  }
}