"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { I18nProvider, useI18n } from "@/lib/i18n"
import { formatTime } from '@/lib/format'
import { useAuth } from "@/lib/auth-context"
import { LoginPage } from "@/components/login-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  MapPin,
  Loader2,
  RefreshCw,
  Clock,
  Users,
  Search,
  Route,
  Gauge,
  History,
  Activity,
  Eye,
  ChevronLeft,
  ShieldAlert,
  Timer,
  Building2,
} from "lucide-react"
import { frappeClient } from "@/lib/api-client"
import type { LocationLog } from "@/lib/api-client"
import {
  calculateTrackStats,
  formatTimeAr,
  TRACK_COLORS,
  type TrackStats,
} from "@/lib/location-utils"
import dynamic from "next/dynamic"
import type { EmployeeTrack } from "@/components/LocationMap"

const LocationMap = dynamic(() => import("@/components/LocationMap"), {
  ssr: false,
})

// ==================== Types ====================

interface EmployeeWithLocations {
  id: string
  name: string
  locations: LocationLog[]
  stats: TrackStats | null
  lastSeen: string | null
  isOnline: boolean // has locations in last 30 min
  checkinStatus: "IN" | "OUT" | "NONE"
  lastCheckinTime: string | null
}

// ==================== Stat Card ====================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: string | number
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold text-foreground truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Auto-refresh interval (seconds) ====================

const REFRESH_INTERVAL = 15_000

// ==================== Main Page ====================

