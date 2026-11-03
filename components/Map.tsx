"use client"

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect } from "react"

// Fix for default marker icon in leaflet with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

interface MapProps {
    locations: Array<{
        latitude: number
        longitude: number
        log_datetime: string
        address?: string
    }>
}

export default function Map({ locations }: MapProps) {
    const defaultPosition: [number, number] = [24.7136, 46.6753] // Riyadh

    return (
        <div className="h-full w-full">
            <MapContainer
                center={locations.length > 0 ? [locations[0].latitude, locations[0].longitude] : defaultPosition}
                zoom={locations.length > 0 ? 13 : 5}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {locations.map((loc, idx) => (
                    <Marker key={idx} position={[loc.latitude, loc.longitude]}>
                        <Popup>
                            <div className="text-right" dir="rtl">
                                <strong>{loc.log_datetime}</strong>
                                <br />
                                {loc.address || "لا يوجد عنوان"}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}
