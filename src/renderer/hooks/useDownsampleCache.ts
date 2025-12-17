import { useRef, useCallback } from 'react'

interface DownsampleCacheEntry {
  key: string
  histEndTime: number
  histTime: number[]
  histData: Map<string, (number | null)[]>
}

export function useDownsampleCache() {
  const cacheRef = useRef<DownsampleCacheEntry | null>(null)

  const getCacheKey = useCallback(
    (
      step: number,
      tailPoints: number,
      maxPoints: number,
      plotWidth: number,
      t0: number,
      dt: number
    ): string => {
      return `${step}-${tailPoints}-${maxPoints}-${plotWidth}-${t0.toFixed(3)}-${dt.toFixed(6)}`
    },
    []
  )

  const getCache = useCallback(() => cacheRef.current, [])

  const setCache = useCallback((entry: DownsampleCacheEntry) => {
    cacheRef.current = entry
  }, [])

  const invalidateCache = useCallback(() => {
    cacheRef.current = null
  }, [])

  return { getCacheKey, getCache, setCache, invalidateCache }
}