/**
 * LocationPickerMap — Interactive map to pick a location by clicking or searching
 * Uses Leaflet + OpenStreetMap tiles + Nominatim for geocoding (free, no API key)
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, MapPin, Crosshair, Loader2, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const RIYADH: [number, number] = [24.7136, 46.6753]
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 16

// Custom pin icon
const pinIcon = L.divIcon({
  className: 'location-picker-pin',
  html: `<div style="
    display:flex;flex-direction:column;align-items:center;
  ">
    <div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:#dc2626;transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
    ">
      <div style="width:10px;height:10px;border-radius:50%;background:#fff;transform:rotate(45deg);"></div>
    </div>
    <div style="width:2px;height:6px;background:#dc2626;margin-top:-2px;"></div>
  </div>`,
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
})

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  address?: {
    road?: string
    city?: string
    state?: string
    country?: string
  }
}

interface LocationPickerMapProps {
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
  height?: string
  className?: string
}

export function LocationPickerMap({
  lat, lng, onChange, height = '280px', className,
}: LocationPickerMapProps) {
  const { isRTL, t } = useI18n()
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [address, setAddress] = useState('')

  // Place or move the marker
  const placeMarker = useCallback((latVal: number, lngVal: number, fly = true) => {
    if (!mapRef.current) return
    if (markerRef.current) {
      markerRef.current.setLatLng([latVal, lngVal])
    } else {
      markerRef.current = L.marker([latVal, lngVal], { icon: pinIcon, draggable: true })
        .addTo(mapRef.current)
      // Allow dragging to reposition
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng()
        onChange(pos.lat.toFixed(6), pos.lng.toFixed(6))
        reverseGeocode(pos.lat, pos.lng)
      })
    }
    if (fly) {
      mapRef.current.flyTo([latVal, lngVal], Math.max(mapRef.current.getZoom(), PIN_ZOOM), { duration: 0.6 })
    }
    onChange(latVal.toFixed(6), lngVal.toFixed(6))
  }, [onChange])

  // Reverse geocode to show address
  const reverseGeocode = useCallback(async (latVal: number, lngVal: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latVal}&lon=${lngVal}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': isRTL ? 'ar' : 'en' } }
      )
      const data = await res.json()
      if (data.display_name) {
        setAddress(data.display_name)
      }
    } catch {
      setAddress('')
    }
  }, [isRTL])

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initLat = parseFloat(lat)
    const initLng = parseFloat(lng)
    const hasInitialPos = !isNaN(initLat) && !isNaN(initLng) && initLat !== 0 && initLng !== 0
    const center: [number, number] = hasInitialPos ? [initLat, initLng] : RIYADH
    const zoom = hasInitialPos ? PIN_ZOOM : DEFAULT_ZOOM

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)

    // Click to place pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng, false)
      reverseGeocode(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map

    // Place initial marker if coordinates exist
    if (hasInitialPos) {
      placeMarker(initLat, initLng, false)
      reverseGeocode(initLat, initLng)
    }

    // Fix rendering inside dialogs
    const resizeTimer = setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(resizeTimer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external lat/lng changes to map (e.g. when switching between edit targets)
  useEffect(() => {
    const latVal = parseFloat(lat)
    const lngVal = parseFloat(lng)
    if (!isNaN(latVal) && !isNaN(lngVal) && latVal !== 0 && lngVal !== 0 && mapRef.current) {
      if (markerRef.current) {
        const currentPos = markerRef.current.getLatLng()
        // Only update if significantly different (avoid feedback loop)
        if (Math.abs(currentPos.lat - latVal) > 0.0001 || Math.abs(currentPos.lng - lngVal) > 0.0001) {
          placeMarker(latVal, lngVal, true)
          reverseGeocode(latVal, lngVal)
        }
      }
    }
  }, [lat, lng, placeMarker, reverseGeocode])

  // Invalidate size on mount (dialog animations)
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 400)
    return () => clearTimeout(t)
  }, [])

  // Search via Nominatim
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setShowResults(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': isRTL ? 'ar' : 'en' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } catch {
      setResults([])
    } finally { setSearching(false) }
  }

  const selectResult = (result: NominatimResult) => {
    const latVal = parseFloat(result.lat)
    const lngVal = parseFloat(result.lon)
    placeMarker(latVal, lngVal, true)
    setAddress(result.display_name)
    setSearchQuery(result.display_name.split(',').slice(0, 2).join(','))
    setShowResults(false)
  }

  // Use browser geolocation
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeMarker(pos.coords.latitude, pos.coords.longitude, true)
        reverseGeocode(pos.coords.latitude, pos.coords.longitude)
      },
      () => { /* ignore errors */ },
      { enableHighAccuracy: true }
    )
  }

  // Remove pin
  const clearPin = () => {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    onChange('', '')
    setAddress('')
  }

  const hasPin = lat && lng && lat !== '0' && lng !== '0'

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className={cn('absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400', isRTL ? 'right-2.5' : 'left-2.5')} />
            <Input
              placeholder={t('sr.admin.map.picker_search_placeholder')}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setShowResults(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              className={cn('h-8 text-xs', isRTL ? 'pr-8' : 'pl-8')}
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5" onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5" onClick={useMyLocation} title={t('sr.admin.map.my_location')}>
            <Crosshair className="h-3.5 w-3.5" />
          </Button>
          {hasPin && (
            <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-red-500 hover:text-red-600" onClick={clearPin} title={t('sr.admin.map.clear')}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-start px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors flex items-start gap-2"
              >
                <MapPin className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-gray-700 line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
        {showResults && !searching && results.length === 0 && searchQuery && (
          <div className="absolute z-[1000] w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-center text-xs text-gray-400">
            {t('sr.admin.common.no_results')}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {/* Hint overlay when no pin */}
        {!hasPin && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2.5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-red-500" />
                {t('sr.admin.map.click_to_set')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Address + Coordinates display */}
      {hasPin && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
          {address && (
            <p className="text-[11px] text-gray-600 line-clamp-2 flex items-start gap-1.5">
              <MapPin className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
              {address}
            </p>
          )}
          <p className="text-[10px] text-gray-400 font-mono">
            {lat}, {lng}
          </p>
        </div>
      )}
    </div>
  )
}
