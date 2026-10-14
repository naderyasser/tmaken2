'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import type { AppLocation } from '@/lib/m/api'

interface Props {
  locations: AppLocation[]
  position: { latitude: number; longitude: number; accuracy: number } | null
  activeName?: string | null
  className?: string
}

/**
 * Work-location circles (tamken3 «المواقع» radius) + the phone's live dot.
 * Imperative Leaflet, loaded client-side only (see dynamic() in the caller).
 */
export default function FenceMap({ locations, position, activeName, className }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const fences = useRef<L.LayerGroup | null>(null)
  const me = useRef<L.LayerGroup | null>(null)
  // re-frame when the phone first gets a fix and whenever it crosses the fence
  const framedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m)
    m.attributionControl.setPrefix(false)
    fences.current = L.layerGroup().addTo(m)
    me.current = L.layerGroup().addTo(m)
    m.setView([24.7136, 46.6753], 12)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const g = fences.current
    if (!g) return
    g.clearLayers()
    for (const l of locations) {
      const active = l.name === activeName
      L.circle([l.latitude, l.longitude], {
        radius: l.radius_m,
        color: active ? '#2f9e6f' : '#2c9c9a',
        weight: 2,
        fillColor: active ? '#6cc196' : '#2c9c9a',
        fillOpacity: active ? 0.22 : 0.12,
      }).addTo(g)
      L.circleMarker([l.latitude, l.longitude], { radius: 4, color: '#1d4d56', weight: 2, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(l.label, { direction: 'top', offset: [0, -4] })
        .addTo(g)
    }
  }, [locations, activeName])

  useEffect(() => {
    const m = map.current
    const g = me.current
    if (!m || !g) return
    g.clearLayers()
    if (position) {
      L.circle([position.latitude, position.longitude], {
        radius: Math.min(position.accuracy, 500),
        color: '#3b82f6',
        weight: 0,
        fillOpacity: 0.12,
      }).addTo(g)
      L.circleMarker([position.latitude, position.longitude], {
        radius: 7,
        color: '#fff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      }).addTo(g)
    }
    // frame the phone + every allowed circle
    const frameKey = position ? `fix:${activeName || 'outside'}` : 'nofix'
    if (framedFor.current !== frameKey && (position || locations.length)) {
      const pts: L.LatLngExpression[] = locations.map((l) => [l.latitude, l.longitude])
      let bounds = pts.length ? L.latLngBounds(pts) : null
      for (const l of locations) {
        const c = L.latLng(l.latitude, l.longitude).toBounds(l.radius_m * 2)
        bounds = bounds ? bounds.extend(c) : c
      }
      if (position) {
        const p = L.latLng(position.latitude, position.longitude)
        bounds = bounds ? bounds.extend(p) : p.toBounds(300)
      }
      if (bounds) m.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 })
      framedFor.current = frameKey
    }
  }, [position, locations, activeName])

  return <div ref={el} className={`isolate z-0 ${className || ''}`} aria-label="خريطة موقع العمل" role="img" />
}
