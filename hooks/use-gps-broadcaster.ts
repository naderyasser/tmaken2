"use client"

import { useEffect, useRef, useCallback } from "react"
import { frappeClient } from "@/lib/api-client"

interface GPSBroadcasterOptions {
  /** The Sales Person name (doctype name) */
  salesPerson: string | null
  /** Whether broadcasting is enabled (default: true) */
  enabled?: boolean
  /** Interval in milliseconds between location pings (default: 60000 = 1 min) */
  intervalMs?: number
}

/**
 * Hook that periodically sends the device's GPS location to the backend
 * so the manager dashboard can track sales rep positions in real time.
 *
 * It updates the Sales Person document fields:
 *   current_location_lat, current_location_lng, location_last_updated
 */
export function useGPSBroadcaster({
  salesPerson,
  enabled = true,
  intervalMs = 60_000,
}: GPSBroadcasterOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSent = useRef<{ lat: number; lng: number; t: number } | null>(null)

  /**
   * Presence heartbeat — independent of GPS so a rep whose device denies
   * location (or has no GPS fix) still shows as "online" on the admin
   * dashboard while the app is open. Server keeps a short-TTL last-seen key.
   */
  const sendHeartbeat = useCallback(async () => {
    if (!salesPerson) return
    try {
      await frappeClient.call(
        "erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.rep_heartbeat",
        { sales_person: salesPerson }
      )
    } catch {
      // ignore — presence is best-effort
    }
  }, [salesPerson])

  const broadcastLocation = useCallback(async () => {
    if (!salesPerson || typeof window === "undefined" || !navigator.geolocation) return

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 30_000,
        })
      })

      const { latitude, longitude } = pos.coords

      // Skip if position hasn't changed significantly (< 10m) and was sent recently (< 30s)
      if (lastSent.current) {
        const dist = haversineMeters(lastSent.current.lat, lastSent.current.lng, latitude, longitude)
        if (dist < 10 && Date.now() - lastSent.current.t < 30_000) return
      }

      // Whitelisted page method — writes with ignore_permissions, so it works for a
      // plain Sales User (a direct PUT on Sales Person needs write perms only
      // Sales Master Manager / System Manager hold).
      try {
        await frappeClient.call(
          "erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.update_sales_person_location",
          { sales_person: salesPerson, latitude, longitude }
        )
      } catch {
        // Fallback: update Sales Person document directly (managers/admins only)
        try {
          await frappeClient.put("Sales Person", salesPerson, {
            current_location_lat: String(latitude),
            current_location_lng: String(longitude),
            location_last_updated: new Date().toISOString().replace("T", " ").split(".")[0],
          })
        } catch (err) {
          console.warn("[GPS] Failed to broadcast location:", err)
          return
        }
      }

      lastSent.current = { lat: latitude, lng: longitude, t: Date.now() }
    } catch {
      // Silently ignore GPS errors (user denied, timeout, etc.)
    }
  }, [salesPerson])

  useEffect(() => {
    if (!enabled || !salesPerson) return

    // Send initial presence + position right away
    sendHeartbeat()
    broadcastLocation()

    // Then repeat at the given interval
    intervalRef.current = setInterval(() => {
      sendHeartbeat()
      broadcastLocation()
    }, intervalMs)

    // Re-announce as soon as the PWA returns to the foreground
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat()
        broadcastLocation()
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled, salesPerson, intervalMs, broadcastLocation, sendHeartbeat])

  return { broadcastLocation }
}

/** Quick haversine for small distances (returns meters). */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
