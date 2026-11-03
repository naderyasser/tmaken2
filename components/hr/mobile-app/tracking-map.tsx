'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export interface LivePin {
  id: string
  label: string
  latitude: number
  longitude: number
  tone: 'live' | 'stale' | 'off'
}

export interface TrailPoint { t: string; lat: number; lng: number; acc: number; session: string }
export interface Stop { lat: number; lng: number; from: string; to: string; minutes: number }
export interface DayPunch { name: string; time: string; log_type: 'IN' | 'OUT'; latitude: number | null; longitude: number | null }
export interface WorkLocation { name: string; label: string; latitude: number; longitude: number; radius_m: number }

interface Props {
  pins?: LivePin[]
  onPin?: (id: string) => void
  trail?: TrailPoint[]
  stops?: Stop[]
  punches?: DayPunch[]
  locations?: WorkLocation[]
  focus?: { lat: number; lng: number } | null
  className?: string
}

const TONE = { live: '#2f9e6f', stale: '#dc8f2c', off: '#94a3b8' }
const SESSION_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#db2777']

function hm(t: string) {
  return t.slice(11, 16)
}

/** Live last positions (pins) or one employee's day (trail, stops, punches). */
export default function TrackingMap({ pins, onPin, trail, stops, punches, locations, focus, className }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const framed = useRef('')
  const onPinRef = useRef(onPin)
  onPinRef.current = onPin

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m)
    m.attributionControl.setPrefix(false)
    m.setView([24.7136, 46.6753], 11)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const pts: L.LatLng[] = []

    for (const l of locations || []) {
      L.circle([l.latitude, l.longitude], { radius: l.radius_m, color: '#2c9c9a', weight: 1.5, fillOpacity: 0.08 })
        .bindTooltip(l.label)
        .addTo(g)
      pts.push(L.latLng(l.latitude, l.longitude))
    }

    if (trail?.length) {
      const sessions = Array.from(new Set(trail.map((p) => p.session)))
      sessions.forEach((s, i) => {
        const line = trail.filter((p) => p.session === s).map((p) => L.latLng(p.lat, p.lng))
        L.polyline(line, { color: SESSION_COLORS[i % SESSION_COLORS.length], weight: 4, opacity: 0.85 }).addTo(g)
        pts.push(...line)
      })
      for (const p of trail) {
        L.circleMarker([p.lat, p.lng], { radius: 3, color: '#fff', weight: 1, fillColor: '#1e3a8a', fillOpacity: 0.9 })
          .bindTooltip(`${hm(p.t)}${p.acc ? ` · ±${Math.round(p.acc)} م` : ''}`)
          .addTo(g)
      }
      const last = trail[trail.length - 1]
      L.circleMarker([last.lat, last.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
        .bindTooltip(`آخر موقع ${hm(last.t)}`, { permanent: false })
        .addTo(g)
    }

    ;(stops || []).forEach((s, i) => {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#dc8f2c;color:#fff;border:2px solid #fff;border-radius:999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font:700 12px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .bindTooltip(`توقف ${i + 1}: ${hm(s.from)} – ${hm(s.to)} (${s.minutes} د)`)
        .addTo(g)
      pts.push(L.latLng(s.lat, s.lng))
    })

    for (const p of punches || []) {
      if (p.latitude == null || p.longitude == null) continue
      const isIn = p.log_type === 'IN'
      L.circleMarker([p.latitude, p.longitude], { radius: 9, color: '#fff', weight: 3, fillColor: isIn ? '#2f9e6f' : '#dc2626', fillOpacity: 1 })
        .bindTooltip(`${isIn ? 'حضور' : 'انصراف'} ${hm(p.time)}`)
        .addTo(g)
      pts.push(L.latLng(p.latitude, p.longitude))
    }

    for (const p of pins || []) {
      const c = TONE[p.tone]
      L.marker([p.latitude, p.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)"><div style="background:#fff;border:2px solid ${c};border-radius:6px;padding:1px 6px;font:700 11.5px sans-serif;color:#1e293b;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25)">${p.label.replace(/</g, '&lt;')}</div><div style="width:12px;height:12px;border-radius:999px;background:${c};border:2px solid #fff;margin-top:2px"></div></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 30],
        }),
      })
        .on('click', () => onPinRef.current?.(p.id))
        .addTo(g)
      pts.push(L.latLng(p.latitude, p.longitude))
    }

    const key = JSON.stringify([pins?.map((p) => p.id), trail?.[0]?.t, trail?.length ? trail[0].session : '', punches?.length, locations?.length])
    if (framed.current !== key && pts.length) {
      m.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: pins?.length ? 13 : 16 })
      framed.current = key
    }
  }, [pins, trail, stops, punches, locations])

  useEffect(() => {
    if (focus && map.current) map.current.setView([focus.lat, focus.lng], Math.max(map.current.getZoom(), 16))
  }, [focus])

  return <div ref={el} className={`isolate z-0 ${className || ''}`} aria-label="خريطة تتبع الموقع" role="img" />
}
