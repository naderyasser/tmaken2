"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  MapPin, Clock, CheckCircle2, Circle, ArrowRight,
  Loader2, RefreshCw, Navigation, Calendar, ChevronLeft,
  ChevronRight, Locate, Eye, EyeOff,
} from "lucide-react"
import Link from "next/link"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { salesApi, type SalesPersonVisit, type DailyRoutePlan, type RepZone, localDateISO } from "@/lib/sales-api"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

// Leaflet is loaded dynamically inside a useEffect — no module-level require
type LeafletType = typeof import("leaflet")

/** Inject Leaflet CSS via <link> tag (avoids Turbopack HMR issues with require("...css")) */
function useLeafletCSS() {
  useEffect(() => {
    const id = "leaflet-css"
    if (document.getElementById(id)) return
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.min.css"
    document.head.appendChild(link)
  }, [])
}

// Visual styles kept at module scope (color/markerColor are not translatable).
// Status labels are resolved inside the component via t('sr.status.*').
const VISIT_STATUS_MAP: Record<string, { color: string; markerColor: string }> = {
  Completed: { color: "bg-emerald-100 text-emerald-700", markerColor: "#059669" },
  "In Progress": { color: "bg-blue-100 text-blue-700", markerColor: "#2563eb" },
  Scheduled: { color: "bg-slate-100 text-slate-600", markerColor: "#64748b" },
  Cancelled: { color: "bg-red-100 text-red-600", markerColor: "#dc2626" },
}

