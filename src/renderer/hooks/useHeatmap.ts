import { useEffect, useState, useCallback, useRef } from 'react'
import type { HeatmapData, ScanResult } from '@shared/types'

interface HeatmapState {
  data: HeatmapData | null
  details: Record<string, Record<number, string[]>>
  loading: boolean
  error: string | null
  lastScanTime: string | null
  scanStatus: string | null
}

interface UseHeatmapReturn extends HeatmapState {
  refresh: () => Promise<void>
  scan: () => Promise<void>
  setDays: (days: number) => void
  days: number
}

export function useHeatmap(): UseHeatmapReturn {
  const [days, setDays] = useState(7)
  const [state, setState] = useState<HeatmapState>({
    data: null,
    details: {},
    loading: true,
    error: null,
    lastScanTime: null,
    scanStatus: null
  })

  // Use refs to avoid stale closures in event listeners
  const daysRef = useRef(days)
  daysRef.current = days

  // Track if component is mounted
  const mountedRef = useRef(true)

  // Fetch heatmap data - stable function using ref
  const refresh = useCallback(async () => {
    if (!mountedRef.current) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const currentDays = daysRef.current
      const data = await window.api.getHeatmapData(currentDays)

      if (!mountedRef.current) return

      if (!data) {
        setState((prev) => ({
          ...prev,
          data: null,
          details: {},
          loading: false,
          error: 'No data available'
        }))
        return
      }

      const details = await window.api.getHeatmapDetails(currentDays, data.band)

      if (!mountedRef.current) return

      setState((prev) => ({
        ...prev,
        data,
        details,
        loading: false,
        error: null
      }))
    } catch (err) {
      if (!mountedRef.current) return
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load heatmap data'
      }))
    }
  }, []) // Empty deps - uses refs

  // Trigger a new scan
  const scan = useCallback(async () => {
    setState((prev) => ({ ...prev, scanStatus: 'Scanning...' }))

    try {
      const success = await window.api.startScan()

      if (success) {
        setState((prev) => ({
          ...prev,
          scanStatus: 'Scan complete',
          lastScanTime: new Date().toLocaleTimeString()
        }))
        await refresh()
      } else {
        setState((prev) => ({ ...prev, scanStatus: 'Scan failed' }))
      }
    } catch {
      setState((prev) => ({ ...prev, scanStatus: 'Scan error' }))
    }

    setTimeout(() => {
      setState((prev) => ({ ...prev, scanStatus: null }))
    }, 3000)
  }, [refresh])

  // Refresh when days changes
  useEffect(() => {
    refresh()
  }, [days, refresh])

  // Event listeners - only set up once
  useEffect(() => {
    mountedRef.current = true

    const unsubComplete = window.api.onScanComplete((result: ScanResult) => {
      if (!mountedRef.current) return
      
      setState((prev) => ({
        ...prev,
        lastScanTime: new Date(result.timestamp).toLocaleTimeString()
      }))
      refresh()
    })

    const unsubProgress = window.api.onScanProgress((message: string) => {
      if (!mountedRef.current) return
      setState((prev) => ({ ...prev, scanStatus: message }))
    })

    return () => {
      mountedRef.current = false
      unsubComplete()
      unsubProgress()
    }
  }, [refresh]) // refresh is now stable

  // Auto-scan - only run once on mount
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    const checkAutoScan = async () => {
      const currentState = await window.api.getHeatmapData(daysRef.current)
      if (!currentState && mountedRef.current) {
        scan()
      }
    }

    timer = setTimeout(checkAutoScan, 2000)
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [scan])

  return {
    ...state,
    refresh,
    scan,
    setDays,
    days
  }
}