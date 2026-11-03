/**
 * StopsRouteMap – A custom map specifically for the Rep Stops Tracker.
 * Shows the full GPS route with direction, numbered stop circles with durations,
 * start/end markers, and optional customer labels.
 */

'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { displayLocale } from '@/lib/sales-format'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// ==================== Types ====================

export interface RoutePoint {
  log_datetime: string
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
}

export interface StopMarker {
  index: number
  center_lat: number
  center_lng: number
  arrival: string
  departure: string
  duration_minutes: number
  points_count: number
  customer_name: string | null
  distance_to_customer: number | null
}

interface StopsRouteMapProps {
  /** Full GPS route points */
  routePoints: RoutePoint[]
  /** Detected stops to overlay on the route */
  stops: StopMarker[]
  /** Map height */
  height?: string
  /** Show the route polyline */
  showRoute?: boolean
  /** Highlight a specific stop index */
  highlightedStop?: number | null
}

// ==================== Helpers ====================

function stopColor(stop: StopMarker): string {
  if (!stop.customer_name) return '#ef4444' // red – unknown
  return '#22c55e' // green – customer
}

function durationBgColor(minutes: number): string {
  if (minutes >= 60) return '#fecaca' // red-200
  if (minutes >= 30) return '#fed7aa' // orange-200
  if (minutes >= 10) return '#fef08a' // yellow-200
  return '#bbf7d0' // green-200
}

function durationTextColor(minutes: number): string {
  if (minutes >= 60) return '#991b1b'
  if (minutes >= 30) return '#9a3412'
  if (minutes >= 10) return '#854d0e'
  return '#166534'
}

// ==================== Custom Icons ====================

function createStopIcon(stop: StopMarker, durText: string): L.DivIcon {
  const num = stop.index + 1
  const bg = stopColor(stop)
  const durBg = durationBgColor(stop.duration_minutes)
  const durColor = durationTextColor(stop.duration_minutes)

  return L.divIcon({
    className: 'stop-marker-icon',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="
          width:32px; height:32px; border-radius:50%;
          background:${bg}; color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-weight:bold; font-size:14px;
          border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          z-index:2;
        ">${num}</div>
        <div style="
          margin-top:2px; padding:2px 6px;
          background:${durBg}; color:${durColor};
          font-size:11px; font-weight:700;
          border-radius:8px;
          white-space:nowrap;
          box-shadow:0 1px 3px rgba(0,0,0,0.2);
          z-index:2;
          direction:rtl;
        ">${durText}</div>
      </div>
    `,
    iconSize: [60, 52],
    iconAnchor: [30, 16],
    popupAnchor: [0, -20],
  })
}

function createStartFlag(label: string): L.DivIcon {
  return L.divIcon({
    className: 'start-flag-icon',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="
          width:30px; height:30px; border-radius:50%;
          background:#22c55e; color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:16px;
          border:3px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">🚀</div>
        <div style="
          margin-top:2px; padding:1px 6px;
          background:#dcfce7; color:#166534;
          font-size:10px; font-weight:700;
          border-radius:6px;
          white-space:nowrap;
        ">${label}</div>
      </div>
    `,
    iconSize: [50, 48],
    iconAnchor: [25, 15],
    popupAnchor: [0, -18],
  })
}

