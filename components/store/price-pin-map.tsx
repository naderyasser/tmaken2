'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { ListingSearchResult } from '@/lib/real-estate-api'
import { getGsap, prefersReducedMotion } from '@/lib/motion'

export interface MapBounds { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number }
export interface FlyTo { lat: number; lng: number; zoom: number; key: number }

// Saudi Arabia: default view envelope (empty results) + a looser pan/zoom cage so users
// can't drift off to other continents.
const SAUDI_BOUNDS: [[number, number], [number, number]] = [[16.0, 34.0], [32.5, 56.0]]
const SAUDI_MAX: [[number, number], [number, number]] = [[12.0, 30.0], [34.5, 60.0]]
const MIN_ZOOM = 5

// Compact price for map pins (e.g. "3.6 م", "500 ألف"). Western digits to match the site's
// tabular price formatting elsewhere; clustering (cluster count) is handled by the map below.
function priceChip(p?: number | null): string {
  if (!p) return '—'
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(p % 1_000_000 ? 1 : 0)} م`
  if (p >= 1_000) return `${Math.round(p / 1_000)} ألف`
  return String(Math.round(p))
}
const pinIcon = (l: ListingSearchResult, active: boolean) => L.divIcon({
  className: '',
  html: `<div class="aqar-pin${l.is_featured ? ' aqar-pin-gold' : ''}${active ? ' aqar-pin-active' : ''}">${priceChip(l.price)}</div>`,
  iconSize: [0, 0], iconAnchor: [0, 0],
})
const clusterIcon = (cluster: any) => L.divIcon({
  className: '',
  html: `<div class="aqar-cluster">${cluster.getChildCount()}</div>`,
  iconSize: [0, 0],
})

function Cluster({ items, active, onHover, onClick, onMove, searchOnMove, fitKey, flyTo }: {
  items: ListingSearchResult[]; active: string | null
  onHover: (id: string | null) => void; onClick: (id: string) => void
  onMove: (b: MapBounds) => void; searchOnMove: boolean; fitKey: number; flyTo?: FlyTo | null
}) {
  const map = useMap()
  const groupRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const fittedRef = useRef(false)
  const readyRef = useRef(false) // becomes true only after the initial fit settles
  const moveTimer = useRef<ReturnType<typeof setTimeout>>()
  const flyKeyRef = useRef<number | null>(null)

  useMapEvents({
    moveend() {
      if (!readyRef.current) return // ignore moves caused by the initial programmatic fitBounds
      if (!searchOnMove) return
      clearTimeout(moveTimer.current)
      moveTimer.current = setTimeout(() => {
        const b = map.getBounds()
        onMove({ sw_lat: b.getSouth(), sw_lng: b.getWest(), ne_lat: b.getNorth(), ne_lng: b.getEast() })
      }, 400)
    },
  })

  // refit when the seed/filter set changes (fitKey). Declared BEFORE the marker effect so that
  // on a commit where both fitKey and items change, fittedRef is reset first → the marker effect
  // re-runs its fit for the new result set.
  useEffect(() => { fittedRef.current = false; readyRef.current = false }, [fitKey])

  // programmatic recenter (city pick / near-me). setView fires a moveend → bounds search runs.
  useEffect(() => {
    if (!flyTo || flyKeyRef.current === flyTo.key) return
    flyKeyRef.current = flyTo.key
    map.setView([flyTo.lat, flyTo.lng], flyTo.zoom, { animate: !prefersReducedMotion() })
  }, [flyTo, map])

  // (re)build markers when items change
  useEffect(() => {
    if (!groupRef.current) {
      groupRef.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 48, spiderfyOnMaxZoom: true,
        iconCreateFunction: clusterIcon, chunkedLoading: true,
      })
      map.addLayer(groupRef.current)
    }
    const group = groupRef.current
    group.clearLayers()
    markersRef.current = {}
    const markers: any[] = []
    for (const l of items) {
      if (l.pin_lat == null || l.pin_lng == null) continue
      const m = L.marker([l.pin_lat, l.pin_lng], { icon: pinIcon(l, active === l.name) })
      m.on('mouseover', () => onHover(l.name))
      m.on('mouseout', () => onHover(null))
      m.on('click', () => onClick(l.name))
      markersRef.current[l.name] = m
      markers.push(m)
    }
    group.addLayers(markers)

    // Initial view: fit to the result pins (or Saudi bounds when empty). invalidateSize
    // first so the fit uses the real container height (avoids a world-level zoom).
    if (!fittedRef.current) {
      fittedRef.current = true
      // small delay so the grid/sticky layout has its final size before we measure & fit
      setTimeout(() => {
        map.invalidateSize()
        try {
          if (markers.length) map.fitBounds(group.getBounds().pad(0.2), { animate: false, maxZoom: 15 })
          else map.fitBounds(SAUDI_BOUNDS, { animate: false })
        } catch { map.fitBounds(SAUDI_BOUNDS, { animate: false }) }
        // enable search-as-you-move only after the fit (and its moveend) has settled
        setTimeout(() => { readyRef.current = true }, 500)
      }, 150)
    }
    // gentle stagger-in — plays from the fitted view and includes cluster bubbles.
    // Animate the leaflet marker WRAPPERS (not the inner .aqar-pin) so the active-lift
    // CSS transform stays intact. On first load, wait a beat for the fit's clusters to draw.
    if (!prefersReducedMotion() && markers.length) {
      const delay = readyRef.current ? 0 : 90
      setTimeout(() => requestAnimationFrame(async () => {
        const els = Array.from(map.getContainer().querySelectorAll('.leaflet-marker-icon'))
        if (!els.length) return
        const g = await getGsap()
        g.fromTo(els, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out', stagger: 0.012, transformOrigin: '50% 100%' })
      }), delay)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // active pin lift + pan-if-offscreen
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]: any) => {
      const el = m.getElement?.()?.querySelector('.aqar-pin')
      if (el) el.classList.toggle('aqar-pin-active', id === active)
    })
    if (active && markersRef.current[active]) {
      const m = markersRef.current[active]
      const ll = m.getLatLng()
      if (!map.getBounds().contains(ll)) map.panTo(ll, { animate: !prefersReducedMotion() })
    }
  }, [active, map])

  return null
}

export default function PricePinMap(props: {
  items: ListingSearchResult[]; active: string | null
  onHover: (id: string | null) => void; onClick: (id: string) => void
  onMove: (b: MapBounds) => void; searchOnMove: boolean; fitKey: number; flyTo?: FlyTo | null
}) {
  return (
    <MapContainer
      center={[24.0, 45.0]} zoom={6} minZoom={MIN_ZOOM}
      maxBounds={SAUDI_MAX} maxBoundsViscosity={0.7}
      scrollWheelZoom style={{ height: '100%', width: '100%' }} className="z-0"
    >
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Cluster {...props} />
    </MapContainer>
  )
}
