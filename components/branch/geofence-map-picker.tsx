'use client'

/**
 * Map picker for a branch punch geofence — a draggable pin plus the radius circle
 * drawn to scale, so HR can *see* the area an employee has to stand in rather than
 * guessing what "100 m" covers.
 *
 * Client-only (leaflet touches `window`): import it with `next/dynamic({ssr:false})`.
 * Tiles come from OSM, the same source `components/LocationMap.tsx` already uses.
 */

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export interface GeofenceMapPickerProps {
  latitude: number
  longitude: number
  radiusM: number
  /** Fires on pin drag and on map click — the parent owns the coordinates. */
  onMove: (latitude: number, longitude: number) => void
  height?: string
}

/** A pin that doesn't depend on leaflet's default icon URLs (which 404 under a CSP). */
const pinIcon = L.divIcon({
  className: 'geofence-pin-wrapper',
  html: `<div style="
    width:18px;height:18px;border-radius:50% 50% 50% 0;
    background:hsl(var(--primary,171 78% 24%));
    border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
    transform:rotate(-45deg);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
})

export default function GeofenceMapPicker({
  latitude,
  longitude,
  radiusM,
  onMove,
  height = '320px',
}: GeofenceMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  // Keep the latest callback without making the init effect depend on it —
  // re-running init would tear the map down on every parent render.
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { attributionControl: false }).setView(
      [latitude, longitude],
      17,
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const marker = L.marker([latitude, longitude], { draggable: true, icon: pinIcon }).addTo(map)
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      onMoveRef.current(p.lat, p.lng)
    })
    map.on('click', (e: L.LeafletMouseEvent) => {
      onMoveRef.current(e.latlng.lat, e.latlng.lng)
    })

    const circle = L.circle([latitude, longitude], {
      radius: radiusM,
      color: 'hsl(var(--primary, 171 78% 24%))',
      weight: 2,
      fillOpacity: 0.12,
    }).addTo(map)

    mapRef.current = map
    markerRef.current = marker
    circleRef.current = circle

    // The container is often still 0-height on the first paint (inside a dialog/tab).
    const t = setTimeout(() => map.invalidateSize(), 120)

    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // follow parent-owned coordinates (current-location button, pasted link, typing)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return
    const pos: L.LatLngExpression = [latitude, longitude]
    markerRef.current.setLatLng(pos)
    circleRef.current.setLatLng(pos)
    mapRef.current.setView(pos, mapRef.current.getZoom())
  }, [latitude, longitude])

  useEffect(() => {
    circleRef.current?.setRadius(radiusM)
  }, [radiusM])

  return <div ref={containerRef} style={{ height, width: '100%' }} className="rounded-lg border border-border z-0" />
}
