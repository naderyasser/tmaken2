'use client'

import { useEffect, useRef } from 'react'

// Ported 1:1 from egarsys src/components/ui/map-picker.tsx — a VANILLA Leaflet +
// OSM (keyless) picker, dynamically importing `leaflet` from node_modules (the
// real npm package, bundled into this lazy chunk). Leaflet's CSS + default
// marker glyphs are injected at runtime from the leaflet 1.9.4 CDN build (the
// same approach the platform's own /sales-rep/my-map page uses) — the tenant
// CSP is Report-Only and permits img-src/style-src https:, so nothing is blocked.
// Click-to-drop-pin + drag + debounced keyless Nominatim geocoding are unchanged.

const SAUDI_CITIES: Record<string, [number, number]> = {
  'الرياض': [24.7136, 46.6753],
  'جدة': [21.4858, 39.1925],
  'مكة المكرمة': [21.3891, 39.8579],
  'مكة': [21.3891, 39.8579],
  'المدينة المنورة': [24.5247, 39.5692],
  'المدينة': [24.5247, 39.5692],
  'الدمام': [26.4207, 50.0888],
  'الخبر': [26.2794, 50.2083],
  'الظهران': [26.2361, 50.0393],
  'القطيف': [26.5196, 49.9962],
  'الجبيل': [27.0046, 49.6580],
  'الأحساء': [25.4295, 49.6203],
  'الهفوف': [25.3647, 49.5877],
  'أبها': [18.2164, 42.5053],
  'خميس مشيط': [18.3066, 42.7297],
  'نجران': [17.4920, 44.1277],
  'جازان': [16.8892, 42.5706],
  'الطائف': [21.2854, 40.4149],
  'ينبع': [24.0897, 38.0618],
  'تبوك': [28.3998, 36.5700],
  'بريدة': [26.3260, 43.9750],
  'عنيزة': [26.0843, 43.9940],
  'حائل': [27.5219, 41.6905],
  'الجوف': [29.9697, 40.2064],
  'سكاكا': [29.9697, 40.2064],
  'عرعر': [30.9753, 41.0381],
  'القريات': [31.3320, 37.3421],
  'حفر الباطن': [28.4342, 45.9636],
  'الخرج': [24.1554, 47.3346],
  'المجمعة': [25.9039, 45.3450],
  'الباحة': [20.0129, 41.4677],
  'وادي الدواسر': [20.4692, 44.8046],
  'بيشة': [20.0000, 42.6000],
}

// Does a Nominatim hit resolve to a specific street/POI (→ drop a pin) or only to a
// coarse admin area like a city/region (→ just recenter, no pin)?
function isStreetLevel(hit: any): boolean {
  const rank = Number(hit?.place_rank)
  if (Number.isFinite(rank)) return rank >= 26
  const kind = String(hit?.addresstype || hit?.type || '')
  const COARSE = new Set([
    'country', 'state', 'region', 'province', 'county', 'state_district',
    'city', 'town', 'village', 'municipality', 'island', 'archipelago',
  ])
  return kind !== '' && !COARSE.has(kind)
}

const CITY_NAMES_BY_LENGTH = Object.keys(SAUDI_CITIES).sort((a, b) => b.length - a.length)
function findCityInText(text: string): [number, number] | null {
  if (!text) return null
  for (const name of CITY_NAMES_BY_LENGTH) {
    if (text.includes(name)) return SAUDI_CITIES[name]
  }
  return null
}

export type GeocodeStatus = 'idle' | 'searching' | 'found' | 'city'

// Runtime-inject the Leaflet stylesheet once (idempotent). node_modules CSS is not
// URL-addressable at runtime, so — like the platform's my-map page — we load it from
// the pinned 1.9.4 CDN build. The Leaflet JS itself is the bundled npm package.
function ensureLeafletCss() {
  if (typeof document === 'undefined') return
  if (document.getElementById('leaflet-css')) return
  const link = document.createElement('link')
  link.id = 'leaflet-css'
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
}

interface MapPickerProps {
  lat?: number | null
  lng?: number | null
  onChange: (lat: number, lng: number) => void
  readonly?: boolean
  centerCity?: string
  centerDistrict?: string
  geocodeQuery?: string
  onGeocodeStatusChange?: (status: GeocodeStatus) => void
}

