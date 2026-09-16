"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import {
  AlertTriangle, Bell, CheckCircle, Loader2, MapPin, Settings,
  Users, Search, ChevronLeft, ChevronRight, ExternalLink, Power, PowerOff,
  Activity, TrendingUp, Clock, Target, Filter, RefreshCw, X, ShieldAlert
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"
import { LoginPage } from "@/components/login-page"
import { I18nProvider, useI18n } from "@/lib/i18n"
import { formatDateShort, formatTime } from '@/lib/format'
import { translateDepartment } from "@/lib/enums"
import {
  getEmployeesRadiusSettings,
  updateRadiusSettings,
  getAlertLogs,
  getRadiusDashboardStats,
  disableRadiusAlert,
} from "@/lib/api"

// ======================== Types ========================

interface EmployeeRadius {
  employee: string
  employee_name: string
  department: string
  designation: string
  status: string
  has_settings: boolean
  enable_tracking: number
  enable_radius_alert: number
  alert_radius: number
  center_latitude: number
  center_longitude: number
  notify_hr_manager: number
  notification_message: string
  total_alerts: number
  last_alert: string | null
}

interface AlertLog {
  name: string
  employee: string
  employee_name: string
  alert_datetime: string
  distance_from_center: number
  alert_radius: number
  latitude: number
  longitude: number
  google_maps_url: string
}

interface DashboardStats {
  total_employees: number
  tracking_enabled: number
  radius_alert_enabled: number
  total_alerts_today: number
  total_alerts_this_week: number
  total_alerts_this_month: number
  employees_outside_radius_today: Array<{ employee: string; employee_name: string }>
  recent_alerts: AlertLog[]
}

// ======================== Main Component ========================

