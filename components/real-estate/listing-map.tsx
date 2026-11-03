'use client'

import { MapContainer, TileLayer, CircleMarker, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Lightweight listing map. Uses CircleMarker/Circle (no image marker assets, so no
 * Leaflet icon-path bundler issues). When `obscured`, shows a district-radius circle
 * instead of an exact point (mirrors the backend hide_exact_location behaviour).
 * Import via next/dynamic with { ssr: false }.
 */
export default function ListingMap({
  lat, lng, obscured = false,
}: { lat?: number; lng?: number; obscured?: boolean }) {
  if (lat == null || lng == null || (lat === 0 && lng === 0)) return null
  const center: [number, number] = [lat, lng]
  return (
    <MapContainer center={center} zoom={obscured ? 12 : 14} scrollWheelZoom={false} style={{ height: 240, width: '100%', borderRadius: 12 }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {obscured ? (
        <Circle center={center} radius={900} pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 0.2 }} />
      ) : (
        <CircleMarker center={center} radius={10} pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 0.8 }} />
      )}
    </MapContainer>
  )
}
