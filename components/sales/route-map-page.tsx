/**
 * Route Map Page — Standalone real-time route tracking map
 * Shows all sales reps' live positions (30s presence polling), planned routes,
 * customer positions, assigned work zones, and the selected rep's GPS trail.
 */

'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { salesApi, type SalesPerson, type Customer, type DailyRoutePlan, type RepStatus, type RepZone, type RepLocationPoint, localDateISO } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { displayLocale } from '@/lib/sales-format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  RefreshCw, MapPin, User, Calendar, Navigation, Layers,
  Eye, EyeOff, Locate, Clock,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default markers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const REP_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#2563eb', '#db2777', '#65a30d']
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753] // Riyadh
const DEFAULT_ZOOM = 10
const STATUS_POLL_MS = 30_000

function createRepIcon(color: string, name: string, online: boolean) {
  return L.divIcon({
    className: 'rep-marker',
    html: `<div class="${online ? 'sr-rep-online' : ''}" style="
      width:36px;height:36px;border-radius:50%;
      background:${online ? color : '#9ca3af'};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:700;
      border:3px solid ${online ? '#22c55e' : '#fff'};box-shadow:0 2px 8px rgba(0,0,0,.35);
    ">${name.charAt(0).toUpperCase()}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function createCustomerIcon(hasGPS: boolean) {
  const color = hasGPS ? '#059669' : '#9ca3af'
  return L.divIcon({
    className: 'customer-marker',
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${color};
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  })
}

/** GeoJSON Polygon ring ([lng,lat]) → leaflet latlngs ([lat,lng]) */
function zoneToLatLngs(zone: RepZone): [number, number][] | null {
  try {
    const parsed = JSON.parse(zone.zone_polygon)
    const ring = parsed?.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length < 3) return null
    return ring.map((pos: number[]) => [Number(pos[1]), Number(pos[0])] as [number, number])
  } catch { return null }
}

export function RouteMapPage() {
  const { isRTL, t, lang } = useI18n()
  const { toast } = useToast()
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const repLayerRef = useRef<L.LayerGroup | null>(null)
  const customerLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const zoneLayerRef = useRef<L.LayerGroup | null>(null)
  const trailLayerRef = useRef<L.LayerGroup | null>(null)

  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routePlans, setRoutePlans] = useState<DailyRoutePlan[]>([])
  const [repsStatus, setRepsStatus] = useState<RepStatus[]>([])
  const [zones, setZones] = useState<RepZone[]>([])
  const [trail, setTrail] = useState<RepLocationPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(localDateISO())
  const [selectedRep, setSelectedRep] = useState('all')
  const [showCustomers, setShowCustomers] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [showTrail, setShowTrail] = useState(true)

  const dl = displayLocale(lang)

  const statusByName = useMemo(() => {
    const m: Record<string, RepStatus> = {}
    repsStatus.forEach(s => { m[s.name] = s })
    return m
  }, [repsStatus])

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [reps, custs, plans, status, zoneRows] = await Promise.all([
        // leaf reps only — the "Sales Team" group node is not a trackable person
        salesApi.getSalesPersons({ filters: [['Sales Person', 'enabled', '=', 1], ['Sales Person', 'is_group', '=', 0]] }),
        salesApi.getCustomers({ fields: ['name', 'customer_name', 'customer_lat', 'customer_lng', 'primary_sales_person', 'territory'] }),
        salesApi.getRoutePlans({ filters: [['Daily Route Plan', 'route_date', '=', selectedDate]] }).catch(() => []),
        salesApi.getRepsStatus().catch(() => [] as RepStatus[]),
        salesApi.getRepZones().catch(() => [] as RepZone[]),
      ])
      setSalesPersons(reps)
      setCustomers(custs)
      setRoutePlans(plans)
      setRepsStatus(status)
      setZones(zoneRows)
    } catch (e) {
      toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [selectedDate, toast])

  useEffect(() => { loadData() }, [loadData])

  // Live presence: refresh rep status every 30s (cheap — status only)
  useEffect(() => {
    const id = setInterval(() => {
      salesApi.getRepsStatus().then(setRepsStatus).catch(() => {})
    }, STATUS_POLL_MS)
    return () => clearInterval(id)
  }, [])

  // Init map — depends on `loading` so it re-runs once the skeleton is replaced by the real container
  useEffect(() => {
    if (loading || !containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)
    zoneLayerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)
    trailLayerRef.current = L.layerGroup().addTo(map)
    customerLayerRef.current = L.layerGroup().addTo(map)
    repLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // Fix rendering when container has just been mounted
    const resizeTimer = setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(resizeTimer)
      map.remove()
      mapRef.current = null
      repLayerRef.current = null
      customerLayerRef.current = null
      routeLayerRef.current = null
      zoneLayerRef.current = null
      trailLayerRef.current = null
    }
  }, [loading])

  // Rep markers — separate effect so the 30s presence poll moves markers
  // without re-fetching route plans
  useEffect(() => {
    if (!mapRef.current || !repLayerRef.current) return
    repLayerRef.current.clearLayers()
    const filteredReps = selectedRep === 'all' ? salesPersons : salesPersons.filter(r => r.name === selectedRep)
    filteredReps.forEach((rep, idx) => {
      const st = statusByName[rep.name]
      const lat = parseFloat(st?.current_location_lat || rep.current_location_lat || '')
      const lng = parseFloat(st?.current_location_lng || rep.current_location_lng || '')
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const online = st?.online ?? false
        const color = REP_COLORS[idx % REP_COLORS.length]
        const marker = L.marker([lat, lng], { icon: createRepIcon(color, rep.sales_person_name || rep.name, online) })
        const updated = st?.location_last_updated || rep.location_last_updated
        marker.bindPopup(`
          <div style="min-width:170px">
            <strong>${rep.sales_person_name || rep.name}</strong>
            <span style="display:inline-block;padding:1px 7px;border-radius:9999px;font-size:10px;margin-inline-start:6px;
              background:${online ? '#dcfce7' : '#f3f4f6'};color:${online ? '#15803d' : '#6b7280'}">
              ${online ? t('sr.admin.map.online') : t('sr.admin.map.offline')}
            </span><br/>
            <small style="color:#666">
              ${updated ? t('sr.admin.map.popup_updated').replace('{date}', new Date(updated).toLocaleString(dl)) : t('sr.admin.map.popup_no_update')}
            </small><br/>
            <small style="color:#666">${rep.inventory_warehouse ? t('sr.admin.map.popup_warehouse').replace('{name}', rep.inventory_warehouse) : ''}</small>
          </div>
        `)
        repLayerRef.current!.addLayer(marker)
      }
    })
  }, [salesPersons, statusByName, selectedRep, loading, t, dl])

  // Work zones layer
  useEffect(() => {
    if (!mapRef.current || !zoneLayerRef.current) return
    zoneLayerRef.current.clearLayers()
    if (!showZones) return
    const visible = selectedRep === 'all' ? zones : zones.filter(z => z.name === selectedRep)
    visible.forEach(zone => {
      const latlngs = zoneToLatLngs(zone)
      if (!latlngs) return
      const color = zone.zone_color || '#7c3aed'
      const poly = L.polygon(latlngs, { color, weight: 2, opacity: 0.85, fillColor: color, fillOpacity: 0.12 })
      poly.bindTooltip(
        `${zone.zone_name ? zone.zone_name + ' — ' : ''}${zone.sales_person_name || zone.name}`,
        { sticky: true }
      )
      zoneLayerRef.current!.addLayer(poly)
    })
  }, [zones, showZones, selectedRep, loading])

  // GPS trail for the selected rep on the selected date
  useEffect(() => {
    setTrail([])
    if (!showTrail || selectedRep === 'all') return
    const employee = statusByName[selectedRep]?.employee
      || salesPersons.find(r => r.name === selectedRep)?.employee
    if (!employee) return
    let cancelled = false
    salesApi.getRepLocations(employee, selectedDate)
      .then(points => { if (!cancelled) setTrail(points) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedRep, selectedDate, showTrail, statusByName, salesPersons])

  useEffect(() => {
    if (!mapRef.current || !trailLayerRef.current) return
    trailLayerRef.current.clearLayers()
    if (!showTrail || trail.length === 0) return
    const coords = trail
      .map(p => [Number(p.latitude), Number(p.longitude)] as [number, number])
      .filter(c => !isNaN(c[0]) && !isNaN(c[1]) && c[0] !== 0 && c[1] !== 0)
    if (coords.length < 2) return
    L.polyline(coords, { color: '#334155', weight: 3, opacity: 0.75 }).addTo(trailLayerRef.current)
    // start / end dots
    L.circleMarker(coords[0], { radius: 5, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 }).addTo(trailLayerRef.current)
    L.circleMarker(coords[coords.length - 1], { radius: 5, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1 }).addTo(trailLayerRef.current)
  }, [trail, showTrail, loading])

  // Render customer + route layers whenever data changes
  useEffect(() => {
    if (!mapRef.current) return
    const renderMarkers = async () => {
    const bounds: [number, number][] = []

    // Bounds seed from rep positions (markers themselves live in their own layer effect)
    const boundReps = selectedRep === 'all' ? salesPersons : salesPersons.filter(r => r.name === selectedRep)
    boundReps.forEach(rep => {
      const st = statusByName[rep.name]
      const lat = parseFloat(st?.current_location_lat || rep.current_location_lat || '')
      const lng = parseFloat(st?.current_location_lng || rep.current_location_lng || '')
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) bounds.push([lat, lng])
    })

    // Customer markers
    if (customerLayerRef.current) {
      customerLayerRef.current.clearLayers()
      if (showCustomers) {
        const filteredCustomers = selectedRep === 'all'
          ? customers
          : customers.filter(c => c.primary_sales_person === selectedRep)
        filteredCustomers.forEach(c => {
          const lat = parseFloat(c.customer_lat || '')
          const lng = parseFloat(c.customer_lng || '')
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            const marker = L.marker([lat, lng], { icon: createCustomerIcon(true) })
            marker.bindPopup(`
              <div style="min-width:140px">
                <strong>${c.customer_name}</strong><br/>
                <small style="color:#666">${c.territory || ''}</small><br/>
                <small style="color:#666">${t('sr.admin.map.popup_rep').replace('{name}', c.primary_sales_person || '—')}</small>
              </div>
            `)
            customerLayerRef.current!.addLayer(marker)
            bounds.push([lat, lng])
          }
        })
      }
    }

    // Route lines
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers()
      if (showRoutes) {
        const filteredPlans = selectedRep === 'all'
          ? routePlans
          : routePlans.filter(rp => rp.sales_person === selectedRep)
        for (const [pIdx, plan] of filteredPlans.entries()) {
          try {
            const fullPlan = await salesApi.getRoutePlan(plan.name)
            if (!fullPlan?.customers) continue
            const coords: [number, number][] = []
            fullPlan.customers
              .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
              .forEach(stop => {
                const cust = customers.find(c => c.name === stop.customer)
                const lat = parseFloat(cust?.customer_lat || '')
                const lng = parseFloat(cust?.customer_lng || '')
                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                  coords.push([lat, lng])
                }
              })
            if (coords.length > 1) {
              const color = REP_COLORS[pIdx % REP_COLORS.length]
              L.polyline(coords, { color, weight: 3, opacity: 0.7, dashArray: '8, 6' })
                .addTo(routeLayerRef.current!)
            }
          } catch { /* ignore failed plan loads */ }
        }
      }
    }

    // Fit bounds
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
    }
    renderMarkers()
    // statusByName intentionally NOT a dep — presence polls must not re-fetch route plans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesPersons, customers, routePlans, selectedRep, showCustomers, showRoutes])

  // Stats
  const onlineCount = repsStatus.filter(r => r.online).length
  const customersWithGPS = customers.filter(c => c.customer_lat && c.customer_lng).length

  const lastSeenLabel = (rep: SalesPerson): string | null => {
    const st = statusByName[rep.name]
    const seen = st?.last_seen || st?.location_last_updated || rep.location_last_updated
    if (!seen) return null
    try {
      return t('sr.admin.map.last_seen').replace('{time}', new Date(seen.replace(' ', 'T')).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }))
    } catch { return null }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[calc(100vh-220px)] rounded-xl" />
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      <style>{`
        @keyframes srPulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); }
          70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .sr-rep-online { animation: srPulse 2s infinite; }
      `}</style>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.nav.route_map')}</h1>
          <p className="text-sm text-gray-500">{t('sr.admin.map.subtitle')} · {t('sr.admin.map.auto_refresh')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue placeholder={t('sr.admin.common.all_reps')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.common.all_reps')}</SelectItem>
                {salesPersons.map(sp => (
                  <SelectItem key={sp.name} value={sp.name}>{sp.sales_person_name || sp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-8 w-40 text-sm" />
            </div>

            <Button
              variant={showCustomers ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 text-xs', showCustomers && 'bg-emerald-600 hover:bg-emerald-700')}
              onClick={() => setShowCustomers(!showCustomers)}
            >
              {showCustomers ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
              {t('sr.admin.nav.customers')}
            </Button>

            <Button
              variant={showRoutes ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 text-xs', showRoutes && 'bg-cyan-600 hover:bg-cyan-700')}
              onClick={() => setShowRoutes(!showRoutes)}
            >
              {showRoutes ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
              {t('sr.admin.map.routes')}
            </Button>

            <Button
              variant={showZones ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 text-xs', showZones && 'bg-violet-600 hover:bg-violet-700')}
              onClick={() => setShowZones(!showZones)}
            >
              <Layers className="h-3.5 w-3.5 mr-1" />
              {t('sr.admin.map.zones')}
            </Button>

            <Button
              variant={showTrail ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 text-xs', showTrail && 'bg-slate-700 hover:bg-slate-800')}
              onClick={() => setShowTrail(!showTrail)}
            >
              <Locate className="h-3.5 w-3.5 mr-1" />
              {t('sr.admin.map.trail')}
            </Button>

            <div className="flex items-center gap-3 ml-auto text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" /> {t('sr.admin.map.online')} ({onlineCount}/{salesPersons.length})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 border-2 border-white shadow" /> {t('sr.admin.map.legend_customers')} ({customersWithGPS})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 border-t-2 border-dashed border-cyan-500" /> {t('sr.admin.map.legend_routes')} ({routePlans.length})
              </span>
            </div>
          </div>
          {selectedRep !== 'all' && showTrail && (
            <p className="text-[11px] text-gray-400 mt-2">
              {trail.length > 1
                ? t('sr.admin.map.trail_points').replace('{n}', String(trail.length))
                : t('sr.admin.map.trail_none')}
            </p>
          )}
          {selectedRep === 'all' && showTrail && (
            <p className="text-[11px] text-gray-400 mt-2">{t('sr.admin.map.select_rep_for_trail')}</p>
          )}
        </CardContent>
      </Card>

      {/* Map */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div ref={containerRef} style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }} />
      </Card>

      {/* Rep Cards */}
      {salesPersons.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {salesPersons.slice(0, 8).map((rep, idx) => {
            const st = statusByName[rep.name]
            const online = st?.online ?? false
            const hasLoc = !!((st?.current_location_lat || rep.current_location_lat) && (st?.current_location_lng || rep.current_location_lng))
            const seenLabel = lastSeenLabel(rep)
            const assignedCustomers = customers.filter(c => c.primary_sales_person === rep.name).length
            const todayPlans = routePlans.filter(rp => rp.sales_person === rep.name)
            return (
              <Card
                key={rep.name}
                className={cn(
                  'border-0 shadow-sm cursor-pointer transition-all hover:shadow-md',
                  selectedRep === rep.name && 'ring-2 ring-violet-400'
                )}
                onClick={() => setSelectedRep(selectedRep === rep.name ? 'all' : rep.name)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: online ? REP_COLORS[idx % REP_COLORS.length] : '#9ca3af' }}
                      >
                        {(rep.sales_person_name || rep.name).charAt(0)}
                      </div>
                      <span className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                        online ? 'bg-emerald-500' : 'bg-gray-300'
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">{rep.sales_person_name || rep.name}</p>
                      <div className="flex items-center gap-1">
                        {online ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">
                            <Navigation className="h-2.5 w-2.5 mr-0.5" /> {t('sr.admin.map.online')}
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 text-[9px]">{t('sr.admin.map.offline')}</Badge>
                        )}
                        {online && !hasLoc && (
                          <Badge className="bg-amber-50 text-amber-600 text-[9px]">{t('sr.admin.map.no_location')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>{assignedCustomers} {t('sr.admin.map.clients_unit')}</span>
                    <span>{todayPlans.length} {t('sr.admin.map.routes_unit')}</span>
                  </div>
                  {!online && seenLabel && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {seenLabel}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