function RadiusAlertsContent() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const { isRTL } = useI18n()

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
          <AlertTriangle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isRTL ? 'تنبيهات النطاق الجغرافي' : 'Geofence Alerts'}</h1>
          <p className="text-sm text-muted-foreground">{isRTL ? 'إدارة ومراقبة نطاق تواجد الموظفين' : 'Manage and monitor employee geofence compliance'}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border shadow-sm">
          <TabsTrigger value="dashboard" className="gap-2">
            <Activity className="h-4 w-4" />
            {isRTL ? 'لوحة المتابعة' : 'Dashboard'}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {isRTL ? 'إعدادات الموظفين' : 'Employee Settings'}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Bell className="h-4 w-4" />
            {isRTL ? 'سجل التنبيهات' : 'Alert Logs'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ======================== Dashboard Tab ========================

function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { isRTL } = useI18n()

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getRadiusDashboardStats()
      setStats(data)
    } catch (error: any) {
      console.error("Failed to load stats:", error)
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "فشل تحميل الإحصائيات" : "Failed to load statistics", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, isRTL])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-muted-foreground">{isRTL ? 'فشل تحميل البيانات' : 'Failed to load data'}</p>
        <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" className="mt-3" onClick={loadStats}>
          <RefreshCw className="h-4 w-4 mr-2" /> {isRTL ? 'إعادة المحاولة' : 'Retry'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label={isRTL ? 'إجمالي الموظفين' : 'Total Employees'}
          value={stats.total_employees}
          bg="bg-accent"
        />
        <StatCard
          icon={<MapPin className="h-5 w-5 text-purple-600" />}
          label={isRTL ? 'تتبع مفعّل' : 'Tracking Enabled'}
          value={stats.tracking_enabled}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Target className="h-5 w-5 text-orange-600" />}
          label={isRTL ? 'تنبيه نطاق مفعّل' : 'Radius Alert Enabled'}
          value={stats.radius_alert_enabled}
          bg="bg-orange-50"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={isRTL ? 'تنبيهات اليوم' : "Today's Alerts"}
          value={stats.total_alerts_today}
          bg="bg-red-50"
          highlight={stats.total_alerts_today > 0}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
          label={isRTL ? 'تنبيهات الأسبوع' : 'Weekly Alerts'}
          value={stats.total_alerts_this_week}
          bg="bg-amber-50"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
          label={isRTL ? 'تنبيهات الشهر' : 'Monthly Alerts'}
          value={stats.total_alerts_this_month}
          bg="bg-muted"
        />
      </div>

      {/* Employees Outside Radius Today */}
      {stats.employees_outside_radius_today.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              {isRTL ? `موظفون خارج النطاق اليوم (${stats.employees_outside_radius_today.length})` : `Employees Outside Radius Today (${stats.employees_outside_radius_today.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.employees_outside_radius_today.map((emp) => (
                <Badge
                  key={emp.employee}
                  variant="destructive"
                  className="py-1.5 px-3 text-sm"
                >
                  {emp.employee_name}
                  <span className="text-red-200 mr-1 text-xs">({emp.employee})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{isRTL ? 'آخر التنبيهات' : 'Recent Alerts'}</CardTitle>
          <CardDescription>{isRTL ? 'آخر 10 تنبيهات خروج من النطاق' : 'Last 10 geofence breach alerts'}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recent_alerts.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-12 w-12 text-green-300" />}
              title={isRTL ? 'لا توجد تنبيهات' : 'No Alerts'}
              description={isRTL ? 'جميع الموظفين ضمن النطاق المحدد' : 'All employees are within the defined radius'}
            />
          ) : (
            <AlertsTable alerts={stats.recent_alerts} compact />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ======================== Settings Tab ========================

function SettingsTab() {
  const [employees, setEmployees] = useState<EmployeeRadius[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "enabled" | "disabled">("all")
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRadius | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const { toast } = useToast()
  const { isRTL } = useI18n()

  // Edit form state
  const [editForm, setEditForm] = useState({
    enable_radius_alert: false,
    alert_radius: 500,
    center_latitude: 0,
    center_longitude: 0,
    notify_hr_manager: true,
    notification_message: "",
  })

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getEmployeesRadiusSettings()
      setEmployees(data.employees || [])
    } catch (error: any) {
      console.error("Failed to load employees:", error)
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "فشل تحميل بيانات الموظفين" : "Failed to load employee data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, isRTL])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const openEditDialog = (emp: EmployeeRadius) => {
    setEditingEmployee(emp)
    setEditForm({
      enable_radius_alert: emp.has_settings ? emp.enable_radius_alert === 1 : true,
      alert_radius: emp.alert_radius || 500,
      center_latitude: emp.center_latitude || 0,
      center_longitude: emp.center_longitude || 0,
      notify_hr_manager: emp.has_settings ? emp.notify_hr_manager === 1 : true,
      notification_message: emp.notification_message || "",
    })
  }

  const handleSaveSettings = async () => {
    if (!editingEmployee) return

    if (editForm.enable_radius_alert) {
      if (editForm.alert_radius <= 0) {
        toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "النطاق يجب أن يكون أكبر من صفر" : "Radius must be greater than zero", variant: "destructive" })
        return
      }
      if (editForm.center_latitude === 0 && editForm.center_longitude === 0) {
        toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "يرجى تحديد إحداثيات النقطة المركزية" : "Please set the center point coordinates", variant: "destructive" })
        return
      }
    }

    try {
      setSavingSettings(true)
      await updateRadiusSettings({
        employee: editingEmployee.employee,
        enable_radius_alert: editForm.enable_radius_alert ? 1 : 0,
        alert_radius: editForm.alert_radius,
        center_latitude: editForm.center_latitude,
        center_longitude: editForm.center_longitude,
        notify_hr_manager: editForm.notify_hr_manager ? 1 : 0,
        notification_message: editForm.notification_message,
      })

      toast({ title: isRTL ? "تم الحفظ" : "Saved", description: isRTL ? `تم تحديث إعدادات ${editingEmployee.employee_name}` : `Updated settings for ${editingEmployee.employee_name}` })
      setEditingEmployee(null)
      loadEmployees()
    } catch (error: any) {
      console.error("Failed to save settings:", error)
      toast({ title: isRTL ? "خطأ" : "Error", description: error.message || (isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings"), variant: "destructive" })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleQuickDisable = async (emp: EmployeeRadius) => {
    try {
      await disableRadiusAlert(emp.employee)
      toast({ title: isRTL ? "تم" : "Done", description: isRTL ? `تم إيقاف تنبيه النطاق لـ ${emp.employee_name}` : `Radius alert disabled for ${emp.employee_name}` })
      loadEmployees()
    } catch (error: any) {
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "فشل إيقاف التنبيه" : "Failed to disable alert", variant: "destructive" })
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "المتصفح لا يدعم تحديد الموقع" : "Browser does not support geolocation", variant: "destructive" })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditForm((prev) => ({
          ...prev,
          center_latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          center_longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }))
        toast({ title: isRTL ? "تم" : "Done", description: isRTL ? "تم تحديد الموقع الحالي" : "Current location set" })
      },
      () => {
        toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "فشل تحديد الموقع" : "Failed to get location", variant: "destructive" })
      }
    )
  }

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.department || "").toLowerCase().includes(searchQuery.toLowerCase())

    if (filterMode === "enabled") return matchesSearch && emp.enable_radius_alert === 1
    if (filterMode === "disabled") return matchesSearch && emp.enable_radius_alert !== 1
    return matchesSearch
  })

  const enabledCount = employees.filter((e) => e.enable_radius_alert === 1).length

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder={isRTL ? 'بحث بالاسم أو القسم...' : 'Search by name or department...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={filterMode} onValueChange={(v: any) => setFilterMode(v)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? `الكل (${employees.length})` : `All (${employees.length})`}</SelectItem>
              <SelectItem value="enabled">{isRTL ? `مفعّل (${enabledCount})` : `Enabled (${enabledCount})`}</SelectItem>
              <SelectItem value="disabled">{isRTL ? `غير مفعّل (${employees.length - enabledCount})` : `Disabled (${employees.length - enabledCount})`}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={loadEmployees} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {isRTL ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Employees Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12 text-muted-foreground/40" />}
              title={isRTL ? 'لا يوجد موظفين' : 'No Employees'}
              description={searchQuery ? (isRTL ? 'جرب بحث مختلف' : 'Try a different search') : (isRTL ? 'لم يتم العثور على موظفين' : 'No employees found')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-right">{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'القسم' : 'Department'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'تنبيه النطاق' : 'Radius Alert'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'النطاق (م)' : 'Radius (m)'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'عدد التنبيهات' : 'Alert Count'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'آخر تنبيه' : 'Last Alert'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.employee} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{emp.employee_name}</div>
                          <div className="text-xs text-muted-foreground/70">{emp.employee}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{emp.department ? translateDepartment(emp.department, isRTL ? 'ar' : 'en') : "—"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.enable_radius_alert === 1 ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <Power className="h-3 w-3 mr-1" /> {isRTL ? 'مفعّل' : 'Enabled'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            <PowerOff className="h-3 w-3 mr-1" /> {isRTL ? 'غير مفعّل' : 'Disabled'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.enable_radius_alert === 1 ? (
                          <span className="font-medium text-foreground">{emp.alert_radius}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.total_alerts > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {emp.total_alerts}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {emp.last_alert
                          ? `${formatDateShort(emp.last_alert)} ${formatTime(emp.last_alert)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(emp)}
                            className="text-primary hover:text-primary/80 hover:bg-accent"
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            {isRTL ? 'إعداد' : 'Configure'}
                          </Button>
                          {emp.enable_radius_alert === 1 && (
                            <Button aria-label="تعطيل" title="تعطيل"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickDisable(emp)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <PowerOff className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              {isRTL ? 'إعدادات تنبيه النطاق' : 'Radius Alert Settings'}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee?.employee_name} — {editingEmployee?.employee}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <Label className="text-sm font-medium">{isRTL ? 'تفعيل تنبيه النطاق' : 'Enable Radius Alert'}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'إرسال تنبيه عند خروج الموظف من النطاق' : 'Send alert when employee leaves the radius'}</p>
              </div>
              <Switch
                checked={editForm.enable_radius_alert}
                onCheckedChange={(v) => setEditForm((p) => ({ ...p, enable_radius_alert: v }))}
              />
            </div>

            {editForm.enable_radius_alert && (
              <>
                {/* Radius */}
                <div className="space-y-2">
                  <Label>{isRTL ? 'النطاق المسموح (بالأمتار)' : 'Allowed Radius (meters)'}</Label>
                  <Input
                    type="number"
                    min={50}
                    max={50000}
                    value={editForm.alert_radius}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, alert_radius: parseInt(e.target.value) || 500 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground/70">{isRTL ? 'مثال: 500 = نصف كيلومتر' : 'Example: 500 = half a kilometer'}</p>
                </div>

                {/* Center Point */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'النقطة المركزية (مقر العمل)' : 'Center Point (Workplace)'}</Label>
                    <Button aria-label="استخدام موقعي الحالي" title="استخدام موقعي الحالي" variant="outline" size="sm" onClick={useMyLocation}>
                      <MapPin className="h-3.5 w-3.5 mr-1" />
                      {isRTL ? 'استخدم موقعي' : 'Use My Location'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">خط العرض (Latitude)</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={editForm.center_latitude}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, center_latitude: parseFloat(e.target.value) || 0 }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">خط الطول (Longitude)</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={editForm.center_longitude}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, center_longitude: parseFloat(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  </div>
                  {editForm.center_latitude !== 0 && editForm.center_longitude !== 0 && (
                    <a
                      href={`https://www.google.com/maps?q=${editForm.center_latitude},${editForm.center_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      عرض على خرائط Google
                    </a>
                  )}
                </div>

                {/* Notify HR */}
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{isRTL ? 'إشعار مدير الموارد البشرية' : 'Notify HR Manager'}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'إرسال إشعار عند حدوث مخالفة' : 'Send notification when a breach occurs'}</p>
                  </div>
                  <Switch
                    checked={editForm.notify_hr_manager}
                    onCheckedChange={(v) => setEditForm((p) => ({ ...p, notify_hr_manager: v }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingEmployee(null)} disabled={savingSettings}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-primary hover:bg-primary/90">
              {savingSettings ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                </>
              ) : (
                isRTL ? 'حفظ الإعدادات' : 'Save Settings'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ======================== Logs Tab ========================

function LogsTab() {
  const [logs, setLogs] = useState<AlertLog[]>([])
  const [loading, setLoading] = useState(false)
  const [totalLogs, setTotalLogs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [filterEmployee, setFilterEmployee] = useState("")
  const [filterEmployeeLabel, setFilterEmployeeLabel] = useState("")
  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  )
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0])
  const { toast } = useToast()
  const { isRTL } = useI18n()

  // Employee search autocomplete state
  const [allEmployees, setAllEmployees] = useState<EmployeeRadius[]>([])
  const [empSearchQuery, setEmpSearchQuery] = useState("")
  const [showEmpDropdown, setShowEmpDropdown] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const empDropdownRef = useRef<HTMLDivElement>(null)

  // Load employees list once for autocomplete
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingEmployees(true)
        const data = await getEmployeesRadiusSettings()
        setAllEmployees(data.employees || [])
      } catch { /* ignore */ } finally {
        setLoadingEmployees(false)
      }
    }
    load()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target as Node)) {
        setShowEmpDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Filter employees for autocomplete
  const filteredEmpOptions = empSearchQuery.trim()
    ? allEmployees.filter((emp) => {
      const q = empSearchQuery.toLowerCase()
      return (
        emp.employee_name.toLowerCase().includes(q) ||
        emp.employee.toLowerCase().includes(q) ||
        (emp.department || "").toLowerCase().includes(q) ||
        (emp.designation || "").toLowerCase().includes(q)
      )
    }).slice(0, 8)
    : []

  const selectEmployee = (emp: EmployeeRadius) => {
    setFilterEmployee(emp.employee)
    setFilterEmployeeLabel(`${emp.employee_name} (${emp.employee})`)
    setEmpSearchQuery("")
    setShowEmpDropdown(false)
  }

  const clearEmployeeFilter = () => {
    setFilterEmployee("")
    setFilterEmployeeLabel("")
    setEmpSearchQuery("")
  }

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = { page, page_size: pageSize }
      if (filterEmployee) params.employee = filterEmployee
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate

      const data = await getAlertLogs(params)
      setLogs(data.alerts || [])
      setTotalLogs(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch (error: any) {
      console.error("Failed to load logs:", error)
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "فشل تحميل سجل التنبيهات" : "Failed to load alert logs", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterEmployee, fromDate, toDate, toast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const clearFilters = () => {
    clearEmployeeFilter()
    setFromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    setToDate(new Date().toISOString().split("T")[0])
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5" ref={empDropdownRef}>
              <Label className="text-xs text-muted-foreground">{isRTL ? 'الموظف (اختياري)' : 'Employee (optional)'}</Label>
              {filterEmployee ? (
                <div className="flex items-center gap-1.5 h-10 px-3 border rounded-md bg-accent border-primary/20">
                  <Users className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                  <span className="text-sm text-accent-foreground truncate flex-1">{filterEmployeeLabel}</span>
                  <button
                    onClick={clearEmployeeFilter}
                    className="text-blue-400 hover:text-primary shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                  <Input
                    placeholder={isRTL ? 'بحث بالاسم أو الرقم...' : 'Search by name or ID...'}
                    value={empSearchQuery}
                    onChange={(e) => {
                      setEmpSearchQuery(e.target.value)
                      setShowEmpDropdown(true)
                    }}
                    onFocus={() => empSearchQuery && setShowEmpDropdown(true)}
                    className="pr-9"
                  />
                  {showEmpDropdown && empSearchQuery.trim() && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {loadingEmployees ? (
                        <div className="p-3 text-center text-sm text-muted-foreground/70">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> {isRTL ? 'جاري التحميل...' : 'Loading...'}
                        </div>
                      ) : filteredEmpOptions.length === 0 ? (
                        <div className="p-3 text-center text-sm text-muted-foreground/70">{isRTL ? 'لا توجد نتائج' : 'No results'}</div>
                      ) : (
                        filteredEmpOptions.map((emp) => (
                          <button
                            key={emp.employee}
                            onClick={() => selectEmployee(emp)}
                            className="w-full text-right px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0 flex items-center gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{emp.employee_name}</div>
                              <div className="text-xs text-muted-foreground/70 truncate">{emp.employee} {emp.department ? `• ${translateDepartment(emp.department, isRTL ? 'ar' : 'en')}` : ""}</div>
                            </div>
                            {emp.enable_radius_alert === 1 && (
                              <Badge className="bg-green-100 text-green-700 text-[10px] shrink-0">{isRTL ? 'مفعّل' : 'Enabled'}</Badge>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isRTL ? 'من تاريخ' : 'From Date'}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isRTL ? 'إلى تاريخ' : 'To Date'}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => { setPage(1); loadLogs() }}
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                {isRTL ? 'بحث' : 'Search'}
              </Button>
              <Button variant="outline" size="icon" onClick={clearFilters} title={isRTL ? 'مسح الفلاتر' : 'Clear filters'}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isRTL ? 'سجل التنبيهات' : 'Alert Logs'}
              {totalLogs > 0 && (
                <span className="text-sm font-normal text-muted-foreground mr-2">({totalLogs} {isRTL ? 'تنبيه' : 'alerts'})</span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-12 w-12 text-green-300" />}
              title={isRTL ? 'لا توجد تنبيهات' : 'No Alerts'}
              description={isRTL ? 'لم يتم تسجيل أي مخالفات في الفترة المحددة' : 'No violations recorded in the selected period'}
            />
          ) : (
            <>
              <AlertsTable alerts={logs} />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronRight className="h-4 w-4 mr-1" />
                      {isRTL ? 'السابق' : 'Previous'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {isRTL ? 'التالي' : 'Next'}
                      <ChevronLeft className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ======================== Shared Components ========================

function AlertsTable({ alerts, compact }: { alerts: AlertLog[]; compact?: boolean }) {
  const { isRTL } = useI18n()
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-right">{isRTL ? 'الموظف' : 'Employee'}</TableHead>
            <TableHead className="text-right">{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</TableHead>
            <TableHead className="text-center">{isRTL ? 'المسافة' : 'Distance'}</TableHead>
            <TableHead className="text-center">{isRTL ? 'النطاق' : 'Radius'}</TableHead>
            {!compact && <TableHead className="text-center">{isRTL ? 'الموقع' : 'Location'}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.name}>
              <TableCell>
                <div>
                  <div className="font-medium text-foreground">{alert.employee_name}</div>
                  <div className="text-xs text-muted-foreground/70">{alert.employee}</div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-foreground/90">
                {alert.alert_datetime
                  ? `${formatDateShort(alert.alert_datetime)} ${formatTime(alert.alert_datetime)}`
                  : "—"}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="destructive" className="font-mono">
                  {alert.distance_from_center}{isRTL ? ' م' : ' m'}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">{alert.alert_radius}{isRTL ? ' م' : ' m'}</TableCell>
              {!compact && (
                <TableCell className="text-center">
                  <a
                    href={alert.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    {isRTL ? 'عرض الخريطة' : 'View on Map'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bg,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-red-200 bg-red-50/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold ${highlight ? "text-red-600" : "text-foreground"}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">{description}</p>
    </div>
  )
}

// ======================== Page Wrapper with Auth ========================

function RadiusAlertsInner() {
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

  return <div dir={isRTL ? 'rtl' : 'ltr'}><RadiusAlertsContent /></div>
}

export default function RadiusAlertsPage() {
  return (
    <I18nProvider>
      <RadiusAlertsInner />
    </I18nProvider>
  )
}