export default function MapPicker({ lat, lng, onChange, readonly = false, centerCity, geocodeQuery, onGeocodeStatusChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  const onStatusRef = useRef(onGeocodeStatusChange)
  useEffect(() => {
    onChangeRef.current = onChange
    onStatusRef.current = onGeocodeStatusChange
  })
  const reportStatus = (s: GeocodeStatus) => onStatusRef.current?.(s)
  const lastGeocodedRef = useRef<string>((geocodeQuery || '').trim())

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    ensureLeafletCss()

    import('leaflet').then((mod) => {
      const L: any = (mod as any).default ?? mod
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const defaultLat = lat ?? 24.7136
      const defaultLng = lng ?? 46.6753

      const map = L.map(containerRef.current!).setView([defaultLat, defaultLng], lat ? 14 : 6)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      if (lat && lng) {
        const marker = L.marker([lat, lng], { draggable: !readonly }).addTo(map)
        markerRef.current = marker
        if (!readonly) {
          marker.on('dragend', (e: any) => {
            const pos = e.target.getLatLng()
            onChangeRef.current(pos.lat, pos.lng)
          })
        }
      }

      if (!readonly) {
        map.on('click', (e: any) => {
          const { lat: clickLat, lng: clickLng } = e.latlng
          if (markerRef.current) {
            markerRef.current.setLatLng([clickLat, clickLng])
          } else {
            const marker = L.marker([clickLat, clickLng], { draggable: true }).addTo(map)
            markerRef.current = marker
            marker.on('dragend', (ev: any) => {
              const pos = ev.target.getLatLng()
              onChangeRef.current(pos.lat, pos.lng)
            })
          }
          onChangeRef.current(clickLat, clickLng)
        })
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update marker when lat/lng props change externally.
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return
    import('leaflet').then((mod) => {
      const L: any = (mod as any).default ?? mod
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const marker = L.marker([lat, lng], { draggable: !readonly }).addTo(mapRef.current)
        markerRef.current = marker
        if (!readonly) {
          marker.on('dragend', (e: any) => {
            const pos = e.target.getLatLng()
            onChangeRef.current(pos.lat, pos.lng)
          })
        }
      }
      mapRef.current.flyTo([lat, lng], 14, { animate: true, duration: 1.2 })
    })
  }, [lat, lng, readonly])

  // Fly to selected city when no pin has been dropped yet.
  useEffect(() => {
    if (!mapRef.current) return
    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) return
    const coords = SAUDI_CITIES[centerCity || '']
    if (coords) {
      mapRef.current.flyTo(coords, 12, { animate: true, duration: 1 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerCity])

  // Reactive keyless geocoding of the typed address (debounced Nominatim).
  useEffect(() => {
    if (readonly) return
    const query = (geocodeQuery || '').trim()
    if (query.length < 4) { reportStatus('idle'); return }
    if (query === lastGeocodedRef.current) return

    reportStatus('searching')

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      lastGeocodedRef.current = query

      const cityFallback = (): boolean => {
        if (mapRef.current && (lat === null || lat === undefined)) {
          const city = findCityInText(query)
          if (city) {
            mapRef.current.flyTo(city, 11, { animate: true, duration: 1.2 })
            return true
          }
        }
        return false
      }

      try {
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('q', query.includes('السعودية') ? query : `${query}، المملكة العربية السعودية`)
        url.searchParams.set('format', 'jsonv2')
        url.searchParams.set('countrycodes', 'sa')
        url.searchParams.set('accept-language', 'ar')
        url.searchParams.set('addressdetails', '1')
        url.searchParams.set('limit', '1')

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) { reportStatus(cityFallback() ? 'city' : 'idle'); return }
        const results = await res.json()
        const hit = Array.isArray(results) ? results[0] : null

        if (hit) {
          const glat = parseFloat(hit.lat)
          const glng = parseFloat(hit.lon)
          if (Number.isFinite(glat) && Number.isFinite(glng)) {
            if (isStreetLevel(hit)) {
              onChangeRef.current(glat, glng)
              reportStatus('found')
            } else if (mapRef.current && (lat === null || lat === undefined)) {
              mapRef.current.flyTo([glat, glng], 11, { animate: true, duration: 1.2 })
              reportStatus('city')
            } else {
              reportStatus('idle')
            }
            return
          }
        }

        reportStatus(cityFallback() ? 'city' : 'idle')
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          reportStatus(cityFallback() ? 'city' : 'idle')
        }
      }
    }, 700)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodeQuery, readonly, lat, lng])

  return (
    <>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-input overflow-hidden"
        style={{ height: 280 }}
      />
      {!readonly && (
        <p className="text-xs text-muted-foreground mt-1">
          اكتب العنوان أعلاه ليتحرك المؤشر تلقائيًا، أو انقر على الخريطة لتحديد الموقع، أو اسحب المؤشر لضبطه
        </p>
      )}
    </>
  )
}
