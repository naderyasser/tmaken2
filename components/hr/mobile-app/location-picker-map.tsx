'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export interface PickerLocation {
  name: string
  location_name: string
  latitude: number | null
  longitude: number | null
  custom_radius_m: number | null
  custom_status?: string | null
}

interface Props {
  /** the pin being edited (null = not placed yet) */
  value: { latitude: number; longitude: number } | null
  radius: number
  onPick?: (lat: number, lon: number) => void
  /** other locations drawn faintly for context */
  others?: PickerLocation[]
  className?: string
}

/** Click (or drag the pin) to place a «المواقع» pin; the circle shows its radius. */
export default function LocationPickerMap({ value, radius, onPick, others = [], className }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pin = useRef<L.CircleMarker | null>(null)
  const circle = useRef<L.Circle | null>(null)
  const ctx = useRef<L.LayerGroup | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m)
    m.attributionControl.setPrefix(false)
    ctx.current = L.layerGroup().addTo(m)
    m.setView(value ? [value.latitude, value.longitude] : [24.7136, 46.6753], value ? 16 : 11)
    m.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng))
    map.current = m
    // the dialog animates open; let Leaflet measure the final size
    const t = setTimeout(() => m.invalidateSize(), 250)
    return () => {
      clearTimeout(t)
      m.remove()
      map.current = null
      pin.current = null
      circle.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const g = ctx.current
    if (!g) return
    g.clearLayers()
    for (const o of others) {
      if (!o.latitude || !o.longitude) continue
      L.circle([o.latitude, o.longitude], {
        radius: o.custom_radius_m || 100, color: '#94a3b8', weight: 1, fillOpacity: 0.08, dashArray: '4 4',
      }).bindTooltip(o.location_name).addTo(g)
    }
  }, [others])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!value) {
      pin.current?.remove()
      circle.current?.remove()
      pin.current = null
      circle.current = null
      return
    }
    const ll = L.latLng(value.latitude, value.longitude)
    if (!circle.current) {
      circle.current = L.circle(ll, { radius, color: '#2c9c9a', weight: 2, fillColor: '#2c9c9a', fillOpacity: 0.18 }).addTo(m)
      pin.current = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1d4d56', fillOpacity: 1 }).addTo(m)
      m.setView(ll, Math.max(m.getZoom(), 16))
    } else {
      circle.current.setLatLng(ll).setRadius(radius)
      pin.current?.setLatLng(ll)
      if (!m.getBounds().contains(ll)) m.panTo(ll)
    }
  }, [value, radius])

  return <div ref={el} className={`isolate z-0 ${className || ''}`} />
}
