/**
 * Route Map — Leaflet map showing numbered customer stops connected by a polyline.
 * Used inside create / edit route plan dialogs.
 */

'use client'

import { useEffect, useRef, useMemo } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icons for webpack/next bundling
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export interface RouteStop {
  customer: string
  customer_name: string
  lat: number
  lng: number
  sequence: number
  priority?: string
}

interface RouteMapProps {
  stops: RouteStop[]
  height?: string
  className?: string
}

// Numbered circle markers
const createNumberedIcon = (num: number, priority?: string) => {
  const color = priority === 'High' ? '#dc2626' : priority === 'Low' ? '#6b7280' : '#0891b2' // red / gray / cyan
  return L.divIcon({
    className: 'route-numbered-marker',
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
    ">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  })
}

// Default centre – Riyadh
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]
const DEFAULT_ZOOM = 6

export function RouteMap({ stops, height = '260px', className }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // Derive only stops that have valid coords
  const validStops = useMemo(
    () => stops.filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng)),
    [stops],
  )

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update markers + polyline whenever stops change
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    if (validStops.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }

    // Sorted by sequence
    const sorted = [...validStops].sort((a, b) => a.sequence - b.sequence)
    const coords: [number, number][] = sorted.map(s => [s.lat, s.lng])

    // Markers
    sorted.forEach(s => {
      const marker = L.marker([s.lat, s.lng], { icon: createNumberedIcon(s.sequence, s.priority) })
      marker.bindPopup(`<strong>#${s.sequence}</strong> ${s.customer_name}`)
      layer.addLayer(marker)
    })

    // Polyline
    if (coords.length > 1) {
      const line = L.polyline(coords, { color: '#0891b2', weight: 3, opacity: 0.7, dashArray: '8,6' })
      layer.addLayer(line)
    }

    // Fit bounds
    if (coords.length === 1) {
      map.setView(coords[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(coords.map(c => L.latLng(c[0], c[1]))), { padding: [32, 32], maxZoom: 15 })
    }
  }, [validStops])

  // Invalidate size when parent resizes (dialog open, etc.)
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 300)
    return () => clearTimeout(t)
  }, [stops.length])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%', borderRadius: '0.5rem', overflow: 'hidden', background: '#f3f4f6' }}
    />
  )
}
