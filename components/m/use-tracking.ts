'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { mcall, type TrackingState } from '@/lib/m/api'

const QUEUE_KEY = 'm_track_queue'
const QUEUE_MAX = 500

interface QueuedPoint {
  latitude: number
  longitude: number
  accuracy: number
  taken: number // phone ms; sent as an age so a wrong phone clock can't misplace it
}

function readQueue(): QueuedPoint[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    return Array.isArray(q) ? q : []
  } catch {
    return []
  }
}

function writeQueue(q: QueuedPoint[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)))
  } catch {
    /* storage full / private mode: points are sent live only */
  }
}

/**
 * Sends a GPS point every `tracking_interval` minutes while the session is open
 * (last punch = IN) and the screen is on. Points taken offline wait in
 * localStorage and go up with the next send. A web app can't run in the
 * background, so tracking pauses while the app is closed.
 */
export function useTracking(state: TrackingState | undefined, onState: (s: TrackingState) => void) {
  const active = !!state?.active
  const intervalMs = Math.max(1, state?.tracking_interval || 5) * 60000
  const [lastSent, setLastSent] = useState<number | null>(null)
  const [pending, setPending] = useState(0)
  const sending = useRef(false)
  const onStateRef = useRef(onState)
  onStateRef.current = onState

  const flush = useCallback(async () => {
    if (sending.current) return
    const q = readQueue()
    setPending(q.length)
    if (!q.length || !navigator.onLine) return
    sending.current = true
    try {
      const now = Date.now()
      const r = await mcall<{ ok: boolean; stored: number; tracking: TrackingState }>('track', {
        points: JSON.stringify(
          q.map((p) => ({ latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, age_s: Math.round((now - p.taken) / 1000) })),
        ),
      })
      // drop exactly what was sent; anything queued meanwhile stays
      writeQueue(readQueue().filter((p) => p.taken > q[q.length - 1].taken))
      setPending(readQueue().length)
      setLastSent(Date.now())
      if (r?.tracking) onStateRef.current(r.tracking)
    } catch {
      /* keep the queue; retried on the next tick / when back online */
    } finally {
      sending.current = false
    }
  }, [])

  const capture = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        writeQueue([
          ...readQueue(),
          { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), taken: Date.now() },
        ])
        flush()
      },
      () => flush(),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    )
  }, [flush])

  useEffect(() => {
    if (!active) {
      // session closed: send whatever was taken before the check-out
      if (readQueue().length) flush()
      return
    }
    capture()
    const t = setInterval(capture, intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && capture()
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, intervalMs, capture, flush])

  return { lastSent, pending }
}
