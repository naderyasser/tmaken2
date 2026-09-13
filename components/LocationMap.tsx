"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix for default marker icon in leaflet with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

// ==================== Types ====================

export interface LocationPoint {
  name?: string
  log_datetime: string
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
}

export interface EmployeeTrack {
  employeeId: string
  employeeName: string
  color: string
  checkinStatus?: "IN" | "OUT" | "NONE"
  lastCheckinTime?: string | null
  locations: LocationPoint[]
}

interface LocationMapProps {
  /** Single employee locations */
  locations?: LocationPoint[]
  /** Multiple employees with their tracks */
  employeeTracks?: EmployeeTrack[]
  /** Whether we're in real-time tracking mode */
  isLive?: boolean
  /** Whether to show polyline path */
  showPath?: boolean
  /** Whether to auto-center on latest position */
  autoCenter?: boolean
  /** Map height */
  height?: string
}

// ==================== Pulsing Icon ====================

const createPulsingIcon = (color: string = "#3b82f6") =>
  L.divIcon({
    className: "pulsing-marker-wrapper",
    html: `
      <div class="loc-pulse-container">
        <div class="loc-pulse-dot" style="background:${color};"></div>
        <div class="loc-pulse-ring" style="border-color:${color};"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const createStartIcon = () =>
  L.divIcon({
    className: "start-marker-wrapper",
    html: `<div class="loc-start-dot"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

// ==================== Main Component ====================

export default function LocationMap({
  locations = [],
  employeeTracks,
  isLive = false,
  showPath = true,
  autoCenter = true,
  height = "500px",
}: LocationMapProps) {
  const defaultCenter: [number, number] = [24.7136, 46.6753] // Riyadh
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const hasUserInteractedRef = useRef(false)
  const hasAppliedInitialViewRef = useRef(false)
  const isProgrammaticMoveRef = useRef(false)

  // Determine the initial center and bounds
  const { center, bounds } = useMemo(() => {
    // Multi-employee mode
    if (employeeTracks && employeeTracks.length > 0) {
      const allPoints: [number, number][] = []
      employeeTracks.forEach((t) =>
        t.locations.forEach((l) => allPoints.push([l.latitude, l.longitude]))
      )
      if (allPoints.length > 0) {
        return {
          center: null,
          bounds: L.latLngBounds(
            allPoints.map((p) => L.latLng(p[0], p[1]))
          ),
        }
      }
    }

    // Single employee mode
    if (locations.length > 0) {
      const last = locations[locations.length - 1]
      return {
        center: [last.latitude, last.longitude] as [number, number],
        bounds: locations.length > 1
          ? L.latLngBounds(
              locations.map((l) => L.latLng(l.latitude, l.longitude))
            )
          : null,
      }
    }

    return { center: defaultCenter, bounds: null }
  }, [locations, employeeTracks])

  // Auto-center on latest point for real-time
  const liveCenter = useMemo<[number, number] | null>(() => {
    if (!isLive || !autoCenter) return null
    if (locations.length > 0) {
      const last = locations[locations.length - 1]
      return [last.latitude, last.longitude]
    }
    return null
  }, [isLive, autoCenter, locations])

  const isMulti = employeeTracks && employeeTracks.length > 0
  const clearStaleLeafletId = useCallback((element: HTMLElement | null) => {
    if (!element) return
    const el = element as any
    if (el._leaflet_id) {
      try {
        delete el._leaflet_id
      } catch {
        el._leaflet_id = undefined
      }
    }
  }, [])

  const runProgrammaticMove = useCallback((map: L.Map, action: () => void) => {
    isProgrammaticMoveRef.current = true
    const resetFlag = () => {
      isProgrammaticMoveRef.current = false
    }

    map.once("moveend", resetFlag)
    map.once("zoomend", resetFlag)
    action()
    window.setTimeout(resetFlag, 1200)
  }, [center, defaultCenter, locations.length, clearStaleLeafletId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    clearStaleLeafletId(containerRef.current)

    const initialZoom = locations.length > 0 ? 15 : 6
    const map = L.map(containerRef.current, {
      center: center || defaultCenter,
      zoom: initialZoom,
      scrollWheelZoom: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const group = L.layerGroup().addTo(map)

    const markUserInteraction = () => {
      if (!isProgrammaticMoveRef.current) {
        hasUserInteractedRef.current = true
      }
    }

    map.on("dragstart", markUserInteraction)
    map.on("zoomstart", markUserInteraction)

    mapRef.current = map
    layersRef.current = group

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.off("dragstart", markUserInteraction)
          mapRef.current.off("zoomstart", markUserInteraction)
          const container = mapRef.current.getContainer()
          mapRef.current.remove()
          clearStaleLeafletId(container)
        } catch {
          // ignore cleanup errors
        }
        mapRef.current = null
        layersRef.current = null
      }

      hasUserInteractedRef.current = false
      hasAppliedInitialViewRef.current = false
      isProgrammaticMoveRef.current = false

      clearStaleLeafletId(containerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return

    const map = mapRef.current
    const group = layersRef.current
    group.clearLayers()

    if (isMulti) {
      ;(employeeTracks || []).forEach((track) => {
        if (!track.locations.length) return

        const pathCoords: [number, number][] = track.locations.map((l) => [
          l.latitude,
          l.longitude,
        ])
        const lastLoc = track.locations[track.locations.length - 1]
        const checkinLabel =
          track.checkinStatus === "IN"
            ? "داخل الشفت"
            : track.checkinStatus === "OUT"
              ? "خارج الشفت"
              : "غير محدد"
        const checkinColor =
          track.checkinStatus === "IN"
            ? "#10b981"
            : track.checkinStatus === "OUT"
              ? "#64748b"
              : "#9ca3af"

        if (pathCoords.length > 1) {
          L.polyline(pathCoords, {
            color: track.color,
            weight: 3,
            opacity: 0.7,
          }).addTo(group)
        }

        L.circleMarker([lastLoc.latitude, lastLoc.longitude], {
          radius: 10,
          fillColor: track.color,
          color: checkinColor,
          weight: 2,
          fillOpacity: 0.9,
        })
          .bindPopup(`
            <div style="direction: rtl; text-align: right; min-width: 180px;">
              <p style="font-weight: bold; margin-bottom: 4px; color: ${track.color};">${track.employeeName}</p>
              <p style="font-size: 12px; color: ${checkinColor};">${track.checkinStatus === "IN" ? "🟢" : track.checkinStatus === "OUT" ? "⚪" : "⚫"} ${checkinLabel}</p>
              <p style="font-size: 12px; color: #4b5563;">⏰ ${new Date(lastLoc.log_datetime).toLocaleTimeString("ar-EG")}</p>
              ${track.lastCheckinTime ? `<p style="font-size: 12px; color: #6b7280;">⏱ آخر Checkin: ${new Date(track.lastCheckinTime).toLocaleTimeString("ar-EG")}</p>` : ""}
              <p style="font-size: 12px; color: #6b7280;">📍 ${track.locations.length} نقطة تتبع</p>
              ${lastLoc.address ? `<p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${lastLoc.address}</p>` : ""}
            </div>
          `)
          .addTo(group)
      })
    } else if (locations.length > 0) {
      const lastLocation = locations[locations.length - 1]
      const firstLocation = locations[0]
      const pathCoords: [number, number][] = locations.map((l) => [
        l.latitude,
        l.longitude,
      ])

      if (showPath && pathCoords.length > 1) {
        L.polyline(pathCoords, {
          color: "#3b82f6",
          weight: 3,
          opacity: 0.7,
          dashArray: isLive ? undefined : "8 4",
        }).addTo(group)
      }

      if (locations.length > 1) {
        L.marker([firstLocation.latitude, firstLocation.longitude], {
          icon: createStartIcon(),
        })
          .bindPopup(`
            <div style="direction: rtl; text-align: right; min-width: 180px;">
              <p style="font-weight: bold; color: #15803d; margin-bottom: 4px;">🟢 نقطة البداية</p>
              <p style="font-size: 12px; color: #4b5563;">⏰ ${new Date(firstLocation.log_datetime).toLocaleTimeString("ar-EG")}</p>
              ${firstLocation.address ? `<p style="font-size: 12px; color: #6b7280; margin-top: 4px;">📍 ${firstLocation.address}</p>` : ""}
            </div>
          `)
          .addTo(group)
      }

      L.marker([lastLocation.latitude, lastLocation.longitude], {
        icon: createPulsingIcon(isLive ? "#ef4444" : "#3b82f6"),
      })
        .bindPopup(`
          <div style="direction: rtl; text-align: right; min-width: 200px;">
            <p style="font-weight: bold; margin-bottom: 4px;">${isLive ? "🔴 الموقع الحالي" : "📍 آخر موقع"}</p>
            <p style="font-size: 12px; color: #4b5563;">⏰ ${new Date(lastLocation.log_datetime).toLocaleTimeString("ar-EG")}</p>
            ${lastLocation.address ? `<p style="font-size: 12px; color: #6b7280; margin-top: 4px;">📍 ${lastLocation.address}</p>` : ""}
            ${lastLocation.accuracy ? `<p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">🎯 الدقة: ${lastLocation.accuracy.toFixed(0)}م</p>` : ""}
          </div>
        `)
        .addTo(group)

      locations.slice(1, -1).forEach((loc) => {
        L.circleMarker([loc.latitude, loc.longitude], {
          radius: 4,
          fillColor: "#3b82f6",
          color: "#fff",
          weight: 1,
          fillOpacity: 0.6,
        })
          .bindPopup(`
            <div style="direction: rtl; text-align: right; font-size: 12px;">
              <p>⏰ ${new Date(loc.log_datetime).toLocaleTimeString("ar-EG")}</p>
              ${loc.address ? `<p>📍 ${loc.address}</p>` : ""}
            </div>
          `)
          .addTo(group)
      })
    }

    // Keep user zoom/position after manual interaction.
    // Auto-position only on first render, or in live mode when autoCenter is enabled.
    if (!hasAppliedInitialViewRef.current) {
      if (bounds && !isLive) {
        runProgrammaticMove(map, () => {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
        })
      } else if (liveCenter) {
        runProgrammaticMove(map, () => {
          map.flyTo(liveCenter, Math.max(map.getZoom(), 15), { duration: 1 })
        })
      } else if (center) {
        runProgrammaticMove(map, () => {
          map.setView(center, Math.max(map.getZoom(), 15))
        })
      }
      hasAppliedInitialViewRef.current = true
      return
    }

    if (isLive && autoCenter && liveCenter) {
      runProgrammaticMove(map, () => {
        map.flyTo(liveCenter, Math.max(map.getZoom(), 15), { duration: 1 })
      })
      return
    }

    if (!hasUserInteractedRef.current) {
      if (bounds && !isLive) {
        runProgrammaticMove(map, () => {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
        })
      } else if (center && !isLive) {
        runProgrammaticMove(map, () => {
          map.setView(center, Math.max(map.getZoom(), 15))
        })
      }
    }
  }, [
    isMulti,
    employeeTracks,
    locations,
    showPath,
    isLive,
    autoCenter,
    bounds,
    liveCenter,
    center,
    runProgrammaticMove,
  ])

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden">
      {/* CSS for pulsing markers */}
      <style>{`
        .pulsing-marker-wrapper { background: none !important; border: none !important; }
        .start-marker-wrapper { background: none !important; border: none !important; }
        .loc-pulse-container {
          position: relative; width: 24px; height: 24px;
        }
        .loc-pulse-dot {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 12px; height: 12px; border-radius: 50%;
          z-index: 2; box-shadow: 0 0 6px rgba(0,0,0,0.3);
        }
        .loc-pulse-ring {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 24px; height: 24px; border-radius: 50%;
          border: 2px solid; opacity: 0.6;
          animation: locPulse 2s infinite;
        }
        @keyframes locPulse {
          0% { width: 24px; height: 24px; opacity: 0.6; }
          100% { width: 48px; height: 48px; opacity: 0; }
        }
        .loc-start-dot {
          width: 14px; height: 14px; border-radius: 50%;
          background: #22c55e; border: 2px solid #fff;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
      `}</style>

      <div ref={containerRef} className="h-full w-full" />

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-3 right-3 z-[1000] bg-red-500 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          مباشر
        </div>
      )}
    </div>
  )
}