function LocationTrackingContent() {
  const { toast } = useToast()
  const { t, isRTL } = useI18n()

  // ---- Dashboard state ----
  const [allEmployees, setAllEmployees] = useState<EmployeeWithLocations[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // ---- Focus on one employee (from sidebar click) ----
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string | null>(null)

  // ---- Tab: dashboard (live) vs history ----
  const [activeTab, setActiveTab] = useState("dashboard")

  // ---- Historical view ----
  const [histEmployeeId, setHistEmployeeId] = useState("")
  const [histDate, setHistDate] = useState(new Date().toISOString().split("T")[0])
  const [histLocations, setHistLocations] = useState<LocationLog[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histStats, setHistStats] = useState<TrackStats | null>(null)

  // ---- Stops detection view ----
  const [stopsEmployeeId, setStopsEmployeeId] = useState("")
  const [stopsDate, setStopsDate] = useState(new Date().toISOString().split("T")[0])
  const [stopsLoading, setStopsLoading] = useState(false)
  const [stops, setStops] = useState<Array<{
    center_lat: number
    center_lng: number
    arrival: string
    departure: string
    duration_minutes: number
    points_count: number
    customer: string | null
    customer_name: string | null
    distance_to_customer: number | null
  }>>([])
  const getEmployeeTrackColor = useCallback((employeeId: string) => {
    let hash = 0
    for (let i = 0; i < employeeId.length; i++) {
      hash = (hash << 5) - hash + employeeId.charCodeAt(i)
      hash |= 0
    }
    return TRACK_COLORS[Math.abs(hash) % TRACK_COLORS.length]
  }, [])

  // ==================== Fetch all employees + locations ====================

  const fetchAllLocations = useCallback(async (showToast = false) => {
    try {
      const result = await frappeClient.getAllActiveEmployeeLocations()

      const now = new Date()
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)

      const processed: EmployeeWithLocations[] = result.employees.map((emp) => {
        const locs = result.locations[emp.name] || []
        const checkin = result.checkinStatus?.[emp.name] || { status: "NONE" as const }
        const stats = locs.length > 0 ? calculateTrackStats(locs) : null
        const lastLoc = locs.length > 0 ? locs[locs.length - 1] : null
        const lastSeenDate = lastLoc ? new Date(lastLoc.log_datetime) : null
        const isCheckedIn = checkin.status === "IN"
        const hasRecentLocation = lastSeenDate ? lastSeenDate >= thirtyMinAgo : false
        const isOnline = isCheckedIn || hasRecentLocation

        return {
          id: emp.name,
          name: emp.employee_name,
          locations: locs,
          stats,
          lastSeen: lastLoc?.log_datetime || null,
          isOnline,
          checkinStatus: checkin.status,
          lastCheckinTime: checkin.time || null,
        }
      })

      // Sort: online first, then by most recent activity
      processed.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1
        if (!a.isOnline && b.isOnline) return 1
        if (a.locations.length > 0 && b.locations.length === 0) return -1
        if (a.locations.length === 0 && b.locations.length > 0) return 1
        return 0
      })

      setAllEmployees(processed)
      setLastRefresh(new Date())

      if (showToast) {
        const onlineCount = processed.filter((e) => e.isOnline).length
        const withLocations = processed.filter((e) => e.locations.length > 0).length
        toast({
          title: `✅ ${t('location.updated')}`,
          description: `${onlineCount} ${t('location.employeesActiveWith')} ${withLocations} ${t('location.withMovementsToday')}`,
        })
      }
    } catch (error) {
      console.error("Error fetching locations:", error)
      if (showToast) {
        toast({
          title: t('location.error'),
          description: t('location.loadFailed'),
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // ---- Initial load + auto-refresh ----
  useEffect(() => {
    fetchAllLocations()

    refreshIntervalRef.current = setInterval(() => {
      fetchAllLocations()
    }, REFRESH_INTERVAL)

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [fetchAllLocations])

  // ==================== Derived data ====================

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return allEmployees
    const q = searchQuery.toLowerCase()
    return allEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
    )
  }, [allEmployees, searchQuery])

  const onlineEmployees = useMemo(
    () => allEmployees.filter((e) => e.isOnline),
    [allEmployees]
  )

  const employeesWithLocations = useMemo(
    () => allEmployees.filter((e) => e.locations.length > 0),
    [allEmployees]
  )

  const totalPoints = useMemo(
    () => allEmployees.reduce((sum, e) => sum + e.locations.length, 0),
    [allEmployees]
  )

  // ---- Tracks for the map ----
  const mapTracks: EmployeeTrack[] = useMemo(() => {
    // If focused on one employee, show only that employee
    if (focusedEmployeeId) {
      const emp = allEmployees.find((e) => e.id === focusedEmployeeId)
      if (emp && emp.locations.length > 0) {
        return [
          {
            employeeId: emp.id,
            employeeName: emp.name,
            color: getEmployeeTrackColor(emp.id),
            checkinStatus: emp.checkinStatus,
            lastCheckinTime: emp.lastCheckinTime,
            locations: emp.locations,
          },
        ]
      }
      return []
    }

    // Otherwise show all employees that have locations
    return employeesWithLocations.map((emp) => ({
      employeeId: emp.id,
      employeeName: emp.name,
      color: getEmployeeTrackColor(emp.id),
      checkinStatus: emp.checkinStatus,
      lastCheckinTime: emp.lastCheckinTime,
      locations: emp.locations,
    }))
  }, [allEmployees, employeesWithLocations, focusedEmployeeId, getEmployeeTrackColor])

  const focusedEmployee = focusedEmployeeId
    ? allEmployees.find((e) => e.id === focusedEmployeeId)
    : null

  // ==================== Historical ====================

  const loadHistoricalLocations = useCallback(async () => {
    if (!histEmployeeId) {
      toast({
        title: t('location.error'),
        description: t('location.selectEmployeeError'),
        variant: "destructive",
      })
      return
    }

    try {
      setHistLoading(true)
      const locations = await frappeClient.getEmployeeLocations(histEmployeeId, {
        date: histDate,
      })
      setHistLocations(locations)
      setHistStats(locations.length > 0 ? calculateTrackStats(locations) : null)

      if (locations.length === 0) {
        toast({
          title: t('location.noLocations'),
          description: t('location.noRecordsForDate'),
        })
      }
    } catch {
      toast({
        title: t('location.error'),
        description: t('location.loadFailed2'),
        variant: "destructive",
      })
    } finally {
      setHistLoading(false)
    }
  }, [histEmployeeId, histDate, toast])

  // ==================== Load Stops ====================

  const loadStops = useCallback(async () => {
    if (!stopsEmployeeId) {
      toast({
        title: "خطأ",
        description: "اختر موظف أولاً",
        variant: "destructive",
      })
      return
    }

    try {
      setStopsLoading(true)
      const result = await frappeClient.detectStops(stopsEmployeeId, {
        date: stopsDate,
      })
      setStops(result)

      if (result.length === 0) {
        toast({
          title: "لا توجد توقفات",
          description: "لم يتم العثور على توقفات في هذا التاريخ",
        })
      }
    } catch {
      toast({
        title: "خطأ",
        description: "فشل في تحليل التوقفات",
        variant: "destructive",
      })
    } finally {
      setStopsLoading(false)
    }
  }, [stopsEmployeeId, stopsDate, toast])

  // ==================== Render ====================

  return (
    <div className="space-y-5 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('location.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('location.subtitle')} — {t('location.autoUpdate')}{" "}
              {REFRESH_INTERVAL / 1000} {t('location.seconds')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1.5 text-sm animate-pulse">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full ml-2" />
            {t('location.autoRefresh')}
          </Badge>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground/70">
              {formatTime(lastRefresh)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllLocations(true)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t('location.refresh')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="dashboard" className="gap-2 text-sm">
            <Activity className="h-4 w-4" />
            {t('location.liveDashboard')}
          </TabsTrigger>
          <TabsTrigger value="stops" className="gap-2 text-sm">
            <Timer className="h-4 w-4" />
            التوقفات
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-sm">
            <History className="h-4 w-4" />
            {t('location.historyTab')}
          </TabsTrigger>
        </TabsList>

        {/* ====================== DASHBOARD TAB ====================== */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Users}
              label={t('location.totalEmployees')}
              value={allEmployees.length}
              color="bg-accent text-primary"
            />
            <StatCard
              icon={Activity}
              label={t('location.activeNow')}
              value={onlineEmployees.length}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              icon={MapPin}
              label={t('location.withMovements')}
              value={employeesWithLocations.length}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              icon={Route}
              label={t('location.totalPoints')}
              value={totalPoints}
              color="bg-orange-50 text-orange-600"
            />
          </div>

          {/* Main layout: sidebar + map */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ---- Sidebar: Employee List ---- */}
            <Card className="lg:col-span-4 xl:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t('location.employees')}</CardTitle>
                  {focusedEmployeeId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFocusedEmployeeId(null)}
                      className="gap-1 text-xs h-7"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      {t('location.viewAll')}
                    </Button>
                  )}
                </div>
                <Input
                  placeholder={t('location.searchEmployee')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                />
              </CardHeader>
              <CardContent className="p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground/70">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-0.5 max-h-[540px] overflow-y-auto">
                    {filteredEmployees.map((emp) => {
                      const isFocused = focusedEmployeeId === emp.id
                      const trackIdx = employeesWithLocations.findIndex(
                        (e) => e.id === emp.id
                      )
                      const trackColor =
                        trackIdx >= 0
                          ? getEmployeeTrackColor(emp.id)
                          : undefined

                      return (
                        <button
                          key={emp.id}
                          onClick={() =>
                            setFocusedEmployeeId(isFocused ? null : emp.id)
                          }
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-right transition-colors ${isFocused
                            ? "bg-accent border border-primary/20"
                            : "hover:bg-accent/50 border border-transparent"
                            }`}
                        >
                          {/* Status dot */}
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${emp.isOnline
                              ? "bg-green-500"
                              : emp.locations.length > 0
                                ? "bg-yellow-400"
                                : "bg-muted-foreground/30"
                              }`}
                          />

                          {/* Color indicator for map */}
                          {trackColor && (
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: trackColor }}
                            />
                          )}

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {emp.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                              <span>{emp.id}</span>
                              {emp.locations.length > 0 && (
                                <span>• {emp.locations.length} {t('location.point')}</span>
                              )}
                            </div>
                          </div>

                          {/* Last seen */}
                          <div className="text-left shrink-0">
                            {emp.checkinStatus === "IN" ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                                {t('location.inShift')}
                              </Badge>
                            ) : emp.checkinStatus === "OUT" ? (
                              <Badge className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0">
                                {t('location.outShift')}
                              </Badge>
                            ) : emp.isOnline ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">
                                {t('location.active')}
                              </Badge>
                            ) : emp.lastSeen ? (
                              <span className="text-[10px] text-muted-foreground/70">
                                {formatTimeAr(emp.lastSeen)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/40">
                                {t('location.noData')}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}

                    {filteredEmployees.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground/70">
                        {t('location.noResults')}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ---- Map Area ---- */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-3">
              {/* Focused employee stats */}
              {focusedEmployee && focusedEmployee.stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <StatCard
                    icon={MapPin}
                    label={t('location.trackingPoints')}
                    value={focusedEmployee.stats.totalPoints}
                    color="bg-accent text-primary"
                  />
                  <StatCard
                    icon={Route}
                    label={t('location.distance')}
                    value={`${focusedEmployee.stats.totalDistanceKm.toFixed(1)} ${t('common.km')}`}
                    color="bg-green-50 text-green-600"
                  />
                  <StatCard
                    icon={Clock}
                    label={t('location.duration')}
                    value={`${focusedEmployee.stats.durationHours}${t('common.h')} ${focusedEmployee.stats.durationMinutes}${t('common.m')}`}
                    color="bg-purple-50 text-purple-600"
                  />
                  <StatCard
                    icon={Gauge}
                    label={t('location.avgSpeed')}
                    value={`${focusedEmployee.stats.avgSpeedKmh.toFixed(1)} ${t('common.kmh')}`}
                    color="bg-orange-50 text-orange-600"
                  />
                </div>
              )}

              {/* Map */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {focusedEmployee ? (
                        <>
                          <Eye className="h-4 w-4 text-primary" />
                          {focusedEmployee.name}
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4 text-green-600" />
                          {t('location.allEmployees')} ({employeesWithLocations.length} {t('location.onMap')})
                        </>
                      )}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-xs text-muted-foreground/70 gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t('location.every')} {REFRESH_INTERVAL / 1000}ث
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {loading && allEmployees.length === 0 ? (
                    <div className="text-center py-20 bg-muted/40 rounded-xl">
                      <Loader2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/70 animate-spin" />
                      <p className="text-muted-foreground">
                        {t('location.loadingEmployees')}
                      </p>
                    </div>
                  ) : mapTracks.length === 0 ? (
                    <div className="text-center py-20 bg-muted/40 rounded-xl">
                      <MapPin className="h-14 w-14 mx-auto mb-3 text-muted-foreground/40" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-1">
                        {focusedEmployeeId
                          ? t('location.noMovementsEmployee')
                          : t('location.noMovementsToday')}
                      </h3>
                      <p className="text-sm text-muted-foreground/70">
                        {t('location.movementsWillAppear')}
                      </p>
                    </div>
                  ) : (
                    <LocationMap
                      key="live-location-map"
                      employeeTracks={mapTracks}
                      isLive={true}
                      showPath={true}
                      autoCenter={!!focusedEmployeeId}
                      height="550px"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Legend (only when showing all) */}
              {!focusedEmployeeId && mapTracks.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2 bg-card rounded-lg border text-xs">
                  {mapTracks.map((track) => (
                    <button
                      key={track.employeeId}
                      onClick={() => setFocusedEmployeeId(track.employeeId)}
                      className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: track.color }}
                      />
                      <span className="text-muted-foreground">{track.employeeName}</span>
                      <span className={`text-[10px] ${track.checkinStatus === "IN" ? "text-emerald-600" : track.checkinStatus === "OUT" ? "text-slate-500" : "text-muted-foreground/40"}`}>
                        {track.checkinStatus === "IN" ? t('location.inside') : track.checkinStatus === "OUT" ? t('location.outside') : "-"}
                      </span>
                      <span className="text-muted-foreground/40">
                        ({track.locations.length})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ====================== STOPS TAB ====================== */}
        <TabsContent value="stops" className="space-y-4 mt-4">
          {/* Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Timer className="h-5 w-5 text-amber-600" />
                تحليل التوقفات
              </CardTitle>
              <CardDescription>
                اكتشف الأماكن التي توقف فيها الموظف ومدة بقائه في كل مكان
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label>الموظف</Label>
                  <Select
                    value={stopsEmployeeId}
                    onValueChange={setStopsEmployeeId}
                  >
                    <SelectTrigger aria-label="اختر موظف">
                      <SelectValue placeholder="اختر موظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {allEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={stopsDate}
                    onChange={(e) => setStopsDate(e.target.value)}
                  />
                </div>
                <Button
                  onClick={loadStops}
                  disabled={stopsLoading || !stopsEmployeeId}
                  className="bg-amber-600 hover:bg-amber-700 gap-2"
                >
                  {stopsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  تحليل التوقفات
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats summary */}
          {stops.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={MapPin}
                label="عدد التوقفات"
                value={stops.length}
                color="bg-amber-50 text-amber-600"
              />
              <StatCard
                icon={Clock}
                label="إجمالي وقت التوقف"
                value={(() => {
                  const total = stops.reduce((s, st) => s + st.duration_minutes, 0)
                  const h = Math.floor(total / 60)
                  const m = Math.round(total % 60)
                  return h > 0 ? `${h}س ${m}د` : `${m}د`
                })()}
                color="bg-accent text-primary"
              />
              <StatCard
                icon={Building2}
                label="زيارات عملاء"
                value={stops.filter((s) => s.customer).length}
                color="bg-green-50 text-green-600"
              />
              <StatCard
                icon={Timer}
                label="أطول توقف"
                value={(() => {
                  const max = Math.max(...stops.map((s) => s.duration_minutes))
                  const h = Math.floor(max / 60)
                  const m = Math.round(max % 60)
                  return h > 0 ? `${h}س ${m}د` : `${m}د`
                })()}
                color="bg-purple-50 text-purple-600"
              />
            </div>
          )}

          {/* Map + Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                خريطة التوقفات ({stops.length} توقف)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stops.length === 0 ? (
                <div className="text-center py-16 bg-muted/40 rounded-xl">
                  <Timer className="h-14 w-14 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-1">
                    لا توجد توقفات
                  </h3>
                  <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                    اختر موظف وتاريخ ثم اضغط &quot;تحليل التوقفات&quot; لعرض الأماكن التي توقف فيها
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stop markers on map */}
                  <LocationMap
                    key={`stops-map-${stopsEmployeeId}-${stopsDate}-${stops.length}`}
                    locations={stops.map((s, i) => ({
                      name: `stop-${i}`,
                      log_datetime: s.arrival,
                      latitude: s.center_lat,
                      longitude: s.center_lng,
                      address: s.customer_name || `توقف ${i + 1}`,
                    }))}
                    isLive={false}
                    showPath={false}
                    autoCenter={false}
                    height="450px"
                  />

                  {/* Stops table */}
                  <div className="rounded-lg border max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">الوصول</TableHead>
                          <TableHead className="text-right">المغادرة</TableHead>
                          <TableHead className="text-right">المدة</TableHead>
                          <TableHead className="text-right">العميل / المكان</TableHead>
                          <TableHead className="text-right">المسافة</TableHead>
                          <TableHead className="text-right">نقاط GPS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stops.map((stop, index) => {
                          const h = Math.floor(stop.duration_minutes / 60)
                          const m = Math.round(stop.duration_minutes % 60)
                          const durationStr = h > 0 ? `${h}س ${m}د` : `${m}د`

                          return (
                            <TableRow key={index}>
                              <TableCell className="text-sm text-muted-foreground font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {formatTimeAr(stop.arrival)}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {formatTimeAr(stop.departure)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`text-xs ${stop.duration_minutes >= 30
                                      ? "bg-red-100 text-red-700"
                                      : stop.duration_minutes >= 10
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-green-100 text-green-700"
                                    }`}
                                >
                                  {durationStr}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {stop.customer_name ? (
                                  <div className="flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                    <span className="text-sm font-medium text-green-700">
                                      {stop.customer_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground/70">
                                    مكان غير معروف
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {stop.distance_to_customer != null
                                  ? `${stop.distance_to_customer}م`
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {stop.points_count}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== HISTORY TAB ====================== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                {t('location.historical')}
              </CardTitle>
              <CardDescription>
                {t('location.historicalDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label>{t('location.employee')}</Label>
                  <Select
                    value={histEmployeeId}
                    onValueChange={setHistEmployeeId}
                  >
                    <SelectTrigger aria-label={t('location.selectEmployee')}>
                      <SelectValue placeholder={t('location.selectEmployee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('location.date')}</Label>
                  <Input
                    type="date"
                    value={histDate}
                    onChange={(e) => setHistDate(e.target.value)}
                  />
                </div>
                <Button
                  onClick={loadHistoricalLocations}
                  disabled={histLoading || !histEmployeeId}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  {histLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {t('location.viewRoute')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Historical Stats */}
          {histStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={MapPin}
                label={t('location.trackingPoints')}
                value={histStats.totalPoints}
                color="bg-accent text-primary"
              />
              <StatCard
                icon={Route}
                label={t('location.totalDistance')}
                value={`${histStats.totalDistanceKm.toFixed(2)} ${t('common.km')}`}
                color="bg-green-50 text-green-600"
              />
              <StatCard
                icon={Clock}
                label={t('location.shiftDuration')}
                value={`${histStats.durationHours}${t('common.h')} ${histStats.durationMinutes}${t('common.m')}`}
                color="bg-purple-50 text-purple-600"
              />
              <StatCard
                icon={Gauge}
                label={t('location.avgSpeed')}
                value={`${histStats.avgSpeedKmh.toFixed(1)} ${t('common.kmh')}`}
                color="bg-orange-50 text-orange-600"
              />
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {t('location.route')} ({histLocations.length} {t('location.point')})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {histLocations.length === 0 ? (
                <div className="text-center py-16 bg-muted/40 rounded-xl">
                  <History className="h-14 w-14 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-1">
                    {t('location.noLocations')}
                  </h3>
                  <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                    {t('location.selectToView')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <LocationMap
                    key={`history-location-map-${histEmployeeId}-${histDate}`}
                    locations={histLocations}
                    isLive={false}
                    showPath={true}
                    autoCenter={false}
                    height="450px"
                  />

                  <div className="rounded-lg border max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">{t('location.time')}</TableHead>
                          <TableHead className="text-right">{t('location.type')}</TableHead>
                          <TableHead className="text-right">{t('location.latitude')}</TableHead>
                          <TableHead className="text-right">{t('location.longitude')}</TableHead>
                          <TableHead className="text-right">{t('location.accuracy')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {histLocations.map((location, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatTimeAr(location.log_datetime)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  location.address === "تسجيل دخول"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {location.address || t('location.location')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {location.latitude.toFixed(6)}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {location.longitude.toFixed(6)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {location.accuracy
                                ? `${location.accuracy.toFixed(0)}م`
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function LocationTrackingPage() {
  return (
    <I18nProvider>
      <LocationTrackingInner />
    </I18nProvider>
  )
}

function LocationTrackingInner() {
  const router = useRouter()
  const { isAuthenticated, isLoading, isHRUser } = useAuth()
  const { isRTL } = useI18n()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  if (!isHRUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-muted-foreground mb-4">{isRTL ? 'ليس لديك صلاحية الوصول للموارد البشرية' : 'HR access required'}</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <LocationTrackingContent />
    </div>
  )
}
