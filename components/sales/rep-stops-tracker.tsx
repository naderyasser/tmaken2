/**
 * Rep Stops Tracker - Track sales rep GPS stops/dwells
 * Shows where a rep actually stopped during their route (not just formal visits).
 * Useful for monitoring if a rep is going to actual POS locations vs other places.
 *
 * Data source: hrms Employee Location Log, fed by the rep PWA's GPS broadcaster
 * (update_sales_person_location writes a throttled log row per ping).
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { salesApi, type SalesPerson, type RepLocationPoint, type RepStop, localDateISO } from '@/lib/sales-api'
import { calculateTrackStats } from '@/lib/location-utils'
import { useI18n } from '@/lib/i18n'
import { displayLocale } from '@/lib/sales-format'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin, Clock, Search, Loader2, Timer, Building2, AlertTriangle,
  Navigation, ArrowDownUp, CircleStop, Play, MapPinOff
} from 'lucide-react'

const StopsRouteMap = dynamic(() => import('@/components/sales/stops-route-map'), {
  ssr: false,
  loading: () => <div className="h-[500px] rounded-lg bg-gray-100 animate-pulse" />,
})

// ==================== StatCard ====================

function StatCard({ icon: Icon, label, value, color, subtitle }: {
  icon: any
  label: string
  value: string | number
  color: string
  subtitle?: string
}) {
  return (
    <div className={cn('rounded-xl p-4 border', color)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 opacity-70" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs opacity-60 mt-0.5">{subtitle}</div>}
    </div>
  )
}

// ==================== Main Component ====================

export function RepStopsTracker() {
  const { isRTL, t, lang } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()

  const dl = displayLocale(lang)

  const formatTime = useCallback((datetime: string): string => {
    try {
      const d = new Date(datetime)
      return d.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return datetime
    }
  }, [dl])

  const formatDuration = useCallback((minutes: number): string => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h > 0) return `${h}${t('sr.admin.stops.hour_abbr')} ${m}${t('sr.admin.stops.min_abbr')}`
    return `${m}${t('sr.admin.stops.min_abbr')}`
  }, [t])

  const getDurationColor = (minutes: number): string => {
    if (minutes >= 60) return 'bg-red-100 text-red-700 border-red-200'
    if (minutes >= 30) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (minutes >= 10) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-green-100 text-green-700 border-green-200'
  }

  // Data
  const [reps, setReps] = useState<SalesPerson[]>([])
  const [loadingReps, setLoadingReps] = useState(true)

  // Controls
  const [selectedRep, setSelectedRep] = useState('')
  const [selectedDate, setSelectedDate] = useState(localDateISO())
  const [minDuration, setMinDuration] = useState(3)
  const [radiusMeters, setRadiusMeters] = useState(50)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Results
  const [stops, setStops] = useState<RepStop[]>([])
  const [routeLocations, setRouteLocations] = useState<RepLocationPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Selected stop to highlight on map
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null)

  // Load sales reps
  useEffect(() => {
    async function loadReps() {
      try {
        setLoadingReps(true)
        const data = await salesApi.getSalesPersons({ company: activeCompany || undefined })
        setReps(data.filter(r => r.enabled === 1))
      } catch {
        toast({
          title: t('sr.admin.common.error_title'),
          description: t('sr.admin.stops.err_load_reps'),
          variant: 'destructive'
        })
      } finally {
        setLoadingReps(false)
      }
    }
    loadReps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany, toast])

  // The employee ID linked to the selected sales person
  const selectedEmployee = useMemo(() => {
    const rep = reps.find(r => r.name === selectedRep)
    return rep?.employee || ''
  }, [reps, selectedRep])

  const selectedRepName = useMemo(() => {
    const rep = reps.find(r => r.name === selectedRep)
    return rep?.sales_person_name || ''
  }, [reps, selectedRep])

  // Analyze stops
  const analyzeStops = useCallback(async () => {
    if (!selectedEmployee) {
      toast({
        title: t('sr.admin.common.error_title'),
        description: t('sr.admin.stops.err_no_employee'),
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      setHasSearched(true)
      setSelectedStopIndex(null)

      // Fetch both stops and full route in parallel
      const [stopsResult, locationsResult] = await Promise.all([
        salesApi.detectRepStops(selectedEmployee, {
          date: selectedDate,
          radius_meters: radiusMeters,
          min_duration_minutes: minDuration,
        }),
        salesApi.getRepLocations(selectedEmployee, selectedDate),
      ])

      setStops(stopsResult)
      setRouteLocations(locationsResult)

      if (stopsResult.length === 0 && locationsResult.length === 0) {
        toast({
          title: t('sr.admin.stops.toast_no_data_title'),
          description: t('sr.admin.stops.toast_no_data_desc'),
        })
      } else if (stopsResult.length === 0) {
        toast({
          title: t('sr.admin.stops.toast_no_stops_title'),
          description: t('sr.admin.stops.toast_no_stops_desc')
            .replace('{n}', String(locationsResult.length))
            .replace('{m}', String(minDuration)),
        })
      }
    } catch {
      toast({
        title: t('sr.admin.common.error_title'),
        description: t('sr.admin.stops.err_analyze'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [selectedEmployee, selectedDate, radiusMeters, minDuration, toast, t])

  // Statistics
  const stats = useMemo(() => {
    if (stops.length === 0) return null
    const totalMinutes = stops.reduce((sum, s) => sum + s.duration_minutes, 0)
    const customerStops = stops.filter(s => s.customer)
    const unknownStops = stops.filter(s => !s.customer)
    const maxStop = Math.max(...stops.map(s => s.duration_minutes))
    const routeStats = routeLocations.length > 0 ? calculateTrackStats(routeLocations as any) : null
    return { totalMinutes, customerStops: customerStops.length, unknownStops: unknownStops.length, maxStop, routeStats }
  }, [stops, routeLocations])

  // Prepare stop markers for the custom map
  const stopMarkers = useMemo(() => {
    return stops.map((s, i) => ({
      index: i,
      center_lat: s.center_lat,
      center_lng: s.center_lng,
      arrival: s.arrival,
      departure: s.departure,
      duration_minutes: s.duration_minutes,
      points_count: s.points_count,
      customer_name: s.customer_name,
      distance_to_customer: s.distance_to_customer,
    }))
  }, [stops])

  // ==================== Render ====================

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CircleStop className="h-6 w-6 text-amber-600" />
            {t('sr.admin.stops.title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('sr.admin.stops.subtitle')}
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Rep selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">
                {t('sr.admin.common.sales_rep')}
              </Label>
              {loadingReps ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedRep} onValueChange={setSelectedRep}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('sr.admin.stops.select_rep')} />
                  </SelectTrigger>
                  <SelectContent>
                    {reps.map((rep) => (
                      <SelectItem key={rep.name} value={rep.name}>
                        <div className="flex items-center gap-2">
                          <span>{rep.sales_person_name}</span>
                          {!rep.employee && (
                            <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                              {t('sr.admin.stops.no_employee_badge')}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">
                {t('sr.admin.common.date')}
              </Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Analyze button */}
            <Button
              onClick={analyzeStops}
              disabled={loading || !selectedRep}
              className="bg-amber-600 hover:bg-amber-700 gap-2 h-9"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t('sr.admin.stops.analyze')}
            </Button>
            {!selectedRep && (
              <p className="text-[11px] text-amber-600 self-center">{t('sr.admin.stops.select_rep_hint')}</p>
            )}

            {/* Advanced toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-gray-500 hover:text-gray-700 h-9"
            >
              <ArrowDownUp className="h-3.5 w-3.5 mr-1" />
              {t('sr.admin.stops.advanced')}
            </Button>
          </div>

          {/* Advanced settings */}
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  {t('sr.admin.stops.min_duration')}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={minDuration}
                  onChange={(e) => setMinDuration(Number(e.target.value))}
                />
                <p className="text-[11px] text-gray-400">
                  {t('sr.admin.stops.min_duration_hint')}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  {t('sr.admin.stops.radius')}
                </Label>
                <Input
                  type="number"
                  min={10}
                  max={200}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                />
                <p className="text-[11px] text-gray-400">
                  {t('sr.admin.stops.radius_hint')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No employee warning */}
      {selectedRep && !selectedEmployee && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                {t('sr.admin.stops.no_employee_title')}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {t('sr.admin.stops.no_employee_desc')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <>
          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard
                icon={CircleStop}
                label={t('sr.admin.stops.stat_total')}
                value={stops.length}
                color="bg-amber-50 text-amber-700 border-amber-200"
              />
              <StatCard
                icon={Clock}
                label={t('sr.admin.stops.stat_time')}
                value={formatDuration(stats.totalMinutes)}
                color="bg-blue-50 text-blue-700 border-blue-200"
              />
              <StatCard
                icon={Building2}
                label={t('sr.admin.stops.stat_customers')}
                value={stats.customerStops}
                color="bg-green-50 text-green-700 border-green-200"
                subtitle={t('sr.admin.stops.stat_customers_sub')}
              />
              <StatCard
                icon={MapPinOff}
                label={t('sr.admin.stops.stat_other')}
                value={stats.unknownStops}
                color={stats.unknownStops > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}
                subtitle={t('sr.admin.stops.stat_other_sub')}
              />
              <StatCard
                icon={Navigation}
                label={t('sr.admin.stops.stat_points')}
                value={routeLocations.length}
                color="bg-violet-50 text-violet-700 border-violet-200"
                subtitle={stats.routeStats ? `${stats.routeStats.totalDistanceKm.toFixed(1)} km` : undefined}
              />
            </div>
          )}

          {/* Map: Route + Stops combined */}
          {(stops.length > 0 || routeLocations.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5 text-amber-600" />
                  {t('sr.admin.stops.map_title').replace('{name}', selectedRepName)}
                  <Badge variant="outline" className="text-[11px]">{selectedDate}</Badge>
                  {routeLocations.length > 0 && (
                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
                      {routeLocations.length} {t('sr.admin.stops.pts_unit')}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('sr.admin.stops.map_desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StopsRouteMap
                  key={`route-stops-${selectedRep}-${selectedDate}-${stops.length}`}
                  routePoints={routeLocations}
                  stops={stopMarkers}
                  showRoute={routeLocations.length > 1}
                  highlightedStop={selectedStopIndex}
                  height="500px"
                />
              </CardContent>
            </Card>
          )}

          {/* Stops table */}
          {stops.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Timer className="h-4.5 w-4.5 text-amber-600" />
                  {t('sr.admin.stops.details_title')}
                  <Badge className="bg-amber-100 text-amber-700 text-[11px]">{stops.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('sr.admin.stops.details_desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className={cn('w-10', isRTL && 'text-right')}>#</TableHead>
                        <TableHead className={cn(isRTL && 'text-right')}>
                          {t('sr.admin.stops.th_arrival')}
                        </TableHead>
                        <TableHead className={cn(isRTL && 'text-right')}>
                          {t('sr.admin.stops.th_departure')}
                        </TableHead>
                        <TableHead className={cn(isRTL && 'text-right')}>
                          {t('sr.admin.stops.th_duration')}
                        </TableHead>
                        <TableHead className={cn(isRTL && 'text-right')}>
                          {t('sr.admin.stops.th_location')}
                        </TableHead>
                        <TableHead className={cn(isRTL && 'text-right')}>
                          {t('sr.admin.stops.th_distance')}
                        </TableHead>
                        <TableHead className={cn('w-16', isRTL && 'text-right')}>
                          {t('sr.admin.stops.th_points')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stops.map((stop, index) => {
                        const isCustomer = !!stop.customer
                        const isLong = stop.duration_minutes >= 30
                        const isSelected = selectedStopIndex === index
                        // Duration bar width (max at 60 min = 100%)
                        const durBarPct = Math.min(100, (stop.duration_minutes / 60) * 100)

                        return (
                          <TableRow
                            key={index}
                            className={cn(
                              'cursor-pointer transition-all duration-150',
                              !isCustomer && 'bg-red-50/40',
                              isSelected && 'bg-amber-50 ring-2 ring-amber-400 shadow-sm',
                              isLong && !isCustomer && 'bg-red-50/70'
                            )}
                            onClick={() => setSelectedStopIndex(isSelected ? null : index)}
                          >
                            <TableCell>
                              <div className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                                isCustomer
                                  ? 'bg-green-100 text-green-700 border-green-300'
                                  : 'bg-red-100 text-red-700 border-red-300'
                              )}>
                                {index + 1}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1.5">
                                <Play className="h-3 w-3 text-green-500 shrink-0" />
                                <span className="font-medium">{formatTime(stop.arrival)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1.5">
                                <CircleStop className="h-3 w-3 text-red-400 shrink-0" />
                                <span className="font-medium">{formatTime(stop.departure)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[140px]">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className={cn('text-sm font-bold', getDurationColor(stop.duration_minutes).replace(/bg-\S+/g, '').replace('border-', 'text-').split(' ').find(c => c.startsWith('text-')))}>
                                    {formatDuration(stop.duration_minutes)}
                                  </span>
                                  <Badge className={cn('text-[10px] border h-5', getDurationColor(stop.duration_minutes))}>
                                    {stop.duration_minutes >= 60 ? t('sr.admin.stops.dur_very_long') : stop.duration_minutes >= 30 ? t('sr.admin.stops.dur_long') : stop.duration_minutes >= 10 ? t('sr.admin.stops.dur_medium') : t('sr.admin.stops.dur_short')}
                                  </Badge>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      stop.duration_minutes >= 60 ? 'bg-red-500'
                                        : stop.duration_minutes >= 30 ? 'bg-orange-500'
                                        : stop.duration_minutes >= 10 ? 'bg-amber-500'
                                        : 'bg-green-500'
                                    )}
                                    style={{ width: `${durBarPct}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isCustomer ? (
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-sm font-medium text-green-700">
                                    {stop.customer_name}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                  <span className="text-sm text-red-600 font-medium">
                                    {t('sr.admin.stops.unknown_location')}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {stop.distance_to_customer != null
                                ? `${stop.distance_to_customer} ${t('sr.admin.stops.meters_unit')}`
                                : <span className="text-gray-300">—</span>
                              }
                            </TableCell>
                            <TableCell className="text-sm text-gray-400 text-center">
                              {stop.points_count}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary bar */}
                {stats && stats.unknownStops > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4.5 w-4.5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">
                        {t('sr.admin.stops.non_pos_summary').replace('{n}', String(stats.unknownStops))}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        {t('sr.admin.stops.non_pos_time').replace('{t}', formatDuration(stops.filter(s => !s.customer).reduce((sum, s) => sum + s.duration_minutes, 0)))}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {stops.length === 0 && routeLocations.length === 0 && (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <CircleStop className="h-14 w-14 mx-auto mb-3 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-500 mb-1">
                    {t('sr.admin.stops.empty_title')}
                  </h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    {t('sr.admin.stops.empty_desc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Has route but no stops */}
          {stops.length === 0 && routeLocations.length > 0 && (
            <Card>
              <CardContent className="py-6">
                <div className="text-center">
                  <Navigation className="h-10 w-10 mx-auto mb-3 text-blue-400" />
                  <h3 className="text-base font-medium text-gray-600 mb-1">
                    {t('sr.admin.stops.no_stops_title')}
                  </h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
                    {t('sr.admin.stops.no_stops_desc')
                      .replace('{n}', String(routeLocations.length))
                      .replace('{m}', String(minDuration))}
                  </p>
                </div>

                {/* Show route map anyway */}
                <div className="mt-4">
                  <StopsRouteMap
                    key={`route-only-${selectedRep}-${selectedDate}`}
                    routePoints={routeLocations}
                    stops={[]}
                    showRoute={true}
                    height="350px"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[450px] rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
    </div>
  )
}