function createEndFlag(label: string): L.DivIcon {
  return L.divIcon({
    className: 'end-flag-icon',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="
          width:30px; height:30px; border-radius:50%;
          background:#ef4444; color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:16px;
          border:3px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">🏁</div>
        <div style="
          margin-top:2px; padding:1px 6px;
          background:#fecaca; color:#991b1b;
          font-size:10px; font-weight:700;
          border-radius:6px;
          white-space:nowrap;
        ">${label}</div>
      </div>
    `,
    iconSize: [50, 48],
    iconAnchor: [25, 15],
    popupAnchor: [0, -18],
  })
}

// Direction arrow icon placed along the route
function createArrowIcon(angleDeg: number): L.DivIcon {
  return L.divIcon({
    className: 'arrow-direction-icon',
    html: `<div style="
      width:16px; height:16px;
      display:flex; align-items:center; justify-content:center;
      transform:rotate(${angleDeg}deg);
      color:#3b82f6; font-size:14px;
      opacity:0.7;
      pointer-events:none;
    ">➤</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// ==================== Main Component ====================

export default function StopsRouteMap({
  routePoints,
  stops,
  height = '500px',
  showRoute = true,
  highlightedStop = null,
}: StopsRouteMapProps) {
  const { t, lang, dir } = useI18n()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)

  const defaultCenter: [number, number] = [24.7136, 46.6753]
  const dl = displayLocale(lang)
  const textAlign = dir === 'rtl' ? 'right' : 'left'

  const fmtTime = useCallback((datetime: string): string => {
    try {
      return new Date(datetime).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch { return datetime }
  }, [dl])

  const fmtDur = useCallback((minutes: number): string => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return h > 0
      ? `${h}${t('sr.admin.stops.hour_abbr')} ${m}${t('sr.admin.stops.min_abbr')}`
      : `${m}${t('sr.admin.stops.min_abbr')}`
  }, [t])

  const allPoints = useMemo(() => {
    if (routePoints.length > 0) return routePoints
    // fallback: create points from stops
    return stops.map(s => ({
      log_datetime: s.arrival,
      latitude: s.center_lat,
      longitude: s.center_lng,
    }))
  }, [routePoints, stops])

  const bounds = useMemo(() => {
    if (allPoints.length === 0) return null
    return L.latLngBounds(allPoints.map(p => L.latLng(p.latitude, p.longitude)))
  }, [allPoints])

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const el = containerRef.current as any
    if (el._leaflet_id) { try { delete el._leaflet_id } catch { el._leaflet_id = undefined } }

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 6,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const group = L.layerGroup().addTo(map)
    mapRef.current = map
    layersRef.current = group

    return () => {
      if (mapRef.current) {
        try {
          const container = mapRef.current.getContainer()
          mapRef.current.remove()
          const cel = container as any
          if (cel._leaflet_id) { try { delete cel._leaflet_id } catch { cel._leaflet_id = undefined } }
        } catch { /* ignore */ }
        mapRef.current = null
        layersRef.current = null
      }
    }
  }, [])

  // Draw layers whenever data changes
  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return
    const map = mapRef.current
    const group = layersRef.current
    group.clearLayers()

    if (allPoints.length === 0 && stops.length === 0) return

    // 1. Draw route polyline with gradient effect
    if (showRoute && routePoints.length > 1) {
      const coords: [number, number][] = routePoints.map(p => [p.latitude, p.longitude])

      // Main route line
      L.polyline(coords, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)

      // Lighter outline for depth
      L.polyline(coords, {
        color: '#93c5fd',
        weight: 7,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)

      // Direction arrows every ~15 points (or min 5 arrows)
      const step = Math.max(1, Math.floor(routePoints.length / Math.min(routePoints.length, 20)))
      for (let i = step; i < routePoints.length - 1; i += step) {
        const p1 = routePoints[i]
        const p2 = routePoints[Math.min(i + 1, routePoints.length - 1)]
        const angle = bearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude) - 90
        L.marker([p1.latitude, p1.longitude], {
          icon: createArrowIcon(angle),
          interactive: false,
        }).addTo(group)
      }

      // GPS dots along route (tiny)
      routePoints.forEach((pt, idx) => {
        if (idx === 0 || idx === routePoints.length - 1) return
        L.circleMarker([pt.latitude, pt.longitude], {
          radius: 2.5,
          fillColor: '#3b82f6',
          color: '#fff',
          weight: 1,
          fillOpacity: 0.4,
        }).addTo(group)
      })
    }

    // 2. Start marker
    if (allPoints.length > 0) {
      const first = allPoints[0]
      L.marker([first.latitude, first.longitude], { icon: createStartFlag(t('sr.admin.stopsmap.start')), zIndexOffset: 800 })
        .bindPopup(`
          <div style="direction:${dir}; text-align:${textAlign}; min-width:160px;">
            <p style="font-weight:bold; color:#16a34a; margin-bottom:4px;">🚀 ${t('sr.admin.stopsmap.start_point')}</p>
            <p style="font-size:12px;">⏰ ${fmtTime(first.log_datetime)}</p>
            ${first.address ? `<p style="font-size:11px; color:#6b7280;">📍 ${first.address}</p>` : ''}
          </div>
        `)
        .addTo(group)

      // End marker
      if (allPoints.length > 1) {
        const last = allPoints[allPoints.length - 1]
        L.marker([last.latitude, last.longitude], { icon: createEndFlag(t('sr.admin.stopsmap.end')), zIndexOffset: 800 })
          .bindPopup(`
            <div style="direction:${dir}; text-align:${textAlign}; min-width:160px;">
              <p style="font-weight:bold; color:#dc2626; margin-bottom:4px;">🏁 ${t('sr.admin.stopsmap.end_point')}</p>
              <p style="font-size:12px;">⏰ ${fmtTime(last.log_datetime)}</p>
              ${last.address ? `<p style="font-size:11px; color:#6b7280;">📍 ${last.address}</p>` : ''}
            </div>
          `)
          .addTo(group)
      }
    }

    // 3. Stop markers with numbered circles + duration labels
    stops.forEach((stop) => {
      const isHighlighted = highlightedStop === stop.index
      const marker = L.marker([stop.center_lat, stop.center_lng], {
        icon: createStopIcon(stop, fmtDur(stop.duration_minutes)),
        zIndexOffset: isHighlighted ? 1000 : 900,
      })

      // Stop circle area (semi-transparent)
      const circleColor = stopColor(stop)
      L.circle([stop.center_lat, stop.center_lng], {
        radius: 40,
        fillColor: circleColor,
        color: circleColor,
        fillOpacity: isHighlighted ? 0.25 : 0.1,
        weight: isHighlighted ? 2 : 1,
        dashArray: stop.customer_name ? undefined : '4 4',
      }).addTo(group)

      // Popup with detailed info
      const arrivalStr = fmtTime(stop.arrival)
      const departureStr = fmtTime(stop.departure)
      const durStr = fmtDur(stop.duration_minutes)
      const custHtml = stop.customer_name
        ? `<p style="font-size:13px; color:#16a34a; font-weight:bold;">🏪 ${stop.customer_name}</p>
           ${stop.distance_to_customer != null ? `<p style="font-size:11px; color:#6b7280;">📏 ${t('sr.admin.stopsmap.meters_from_customer').replace('{n}', String(stop.distance_to_customer))}</p>` : ''}`
        : `<p style="font-size:13px; color:#dc2626; font-weight:bold;">⚠️ ${t('sr.admin.stops.unknown_location')}</p>`

      marker.bindPopup(`
        <div style="direction:${dir}; text-align:${textAlign}; min-width:200px; line-height:1.6;">
          <p style="font-weight:bold; font-size:15px; color:#92400e; margin-bottom:6px;">
            ⏸ ${t('sr.admin.stopsmap.stop_n').replace('{n}', String(stop.index + 1))}
          </p>
          ${custHtml}
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:6px 0;" />
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px 8px; font-size:12px;">
            <span style="color:#6b7280;">🟢 ${t('sr.admin.stopsmap.arrival')}</span>
            <span style="font-weight:600;">${arrivalStr}</span>
            <span style="color:#6b7280;">🔴 ${t('sr.admin.stopsmap.departure')}</span>
            <span style="font-weight:600;">${departureStr}</span>
            <span style="color:#6b7280;">⏱ ${t('sr.admin.stopsmap.duration')}</span>
            <span style="font-weight:700; color:${durationTextColor(stop.duration_minutes)}; font-size:13px;">${durStr}</span>
          </div>
          <p style="font-size:11px; color:#9ca3af; margin-top:4px;">📡 ${t('sr.admin.stopsmap.gps_points').replace('{n}', String(stop.points_count))}</p>
        </div>
      `)
      marker.addTo(group)
    })

    // 4. Fit bounds
    if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 })
    }
  }, [allPoints, routePoints, stops, showRoute, highlightedStop, bounds, t, dir, textAlign, fmtTime, fmtDur])

  // Pan to highlighted stop
  useEffect(() => {
    if (highlightedStop == null || !mapRef.current) return
    const stop = stops.find(s => s.index === highlightedStop)
    if (stop) {
      mapRef.current.flyTo([stop.center_lat, stop.center_lng], 16, { duration: 0.5 })
    }
  }, [highlightedStop, stops])

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden border border-gray-200">
      {/* CSS */}
      <style>{`
        .stop-marker-icon, .start-flag-icon, .end-flag-icon, .arrow-direction-icon {
          background: none !important; border: none !important;
        }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg p-2.5 text-xs space-y-1" style={{ direction: dir }}>
        <div className="font-semibold text-gray-700 mb-1">{t('sr.admin.stopsmap.legend')}</div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow shrink-0" />
          <span className="text-gray-600">{t('sr.admin.stopsmap.legend_customer_stop')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow shrink-0" />
          <span className="text-gray-600">{t('sr.admin.stopsmap.legend_unknown_stop')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 bg-blue-500 shrink-0 rounded" />
          <span className="text-gray-600">{t('sr.admin.stopsmap.legend_route')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🚀</span>
          <span className="text-gray-600">{t('sr.admin.stopsmap.start')}</span>
          <span className="text-sm mr-2">🏁</span>
          <span className="text-gray-600">{t('sr.admin.stopsmap.end')}</span>
        </div>
      </div>
    </div>
  )
}