function createVisitIcon(L: LeafletType, status: string, index: number) {
  const color = VISIT_STATUS_MAP[status]?.markerColor || "#64748b"
  return L.divIcon({
    className: "visit-marker",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
    ">${index + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

function createMyLocationIcon(L: LeafletType) {
  return L.divIcon({
    className: "my-location-marker",
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:#3b82f6;
      border:4px solid #bfdbfe;box-shadow:0 0 12px rgba(59,130,246,.5);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

export default function MyMapPage() {
  const { salesPerson, customers, initialLoading, error } = useSalesRep()
  const { t, lang } = useI18n()
  const dl = displayLocale(lang)
  const statusLabel = (s: string) => t('sr.status.' + s.toLowerCase().replace(/ /g, '_'))
  useLeafletCSS()

  // Leaflet loaded dynamically via ESM import (avoids Turbopack/SSR issues with require())
  const lRef = useRef<LeafletType | null>(null)
  const [leafletReady, setLeafletReady] = useState(false)

  useEffect(() => {
    import("leaflet").then((m) => {
      const leaflet = m.default
      // Fix default marker icons
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })
      lRef.current = leaflet
      setLeafletReady(true)
    }).catch(() => { })
  }, [])

  const [selectedDate, setSelectedDate] = useState(localDateISO())
  const [visits, setVisits] = useState<SalesPersonVisit[]>([])
  const [routePlan, setRoutePlan] = useState<DailyRoutePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showRoute, setShowRoute] = useState(true)
  const [myZone, setMyZone] = useState<RepZone | null>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)
  const myLocMarkerRef = useRef<any>(null)
  const zoneLayerRef = useRef<any>(null)

  // Assigned work zone (drawn under everything else); absent pre-migration → null
  useEffect(() => {
    if (!salesPerson) return
    let cancelled = false
    salesApi.getRepZones()
      .then(rows => { if (!cancelled) setMyZone(rows.find(z => z.name === salesPerson.name) || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [salesPerson])

  // Load visits & route plan for selected date
  const loadData = useCallback(async () => {
    // No linked Sales Person → nothing to load; clear the flag so the page can
    // render the not-a-rep error state instead of an eternal "loading map" card.
    if (!salesPerson) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [visitsData, plans] = await Promise.all([
        salesApi.getVisits({
          filters: [
            ["Sales Person Visit", "sales_person", "=", salesPerson.name],
            ["Sales Person Visit", "visit_date", "=", selectedDate],
          ],
          fields: [
            "name", "sales_person", "customer", "visit_date", "visit_status",
            "visit_type", "check_in_time", "check_out_time", "visit_duration",
            "has_order", "sales_order", "check_in_lat", "check_in_lng",
            "check_out_lat", "check_out_lng", "is_within_radius",
          ],
        }),
        salesApi.getRoutePlans({
          filters: [
            ["Daily Route Plan", "sales_person", "=", salesPerson.name],
            ["Daily Route Plan", "route_date", "=", selectedDate],
          ],
        }).catch(() => []),
      ])

      setVisits(visitsData)

      if (plans.length > 0) {
        const full = await salesApi.getRoutePlan(plans[0].name).catch(() => null)
        setRoutePlan(full)
      } else {
        setRoutePlan(null)
      }
    } catch (err) {
      console.warn("[MyMap] Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }, [salesPerson, selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get current location
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Initialize map
  useEffect(() => {
    if (!lRef.current || loading || !mapContainerRef.current || mapRef.current) return
    const L = lRef.current

    const map = L.map(mapContainerRef.current, {
      center: [24.7136, 46.6753], // Riyadh default
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)

    zoneLayerRef.current = L.layerGroup().addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    routeLineRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = null
      routeLineRef.current = null
      myLocMarkerRef.current = null
      zoneLayerRef.current = null
    }
  }, [loading, leafletReady])

  // Draw my assigned work zone
  useEffect(() => {
    if (!lRef.current || !mapRef.current || !zoneLayerRef.current) return
    const L = lRef.current
    zoneLayerRef.current.clearLayers()
    if (!myZone?.zone_polygon) return
    try {
      const ring = JSON.parse(myZone.zone_polygon)?.coordinates?.[0] as number[][]
      if (!Array.isArray(ring) || ring.length < 3) return
      const latlngs = ring.map(p => [Number(p[1]), Number(p[0])] as [number, number])
      const color = myZone.zone_color || "#7c3aed"
      L.polygon(latlngs, { color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.08 })
        .bindTooltip(`${myZone.zone_name ? myZone.zone_name + " — " : ""}${t("sr.map.my_zone")}`, { sticky: true })
        .addTo(zoneLayerRef.current)
    } catch { /* malformed polygon — skip */ }
  }, [myZone, leafletReady, loading, t])

  // Update markers when data changes
  useEffect(() => {
    if (!lRef.current || !mapRef.current || !markersRef.current || !routeLineRef.current) return
    const L = lRef.current

    markersRef.current.clearLayers()
    routeLineRef.current.clearLayers()

    const bounds: [number, number][] = []
    const routeCoords: [number, number][] = []

    // Add visit markers
    visits.forEach((visit, idx) => {
      const lat = parseFloat(visit.check_in_lat || "")
      const lng = parseFloat(visit.check_in_lng || "")
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return

      const customerObj = customers.find(c => c.name === visit.customer)
      const customerName = customerObj?.customer_name || visit.customer

      const timeIn = visit.check_in_time
        ? new Date(visit.check_in_time).toLocaleTimeString(dl, { hour: "2-digit", minute: "2-digit" })
        : "—"
      const timeOut = visit.check_out_time
        ? new Date(visit.check_out_time).toLocaleTimeString(dl, { hour: "2-digit", minute: "2-digit" })
        : "—"

      const marker = L!.marker([lat, lng], { icon: createVisitIcon(L, visit.visit_status, idx) })
      marker.bindPopup(`
        <div style="min-width:180px;direction:rtl;text-align:right">
          <strong style="font-size:14px">${customerName}</strong><br/>
          <span style="color:#666;font-size:12px">
            ${t('sr.map.popup_checkin').replace('{time}', timeIn)}<br/>
            ${t('sr.map.popup_checkout').replace('{time}', timeOut)}<br/>
            ${t('sr.map.popup_status').replace('{status}', statusLabel(visit.visit_status))}
            ${visit.has_order ? '<br/>' + t('sr.map.popup_has_order') : ''}
            ${visit.visit_duration ? '<br/>' + t('sr.map.popup_duration').replace('{n}', String(visit.visit_duration)) : ''}
          </span>
        </div>
      `)
      markersRef.current.addLayer(marker)
      bounds.push([lat, lng])
      routeCoords.push([lat, lng])
    })

    // Also add customers from route plan that weren't visited yet
    if (routePlan?.customers) {
      routePlan.customers
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        .forEach((stop) => {
          const customerObj = customers.find(c => c.name === stop.customer)
          if (!customerObj) return
          const lat = parseFloat(customerObj.customer_lat || "")
          const lng = parseFloat(customerObj.customer_lng || "")
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return

          // Check if already have a visit marker for this customer
          const hasVisit = visits.some(
            v => v.customer === stop.customer && v.check_in_lat && v.check_in_lng
          )
          if (hasVisit) return

          const marker = L!.marker([lat, lng], {
            icon: L!.divIcon({
              className: "planned-marker",
              html: `<div style="
                width:28px;height:28px;border-radius:50%;
                background:#fff;color:#64748b;
                display:flex;align-items:center;justify-content:center;
                font-size:12px;font-weight:700;
                border:2px dashed #94a3b8;box-shadow:0 2px 6px rgba(0,0,0,.15);
              ">${stop.sequence || "?"}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
              popupAnchor: [0, -16],
            }),
          })
          marker.bindPopup(`
            <div style="min-width:140px;direction:rtl;text-align:right">
              <strong>${customerObj.customer_name}</strong><br/>
              <span style="color:#94a3b8;font-size:12px">${t('sr.map.popup_planned')}</span>
            </div>
          `)
          markersRef.current.addLayer(marker)
          bounds.push([lat, lng])
        })
    }

    // Draw route line
    if (showRoute && routeCoords.length > 1) {
      L!.polyline(routeCoords, {
        color: "#2563eb",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 6",
      }).addTo(routeLineRef.current)
    }

    // My location marker
    if (myLocation) {
      if (myLocMarkerRef.current) {
        myLocMarkerRef.current.setLatLng([myLocation.lat, myLocation.lng])
      } else {
        myLocMarkerRef.current = L!.marker(
          [myLocation.lat, myLocation.lng],
          { icon: createMyLocationIcon(L) }
        ).addTo(mapRef.current)
        myLocMarkerRef.current.bindPopup('<div style="direction:rtl;text-align:center"><strong>' + t('sr.map.popup_my_location') + '</strong></div>')
      }
      bounds.push([myLocation.lat, myLocation.lng])
    }

    // Fit bounds
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    } else if (myLocation) {
      mapRef.current.setView([myLocation.lat, myLocation.lng], 14)
    }
  }, [visits, routePlan, customers, myLocation, showRoute])

  const goToMyLocation = () => {
    if (myLocation && mapRef.current) {
      mapRef.current.setView([myLocation.lat, myLocation.lng], 15)
    }
  }

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(localDateISO(d))
  }

  const isToday = selectedDate === localDateISO()

  const completedVisits = visits.filter(v => v.visit_status === "Completed").length
  const totalVisits = visits.length
  const ordersCount = visits.filter(v => v.has_order === 1).length

  // Context still resolving the Sales Person → show a bounded spinner.
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('sr.map.loading_rep')}</p>
        </div>
      </div>
    )
  }

  // No Sales Person linked to this login (e.g. admin account) → real error state,
  // mirroring the PWA home page, instead of the old infinite "loading map" card.
  if (error || !salesPerson) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 flex items-center justify-center p-6" dir="rtl">
        <Card className="p-8 text-center rounded-2xl border border-slate-200 max-w-sm">
          <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h2 className="font-bold text-base mb-2">{t('sr.map.error_title')}</h2>
          <p className="text-sm text-slate-500">
            {error || t('sr.map.no_rep_account')}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-4 px-5 rounded-b-[2rem]">
        <div className="pt-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t('sr.nav.map')}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 w-8 h-8"
                onClick={() => loadData()}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Date Selector */}
          <div className="flex items-center justify-between bg-white/10 rounded-2xl px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 w-8 h-8"
              onClick={() => changeDate(1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-200" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-0 text-white text-center text-sm font-medium h-8 w-36 p-0 [color-scheme:dark]"
              />
              {isToday && (
                <Badge className="bg-white/20 text-white text-[10px] border-0">{t('sr.map.today')}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 w-8 h-8"
              onClick={() => changeDate(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Day Stats */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold">{totalVisits}</div>
              <div className="text-[10px] text-blue-200">{t('sr.map.visits_unit')}</div>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold">{completedVisits}</div>
              <div className="text-[10px] text-blue-200">{t('sr.status.completed')}</div>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold">{ordersCount}</div>
              <div className="text-[10px] text-blue-200">{t('sr.map.orders_unit')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="px-4 -mt-4 relative z-10">
        <Card className="p-2 flex items-center justify-between gap-2 rounded-2xl shadow-md border-0">
          <Button
            variant={showRoute ? "default" : "outline"}
            size="sm"
            className={`text-xs rounded-xl h-8 ${showRoute ? "bg-blue-600 hover:bg-blue-700" : "bg-transparent"}`}
            onClick={() => setShowRoute(!showRoute)}
          >
            {showRoute ? <Eye className="w-3 h-3 ml-1" /> : <EyeOff className="w-3 h-3 ml-1" />}
            {t('sr.nav.route')}
          </Button>

          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-600 border-2 border-white shadow" />
              {t('sr.status.completed')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow" />
              {t('sr.status.in_progress')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-slate-400 border-2 border-white shadow" />
              {t('sr.status.scheduled')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-400 border-4 border-blue-200" />
              {t('sr.map.my_location')}
            </span>
          </div>

          {myLocation && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-xl h-8 bg-transparent"
              onClick={goToMyLocation}
            >
              <Locate className="w-3 h-3 ml-1" />
              {t('sr.map.my_location')}
            </Button>
          )}
        </Card>
      </div>

      {/* Map Container */}
      <div className="px-4 mt-3">
        {loading ? (
          <Card className="rounded-2xl overflow-hidden border-0 shadow-md">
            <div className="h-[45vh] bg-slate-100 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('sr.map.loading_map')}</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="rounded-2xl overflow-hidden border-0 shadow-md">
            <div ref={mapContainerRef} style={{ height: "45vh", minHeight: "300px" }} />
          </Card>
        )}
      </div>

      {/* Visits List */}
      <div className="px-4 mt-4 space-y-2">
        <h3 className="font-bold text-base text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          {t('sr.common.today_visits')}
        </h3>

        {visits.length === 0 ? (
          <Card className="p-6 text-center rounded-2xl border border-slate-200">
            <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">{t('sr.map.no_visits')}</p>
          </Card>
        ) : (
          visits.map((visit, idx) => {
            const customerObj = customers.find(c => c.name === visit.customer)
            const customerName = customerObj?.customer_name || visit.customer
            const status = VISIT_STATUS_MAP[visit.visit_status] || VISIT_STATUS_MAP.Scheduled
            const timeIn = visit.check_in_time
              ? new Date(visit.check_in_time).toLocaleTimeString(dl, { hour: "2-digit", minute: "2-digit" })
              : null
            const timeOut = visit.check_out_time
              ? new Date(visit.check_out_time).toLocaleTimeString(dl, { hour: "2-digit", minute: "2-digit" })
              : null

            return (
              <Card
                key={visit.name}
                className="p-3 rounded-2xl border border-slate-200 cursor-pointer hover:shadow-md transition-all"
                onClick={() => {
                  // Zoom to visit on map
                  const lat = parseFloat(visit.check_in_lat || "")
                  const lng = parseFloat(visit.check_in_lng || "")
                  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && mapRef.current) {
                    mapRef.current.setView([lat, lng], 16)
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: status.markerColor }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm truncate">{customerName}</h4>
                      <Badge className={`text-[10px] ${status.color}`}>{statusLabel(visit.visit_status)}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      {timeIn && (
                        <span className="flex items-center gap-0.5">
                          <ArrowRight className="w-3 h-3 text-emerald-500" />
                          {timeIn}
                        </span>
                      )}
                      {timeOut && (
                        <span className="flex items-center gap-0.5">
                          <ArrowRight className="w-3 h-3 text-red-400 rotate-180" />
                          {timeOut}
                        </span>
                      )}
                      {visit.visit_duration && (
                        <span>{t('sr.map.duration_min').replace('{n}', String(visit.visit_duration))}</span>
                      )}
                      {visit.has_order === 1 && (
                        <Badge className="bg-emerald-50 text-emerald-600 text-[9px] border-0">{t('sr.map.order_badge_check')}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
