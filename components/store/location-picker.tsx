'use client'

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Inline green teardrop pin (no Leaflet image-asset bundling issues).
const PIN = divIcon({
  className: '',
  html: '<div style="width:26px;height:26px;transform:translate(-13px,-26px)"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="#3A2A21" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></div>',
  iconSize: [26, 26],
  iconAnchor: [0, 0],
})

function ClickToMove({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default function LocationPicker({
  lat, lng, onChange,
}: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={13} scrollWheelZoom style={{ height: 300, width: '100%', borderRadius: 12 }}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToMove onPick={onChange} />
      <Marker
        position={[lat, lng]}
        draggable
        icon={PIN}
        eventHandlers={{ dragend: (e) => { const p = (e.target as any).getLatLng(); onChange(p.lat, p.lng) } }}
      />
    </MapContainer>
  )
}
