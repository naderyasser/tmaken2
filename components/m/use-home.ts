'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { errorText, isSessionError, mcall, type HomeData } from '@/lib/m/api'

export function toLogin() {
  const here = window.location.pathname + window.location.search
  window.location.replace(`/m/login?redirect=${encodeURIComponent(here)}`)
}

/** get_home with session handling: no session → /m/login; business errors are shown. */
export function useHome() {
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await mcall<HomeData>('get_home')
      setData(d)
      setError('')
    } catch (e) {
      if (isSessionError(e)) return toLogin()
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  return { data, error, loading, reload: load }
}

export interface GeoFix {
  latitude: number
  longitude: number
  accuracy: number
  at: number
}

export type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable' | 'unsupported'

/** Live GPS while the screen is open (high accuracy). */
export function useGeoWatch(enabled: boolean) {
  const [fix, setFix] = useState<GeoFix | null>(null)
  const [status, setStatus] = useState<GeoStatus>('idle')
  const watchId = useRef<number | null>(null)

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported')
      return
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    setStatus((s) => (s === 'ok' ? s : 'locating'))
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setFix({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: Date.now() })
        setStatus('ok')
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied')
        else setStatus((s) => (s === 'ok' ? s : 'unavailable'))
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
  }, [])

  useEffect(() => {
    if (!enabled) return
    start()
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [enabled, start])

  return { fix, status, retry: start }
}
