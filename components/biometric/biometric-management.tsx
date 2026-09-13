'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { translateDepartment } from '@/lib/enums'
import { useCompany } from '@/hooks/use-company'
import { frappeClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Fingerprint,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  Monitor,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  SkipForward,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Copy,
  BookOpen,
  Server,
  Smartphone,
  UserCheck,
  AlertCircle,
  Building2,
  ArrowUpDown,
  CloudCog,
  Printer,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ZKBioTimeTab } from '@/components/zkbio-time-tab'
import {
  EmployeeClassificationFilters,
  type ClassificationFilters,
} from '@/components/biometric/employee-classification-filters'

/** Safely extract an array from a Frappe API response value.
 *  Handles cases where resp.message is an object (e.g. {logs: [...]}) instead of a plain array. */
function asArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val
  if (val && typeof val === 'object' && 'logs' in val && Array.isArray((val as any).logs)) return (val as any).logs
  return []
}

// ==================== Types ====================

interface BiometricDevice {
  name: string
  device_name: string
  serial_number: string
  device_model?: string
  location?: string
  enabled: number
  last_activity?: string
  last_push_ip?: string
  total_synced_records: number
  last_sync_time?: string
  sync_errors: number
  is_online: boolean
  seconds_since_activity?: number | null
}

interface DeviceLog {
  name: string
  device_serial: string
  device_name?: string
  log_datetime: string
  status: string
  table_type?: string
  operation_type?: string
  employee_device_id?: string
  employee?: string
  employee_name?: string
  log_type?: string
  raw_punch_state?: string
  checkin_record?: string
  error_message?: string
  // enriched fields
  gender?: string
  branch?: string
  designation?: string
}

interface EmployeeMapping {
  name: string
  employee_name: string
  department?: string
  designation?: string
  branch?: string
  company?: string
  attendance_device_id?: string
  image?: string
}

interface SyncSummary {
  devices: { total: number; enabled: number; online: number }
  logs: { total: number; success: number; failed: number }
  employees: { total: number; mapped: number; unmapped: number }
}

// ==================== Helper functions ====================

function formatTimeAgo(seconds: number | null | undefined, t: (k: string) => string): string {
  if (seconds == null) return t('bio.never_connected')
  if (seconds < 60) return `${seconds} ${t('bio.seconds')} ${t('bio.ago')}`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} ${t('bio.minutes')} ${t('bio.ago')}`
  return `${Math.floor(seconds / 3600)} ${t('bio.hours')} ${t('bio.ago')}`
}

function formatDateTime(dt: string | undefined): string {
  if (!dt) return '-'
  try {
    const d = new Date(dt)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return dt
  }
}

// ==================== Device Edit Dialog ====================

function DeviceEditDialog({
  device, open, onClose, onSaved, branches, t,
}: {
  device: BiometricDevice
  open: boolean
  onClose: () => void
  onSaved: () => void
  branches: string[]
  t: (k: string) => string
}) {
  const [deviceName, setDeviceName] = useState(device.device_name || '')
  const [location, setLocation] = useState(device.location || '')
  const [enabled, setEnabled] = useState(device.enabled === 1)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setDeviceName(device.device_name || '')
    setLocation(device.location || '')
    setEnabled(device.enabled === 1)
  }, [device])

  const handleSave = async () => {
    if (!deviceName.trim()) {
      toast({ title: '⚠️', description: t('bio.name_required'), variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      await frappeClient.call('base_meena.biometric_management.adms.update_device', {
        serial_number: device.serial_number,
        device_name: deviceName.trim(),
        location: location.trim(),
        enabled: enabled ? 1 : 0,
      })
      toast({ title: '✅', description: t('bio.device_updated') })
      onSaved()
      onClose()
    } catch (err: any) {
      toast({ title: '❌', description: err.message || t('bio.failed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            {t('bio.edit_device')}
            <Badge variant="outline" className="ml-2 font-mono">{device.serial_number}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('bio.device_name')}</Label>
            <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('bio.location')}</Label>
            <Select value={location || '__none__'} onValueChange={(v) => setLocation(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-3 px-4 bg-muted/40 rounded-lg">
            <div>
              <Label className="text-sm font-semibold">{t('bio.enabled')}</Label>
              <p className="text-xs text-muted-foreground">{enabled ? t('bio.enabled') : t('bio.disabled')}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {t('bio.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Devices Tab ====================

function DevicesTab({
  devices, loading, onRefresh, branches, t, onEditDevice,
}: {
  devices: BiometricDevice[]
  loading: boolean
  onRefresh: () => void
  branches: string[]
  t: (k: string) => string
  onEditDevice: (d: BiometricDevice) => void
}) {
  const { toast } = useToast()
  const [testingDevice, setTestingDevice] = useState<string | null>(null)

  const handleTestConnection = async (sn: string) => {
    setTestingDevice(sn)
    try {
      const resp = await frappeClient.call<{
        connected: boolean; last_activity?: string; seconds_ago?: number; message?: string
      }>('base_meena.biometric_management.adms.test_device_connection', { serial_number: sn })
      const data = resp.message || resp.data
      if (data?.connected) {
        toast({ title: '✅', description: `${t('bio.connected')} — ${formatTimeAgo(data.seconds_ago, t)}` })
      } else {
        toast({ title: '⚠️', description: data?.message || t('bio.disconnected'), variant: 'destructive' })
      }
    } catch {
      toast({ title: '❌', description: t('bio.disconnected'), variant: 'destructive' })
    } finally {
      setTestingDevice(null)
    }
  }

  const handleResetErrors = async (sn: string) => {
    try {
      await frappeClient.call('base_meena.biometric_management.adms.reset_device_errors', { serial_number: sn })
      toast({ title: '✅', description: t('bio.errors_reset') })
      onRefresh()
    } catch {
      toast({ title: '❌', description: 'Failed', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <Fingerprint className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">{t('bio.no_devices')}</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{t('bio.no_devices_desc')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {devices.map((device) => (
        <Card
          key={device.name}
          className={cn(
            'border transition-all hover:shadow-md cursor-pointer',
            device.is_online ? 'border-green-200 bg-green-50/30' : 'border-border',
            !device.enabled && 'opacity-60'
          )}
          onClick={() => onEditDevice(device)}
        >
          <CardContent className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2.5 rounded-xl',
                  device.is_online ? 'bg-green-100' : 'bg-muted'
                )}>
                  <Monitor className={cn('h-5 w-5', device.is_online ? 'text-green-600' : 'text-muted-foreground/70')} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{device.device_name || device.serial_number}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{device.serial_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {device.is_online ? (
                  <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                    <Wifi className="h-3 w-3" />{t('bio.online')}
                  </Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground text-xs gap-1">
                    <WifiOff className="h-3 w-3" />{t('bio.offline')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Info rows */}
            <div className="space-y-2 text-xs">
              {device.device_model && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('bio.model')}</span>
                  <span className="font-medium text-foreground/90">{device.device_model}</span>
                </div>
              )}
              {device.location && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('bio.location')}</span>
                  <Badge variant="outline" className="text-xs">{device.location}</Badge>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>{t('bio.last_activity')}</span>
                <span className="font-medium text-foreground/90">
                  {device.seconds_since_activity != null
                    ? formatTimeAgo(device.seconds_since_activity, t)
                    : t('bio.never_connected')}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('bio.synced_records')}</span>
                <span className="font-semibold text-foreground">{device.total_synced_records}</span>
              </div>
              {device.sync_errors > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>{t('bio.sync_errors')}</span>
                  <span className="font-semibold">{device.sync_errors}</span>
                </div>
              )}
              {device.last_push_ip && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('bio.last_ip')}</span>
                  <span className="font-mono text-foreground/90">{device.last_push_ip}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={(e) => { e.stopPropagation(); handleTestConnection(device.serial_number) }}
                disabled={testingDevice === device.serial_number}
              >
                {testingDevice === device.serial_number
                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  : <Activity className="h-3 w-3 mr-1" />}
                {t('bio.test_connection')}
              </Button>
              {device.sync_errors > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-orange-600 hover:text-orange-700"
                  onClick={(e) => { e.stopPropagation(); handleResetErrors(device.serial_number) }}
                >
                  {t('bio.reset_errors')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ==================== Logs Tab ====================

function LogsTab({
  devices, selectedBranch, t,
}: {
  devices: BiometricDevice[]
  selectedBranch: string
  t: (k: string) => string
}) {
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tableTypeFilter, setTableTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilters, setClassFilters] = useState<ClassificationFilters>({})

  // Date range
  const todayStr = new Date().toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(todayStr)
  const [toDate, setToDate] = useState(todayStr)

  // Employee enrichment cache: employee_id -> {gender, branch, designation}
  const [empCache, setEmpCache] = useState<Record<string, { gender?: string; branch?: string; designation?: string }>>({})

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const args: Record<string, any> = { page_size: 500 }
      if (deviceFilter !== 'all') args.device_serial = deviceFilter
      if (statusFilter !== 'all') args.status = statusFilter
      if (tableTypeFilter !== 'all') args.table_type = tableTypeFilter
      if (selectedBranch) args.branch = selectedBranch
      if (fromDate) args.from_date = fromDate
      if (toDate) args.to_date = toDate
      if (classFilters.branch) args.branch = classFilters.branch
      if (classFilters.gender) args.gender = classFilters.gender
      if (classFilters.nationality) args.nationality = classFilters.nationality
      if (classFilters.work_shift_system) args.work_shift_system = classFilters.work_shift_system

      const resp = await frappeClient.call<DeviceLog[]>(
        'base_meena.biometric_management.adms.get_device_logs', args
      )
      const fetched = asArray<DeviceLog>(resp.message ?? resp.data)
      setLogs(fetched)

      // Enrich: fetch gender/branch/designation for employees not yet cached
      const uniqueEmpIds = [...new Set(fetched.map(l => l.employee).filter(Boolean))] as string[]
      const missing = uniqueEmpIds.filter(id => !(id in empCache))
      if (missing.length > 0) {
        try {
          const empResp = await frappeClient.get<any[]>('Employee', undefined, {
            fields: ['name', 'gender', 'branch', 'designation'],
            filters: [['Employee', 'name', 'in', missing]],
            limit_page_length: missing.length,
          })
          const rows: any[] = empResp.data || []
          const newCache: typeof empCache = {}
          rows.forEach((r: any) => {
            newCache[r.name] = { gender: r.gender, branch: r.branch, designation: r.designation }
          })
          setEmpCache(prev => ({ ...prev, ...newCache }))
        } catch { /* silent */ }
      }
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }, [deviceFilter, statusFilter, tableTypeFilter, selectedBranch, classFilters])

  useEffect(() => { loadLogs() }, [loadLogs])

  const enrichedLogs = useMemo(() => logs.map(l => ({
    ...l,
    ...(l.employee ? empCache[l.employee] || {} : {}),
  })), [logs, empCache])

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return enrichedLogs
    const q = searchQuery.toLowerCase()
    return enrichedLogs.filter((l) =>
      l.employee_name?.toLowerCase().includes(q) ||
      l.employee?.toLowerCase().includes(q) ||
      l.branch?.toLowerCase().includes(q) ||
      l.designation?.toLowerCase().includes(q) ||
      l.employee_device_id?.includes(q) ||
      l.device_serial?.toLowerCase().includes(q)
    )
  }, [enrichedLogs, searchQuery])

  const statusBadge = (status: string) => {
    if (status === 'Success') return <Badge className="bg-green-100 text-green-800 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />{t('bio.success')}</Badge>
    if (status === 'Failed') return <Badge className="bg-red-100 text-red-800 text-xs gap-1"><XCircle className="h-3 w-3" />{t('bio.failed')}</Badge>
    if (status === 'Operlog') return <Badge className="bg-accent text-accent-foreground text-xs gap-1"><Monitor className="h-3 w-3" />{t('bio.operlog')}</Badge>
    return <Badge className="bg-yellow-100 text-yellow-800 text-xs gap-1"><SkipForward className="h-3 w-3" />{t('bio.skipped')}</Badge>
  }

  const genderLabel = (g?: string) => {
    if (!g) return '-'
    if (g === 'Male') return 'ذكر'
    if (g === 'Female') return 'أنثى'
    return g
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const rows = filteredLogs.map(log => `
      <tr>
        <td>${formatDateTime(log.log_datetime)}</td>
        <td>${log.device_name || log.device_serial || '-'}</td>
        <td>${log.employee_name || log.employee || '-'}</td>
        <td>${genderLabel(log.gender)}</td>
        <td>${log.branch || '-'}</td>
        <td>${log.designation || '-'}</td>
        <td>${log.log_type === 'IN' ? 'دخول' : log.log_type === 'OUT' ? 'خروج' : '-'}</td>
        <td>${log.status}</td>
      </tr>`).join('')
    printWindow.document.write(`
      <html><head><meta charset="utf-8" />
      <title>سجلات البصمة ${fromDate} — ${toDate}</title>
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; font-size: 12px; }
        h2 { text-align: center; margin-bottom: 6px; }
        p  { text-align: center; color: #555; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
        th { background: #f0f0f0; font-weight: bold; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>${t('bio.logs_heading')}</h2>
      <p>من ${fromDate} إلى ${toDate} — إجمالي: ${filteredLogs.length} سجل</p>
      <button onclick="window.print()" style="margin-bottom:12px;padding:6px 16px;cursor:pointer;">🖨️ طباعة</button>
      <table>
        <thead><tr>
          <th>التاريخ والوقت</th><th>الجهاز</th><th>اسم الموظف</th>
          <th>الجنس</th><th>الفرع</th><th>المسمى الوظيفي</th>
          <th>النوع</th><th>الحالة</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`)
    printWindow.document.close()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">{t('bio.logs')}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  placeholder={t('search')}
                  className="pl-8 w-48 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger aria-label={t('bio.filter_device')} className="w-40 h-9 text-sm">
                  <SelectValue placeholder={t('bio.filter_device')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('bio.all_devices')}</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.serial_number} value={d.serial_number}>
                      {d.device_name || d.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-label={t('bio.filter_status')} className="w-36 h-9 text-sm">
                  <SelectValue placeholder={t('bio.filter_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('bio.all_statuses')}</SelectItem>
                  <SelectItem value="Success">{t('bio.success')}</SelectItem>
                  <SelectItem value="Failed">{t('bio.failed')}</SelectItem>
                  <SelectItem value="Operlog">{t('bio.operlog')}</SelectItem>
                  <SelectItem value="Skipped - Duplicate">{t('bio.skipped')} (Dup)</SelectItem>
                  <SelectItem value="Skipped - No Employee">{t('bio.skipped_no_emp')}</SelectItem>
                  <SelectItem value="Skipped - Device Disabled">{t('bio.skipped_disabled')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadLogs} className="h-9" title={t('refresh')}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={filteredLogs.length === 0}
                className="h-9 gap-1.5"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground/70" />
              <span className="text-xs text-muted-foreground font-medium">من:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">إلى:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="h-9 bg-primary hover:bg-primary/90"
              onClick={loadLogs}
            >
              عرض
            </Button>
          </div>

          {/* Classification filters */}
          <EmployeeClassificationFilters
            branches={[]}
            filters={classFilters}
            onChange={setClassFilters}
            hideBranch
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground">{t('bio.no_logs')}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{t('bio.no_logs_desc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <p className="text-xs text-muted-foreground/70 mb-2">{filteredLogs.length} سجل</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">التاريخ والوقت</TableHead>
                  <TableHead>الجهاز</TableHead>
                  <TableHead>اسم الموظف</TableHead>
                  <TableHead>الجنس</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الخطأ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.name} className={cn(
                    log.status === 'Failed' && 'bg-red-50/50',
                    log.status?.startsWith('Skipped') && 'bg-yellow-50/50',
                    log.status === 'Operlog' && 'bg-blue-50/50'
                  )}>
                    <TableCell className="text-xs font-mono">{formatDateTime(log.log_datetime)}</TableCell>
                    <TableCell className="text-sm">{log.device_name || log.device_serial}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{log.employee_name || log.employee || '-'}</p>
                        <p className="text-[10px] text-muted-foreground/70 font-mono">{log.employee || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.gender ? (
                        <Badge variant="outline" className="text-xs">
                          {genderLabel(log.gender)}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.branch ? (
                        <Badge variant="outline" className="text-xs">{log.branch}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.designation || '-'}</TableCell>
                    <TableCell>
                      {log.table_type === 'OPERLOG' ? (
                        <Badge className="bg-accent text-accent-foreground text-xs gap-1"><Monitor className="h-3 w-3" />{log.operation_type || t('bio.operlog')}</Badge>
                      ) : log.log_type === 'IN' ? (
                        <Badge className="bg-green-100 text-green-800 text-xs gap-1"><LogIn className="h-3 w-3" />{t('bio.punch_in')}</Badge>
                      ) : log.log_type === 'OUT' ? (
                        <Badge className="bg-red-100 text-red-800 text-xs gap-1"><LogOut className="h-3 w-3" />خروج</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-red-600 max-w-40 truncate">{log.error_message || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== Employee Mapping Tab ====================

function MappingTab({
  selectedBranch, t,
}: {
  selectedBranch: string
  t: (k: string) => string
}) {
  const { company } = useCompany()
  const { toast } = useToast()
  const [employees, setEmployees] = useState<EmployeeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [mappingFilter, setMappingFilter] = useState('all') // all | mapped | unmapped
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)
  const [editDeviceId, setEditDeviceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ total: 0, mapped: 0, unmapped: 0 })
  const [classFilters, setClassFilters] = useState<ClassificationFilters>({})

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const args: Record<string, any> = {}
      if (selectedBranch) args.branch = selectedBranch
      if (company) args.company = company
      if (classFilters.gender) args.gender = classFilters.gender
      if (classFilters.nationality) args.nationality = classFilters.nationality
      if (classFilters.work_shift_system) args.work_shift_system = classFilters.work_shift_system

      const resp = await frappeClient.call<{
        employees: EmployeeMapping[]
        stats: { total: number; mapped: number; unmapped: number }
      }>('base_meena.biometric_management.adms.get_employee_mapping', args)

      const data = (resp.message || resp.data) as any
      setEmployees(asArray<EmployeeMapping>(data?.employees))
      setStats(data?.stats || { total: 0, mapped: 0, unmapped: 0 })
    } catch (err) {
      console.error('Failed to load employees:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch, company, classFilters])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  const filteredEmployees = useMemo(() => {
    let result = employees
    if (mappingFilter === 'mapped') result = result.filter((e) => e.attendance_device_id)
    if (mappingFilter === 'unmapped') result = result.filter((e) => !e.attendance_device_id)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) =>
        e.employee_name.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.attendance_device_id?.includes(q) ||
        e.department?.toLowerCase().includes(q)
      )
    }
    return result
  }, [employees, searchQuery, mappingFilter])

  const handleAssign = async (employee: string) => {
    if (!editDeviceId.trim()) return
    try {
      setSaving(true)
      await frappeClient.call('base_meena.biometric_management.adms.set_employee_device_id', {
        employee, device_id: editDeviceId.trim(),
      })
      toast({ title: '✅', description: t('bio.id_assigned') })
      setEditingEmployee(null)
      setEditDeviceId('')
      loadEmployees()
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already assigned')) {
        toast({ title: '⚠️', description: t('bio.id_duplicate'), variant: 'destructive' })
      } else {
        toast({ title: '❌', description: msg || t('bio.failed'), variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (employee: string) => {
    try {
      setSaving(true)
      await frappeClient.call('base_meena.biometric_management.adms.remove_employee_device_id', { employee })
      toast({ title: '✅', description: t('bio.id_removed') })
      loadEmployees()
    } catch (err: any) {
      toast({ title: '❌', description: err?.message || t('bio.failed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t('bio.mapping')}</CardTitle>
            <div className="flex gap-3 mt-1.5">
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-green-600">{stats.mapped}</span> {t('bio.mapped')}
              </span>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-orange-600">{stats.unmapped}</span> {t('bio.unmapped')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder={t('search')}
                className="pl-8 w-48 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={mappingFilter} onValueChange={setMappingFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('bio.all_employees')}</SelectItem>
                <SelectItem value="mapped">{t('bio.mapped')}</SelectItem>
                <SelectItem value="unmapped">{t('bio.unmapped')}</SelectItem>
              </SelectContent>
            </Select>
            <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={loadEmployees} className="h-9">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Classification filters */}
        <EmployeeClassificationFilters
          branches={[]}
          filters={classFilters}
          onChange={setClassFilters}
          hideBranch
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground">{t('bio.no_employees')}</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bio.employee')}</TableHead>
                  <TableHead>{t('bio.employee_name')}</TableHead>
                  <TableHead>{t('bio.department')}</TableHead>
                  <TableHead>{t('bio.branch')}</TableHead>
                  <TableHead>{t('bio.current_device_id')}</TableHead>
                  <TableHead className="w-64">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.name}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{emp.name}</TableCell>
                    <TableCell className="font-medium text-sm">{emp.employee_name}</TableCell>
                    <TableCell className="text-sm">{emp.department ? translateDepartment(emp.department, t('dir') === 'rtl' ? 'ar' : 'en') : '-'}</TableCell>
                    <TableCell className="text-sm">
                      {emp.branch ? <Badge variant="outline" className="text-xs">{emp.branch}</Badge> : '-'}
                    </TableCell>
                    <TableCell>
                      {emp.attendance_device_id ? (
                        <Badge className="bg-accent text-accent-foreground font-mono text-xs">
                          {emp.attendance_device_id}
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">{t('bio.unmapped')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingEmployee === emp.name ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editDeviceId}
                            onChange={(e) => setEditDeviceId(e.target.value)}
                            placeholder={t('bio.enter_device_id')}
                            className="h-8 w-32 text-xs font-mono"
                            onKeyDown={(e) => e.key === 'Enter' && handleAssign(emp.name)}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-8 px-2 bg-primary hover:bg-primary/90"
                            onClick={() => handleAssign(emp.name)}
                            disabled={saving || !editDeviceId.trim()}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => { setEditingEmployee(null); setEditDeviceId('') }}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Button aria-label="تعديل" title="تعديل"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditingEmployee(emp.name)
                              setEditDeviceId(emp.attendance_device_id || '')
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            {emp.attendance_device_id ? t('bio.assign_id') : t('bio.assign_id')}
                          </Button>
                          {emp.attendance_device_id && (
                            <Button aria-label="حذف" title="حذف"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemove(emp.name)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t('bio.remove_id')}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== Setup Guide Tab ====================

function SetupGuideTab({ t, onDeviceRegistered }: { t: (k: string) => string; onDeviceRegistered?: () => void }) {
  const { toast } = useToast()
  const [serverIp, setServerIp] = useState('69.164.249.142')
  const [serverPort, setServerPort] = useState('80')
  const [regSerial, setRegSerial] = useState('')
  const [regName, setRegName] = useState('')
  const [registering, setRegistering] = useState(false)

  // Fetch server info on mount
  useEffect(() => {
    frappeClient.call('base_meena.biometric_management.adms.get_server_info')
      .then((res: any) => {
        const data = res?.message || res
        if (data?.server_ip) setServerIp(data.server_ip)
        if (data?.server_port) setServerPort(data.server_port)
      })
      .catch(() => { })
  }, [])

  const copyField = (value: string) => {
    navigator.clipboard.writeText(value)
    toast({ title: '📋', description: t('bio.url_copied') })
  }

  const handleRegister = async () => {
    const sn = regSerial.trim()
    if (!sn) {
      toast({ title: '⚠️', description: t('bio.sn_required'), variant: 'destructive' })
      return
    }
    try {
      setRegistering(true)
      const res: any = await frappeClient.call('base_meena.biometric_management.adms.register_device', {
        serial_number: sn,
        device_name: regName.trim() || undefined,
      })
      const data = res?.message || res
      if (data?.success) {
        toast({ title: '✅', description: t('bio.device_registered') })
        setRegSerial('')
        setRegName('')
        onDeviceRegistered?.()
      }
    } catch (err: any) {
      toast({ title: '❌', description: err.message || t('bio.registration_failed'), variant: 'destructive' })
    } finally {
      setRegistering(false)
    }
  }

  const deviceFields = [
    { label: t('bio.field_enable'), value: t('bio.field_enable_val') },
    { label: t('bio.field_addr'), value: serverIp, copyable: true },
    { label: t('bio.field_port'), value: serverPort, copyable: true },
    { label: t('bio.field_proto'), value: 'HTTP' },
  ]

  const steps = [
    {
      icon: <Fingerprint className="h-6 w-6 text-primary" />,
      title: t('bio.setup_step0_title'),
      desc: t('bio.setup_step0_desc'),
      showRegistration: true,
    },
    {
      icon: <Wifi className="h-6 w-6 text-cyan-600" />,
      title: t('bio.setup_step1_title'),
      desc: t('bio.setup_step1_desc'),
    },
    {
      icon: <Server className="h-6 w-6 text-purple-600" />,
      title: t('bio.setup_step2_title'),
      desc: t('bio.setup_step2_desc'),
      showDeviceFields: true,
    },
    {
      icon: <Fingerprint className="h-6 w-6 text-green-600" />,
      title: t('bio.setup_step3_title'),
      desc: t('bio.setup_step3_desc'),
    },
    {
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
      title: t('bio.setup_step4_title'),
      desc: t('bio.setup_step4_desc'),
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-4">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">{t('bio.setup_title')}</h2>
      </div>

      {steps.map((step, i) => (
        <Card key={i} className="border">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
                  {step.icon}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>

                {/* Device Registration Form (Step 0) */}
                {'showRegistration' in step && step.showRegistration && (
                  <div className="mt-4 p-4 bg-accent rounded-lg space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">{t('bio.serial_number')}</Label>
                        <Input
                          value={regSerial}
                          onChange={(e) => setRegSerial(e.target.value)}
                          placeholder="e.g. CBDK234900123"
                          dir="ltr"
                          className="font-mono"
                          onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">{t('bio.device_name')} ({t('bio.optional')})</Label>
                        <Input
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder={t('bio.device_name_placeholder')}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleRegister}
                      disabled={registering || !regSerial.trim()}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Monitor className="h-4 w-4 mr-2" />}
                      {t('bio.register_device')}
                    </Button>
                  </div>
                )}

                {/* Device Field Values (Step 2) */}
                {step.showDeviceFields && (
                  <div className="mt-4 space-y-2">
                    {deviceFields.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-2.5">
                        <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0">{f.label}</span>
                        <code className="flex-1 bg-gray-900 text-green-400 px-3 py-1.5 rounded text-sm font-mono">{f.value}</code>
                        {f.copyable && (
                          <Button aria-label="نسخ" title="نسخ" variant="ghost" size="sm" onClick={() => copyField(f.value)} className="h-8 px-2">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2 mt-2">
                      ⚠ {t('bio.setup_http_note')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ==================== Reports Tab ====================

const GROUP_BY_OPTIONS = [
  { value: 'branch', label: 'الفرع' },
  { value: 'gender', label: 'الجنس' },
  { value: 'nationality', label: 'الجنسية' },
  { value: 'work_shift_system', label: 'نظام الوردية' },
]

interface ReportRow {
  branch?: string
  gender?: string
  nationality?: string
  work_shift_system?: string
  total_checkins: number
  unique_employees: number
  success_count: number
  failed_count: number
}

function ReportsTab({ branches, t }: { branches: string[]; t: (k: string) => string }) {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(lastDay)
  const [groupBy, setGroupBy] = useState<string[]>(['branch'])
  const [classFilters, setClassFilters] = useState<ClassificationFilters>({})
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const args: Record<string, any> = {
        from_date: fromDate,
        to_date: toDate,
        group_by: JSON.stringify(groupBy),
      }
      if (classFilters.branch) args.branch = classFilters.branch
      if (classFilters.gender) args.gender = classFilters.gender
      if (classFilters.nationality) args.nationality = classFilters.nationality
      if (classFilters.work_shift_system) args.work_shift_system = classFilters.work_shift_system

      const resp = await frappeClient.call<ReportRow[]>(
        'hrms.api.biometric_branch_api.get_monthly_classification_report',
        args,
      )
      setRows(asArray<ReportRow>(resp.message ?? resp.data))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, groupBy, classFilters])

  const toggleGroupBy = (val: string) => {
    setGroupBy((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    )
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const headerCols = [
        ...groupBy.map((g) => GROUP_BY_OPTIONS.find((o) => o.value === g)?.label ?? g),
        'إجمالي السجلات', 'الموظفون الفريدون', 'ناجح', 'فشل',
      ]
      const dataRows = rows.map((r) => [
        ...groupBy.map((g) => (r as any)[g] || 'غير محدد'),
        r.total_checkins,
        r.unique_employees,
        r.success_count,
        r.failed_count,
      ])
      const bom = '\uFEFF'
      const csv = bom + [headerCols, ...dataRows]
        .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `biometric-report-${fromDate}-to-${toDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // Visible columns = those in groupBy + fixed aggregate cols
  const visibleGroupCols = GROUP_BY_OPTIONS.filter((o) => groupBy.includes(o.value))

  return (
    <div className="space-y-5">
      {/* Controls card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5 space-y-4">
          {/* Date range */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">من تاريخ</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">إلى تاريخ</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>

          {/* Classification filters */}
          <EmployeeClassificationFilters
            branches={branches}
            filters={classFilters}
            onChange={setClassFilters}
          />

          {/* Group by */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground font-medium">تجميع حسب:</span>
            {GROUP_BY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleGroupBy(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${groupBy.includes(opt.value)
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={loadReport} disabled={loading} className="bg-primary hover:bg-primary/90 h-9">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpDown className="h-4 w-4 mr-2" />}
              عرض التقرير
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={exporting || rows.length === 0}
              className="h-9"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              تصدير CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/70">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">لا توجد بيانات — اضغط "عرض التقرير" للبدء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleGroupCols.map((col) => (
                      <TableHead key={col.value}>{col.label}</TableHead>
                    ))}
                    <TableHead className="text-center">إجمالي السجلات</TableHead>
                    <TableHead className="text-center">موظفون فريدون</TableHead>
                    <TableHead className="text-center">ناجح</TableHead>
                    <TableHead className="text-center">فشل</TableHead>
                    <TableHead className="text-center">نسبة النجاح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const rate = row.total_checkins > 0
                      ? Math.round((row.success_count / row.total_checkins) * 100)
                      : 0
                    return (
                      <TableRow key={idx}>
                        {visibleGroupCols.map((col) => (
                          <TableCell key={col.value} className="font-medium">
                            {(row as any)[col.value] || 'غير محدد'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center">{row.total_checkins}</TableCell>
                        <TableCell className="text-center">{row.unique_employees}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-100 text-green-800 text-xs">{row.success_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-red-100 text-red-800 text-xs">{row.failed_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={rate >= 80 ? 'text-green-600 font-semibold' : rate >= 50 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {rate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Main Component ====================

export function BiometricManagement() {
  const { t, isRTL } = useI18n()
  const { company } = useCompany()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('devices')

  // Branch filter
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')

  // Data
  const [devices, setDevices] = useState<BiometricDevice[]>([])
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)

  // Dialogs
  const [editingDevice, setEditingDevice] = useState<BiometricDevice | null>(null)

  // ADMS module availability — set to false if the first API call fails
  const [admsAvailable, setAdmsAvailable] = useState<boolean | null>(null)

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const resp = await frappeClient.call<string[]>(
          'base_meena.biometric_management.adms.get_branches',
          company ? { company } : {}
        )
        setBranches(asArray<string>(resp.message ?? resp.data))
        setAdmsAvailable(true)
      } catch {
        setAdmsAvailable(false)
        setLoadingDevices(false)
        setLoadingSummary(false)
      }
    }
    loadBranches()
  }, [company])

  // Load devices
  const loadDevices = useCallback(async () => {
    if (admsAvailable === false) return
    try {
      setLoadingDevices(true)
      const args: Record<string, any> = {}
      if (selectedBranch) args.branch = selectedBranch

      const resp = await frappeClient.call<BiometricDevice[]>(
        'base_meena.biometric_management.adms.get_device_list', args
      )
      setDevices(asArray<BiometricDevice>(resp.message ?? resp.data))
    } catch {
      // silently fail — module not available
    } finally {
      setLoadingDevices(false)
    }
  }, [selectedBranch, admsAvailable])

  // Load summary
  const loadSummary = useCallback(async () => {
    if (admsAvailable === false) return
    try {
      setLoadingSummary(true)
      const args: Record<string, any> = {}
      if (selectedBranch) args.branch = selectedBranch

      const resp = await frappeClient.call<SyncSummary>(
        'base_meena.biometric_management.adms.get_sync_summary', args
      )
      setSummary((resp.message || resp.data || null) as SyncSummary | null)
    } catch {
      // silently fail — module not available
    } finally {
      setLoadingSummary(false)
    }
  }, [selectedBranch, admsAvailable])

  useEffect(() => { if (admsAvailable) { loadDevices(); loadSummary() } }, [loadDevices, loadSummary, admsAvailable])

  // ==================== Render ====================

  if (admsAvailable === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Fingerprint className="h-8 w-8 text-primary" />
            {t('bio.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('bio.subtitle')}</p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <WifiOff className="h-8 w-8 text-muted-foreground/70" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {isRTL ? 'وحدة إدارة أجهزة البصمة غير متوفرة' : 'ADMS Module Not Available'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'تطبيق base_meena غير مثبت على هذا الخادم' : 'The base_meena app is not installed on this server'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Fingerprint className="h-8 w-8 text-primary" />
            {t('bio.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('bio.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Branch Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground/70" />
            <Select value={selectedBranch || '__all__'} onValueChange={(v) => setSelectedBranch(v === '__all__' ? '' : v)}>
              <SelectTrigger aria-label={t('bio.all_branches')} className="w-48 h-9">
                <SelectValue placeholder={t('bio.all_branches')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('bio.all_branches')}</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={() => { loadDevices(); loadSummary() }} className="h-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent rounded-xl">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('bio.total_devices')}</p>
                {loadingSummary ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold">{summary?.devices.enabled || 0}</span>
                    <span className="text-xs text-muted-foreground/70">/ {summary?.devices.total || 0}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 rounded-xl">
                <Wifi className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('bio.online_devices')}</p>
                {loadingSummary ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <span className="text-2xl font-bold text-green-600">{summary?.devices.online || 0}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 rounded-xl">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('bio.today_syncs')}</p>
                {loadingSummary ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold">{summary?.logs.success || 0}</span>
                    {(summary?.logs.failed || 0) > 0 && (
                      <span className="text-xs text-red-500">+{summary?.logs.failed} failed</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-50 rounded-xl">
                <UserCheck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('bio.mapped_employees')}</p>
                {loadingSummary ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold">{summary?.employees.mapped || 0}</span>
                    <span className="text-xs text-muted-foreground/70">/ {summary?.employees.total || 0}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="devices" className="gap-1.5">
            <Monitor className="h-4 w-4" />
            {t('bio.devices')}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Activity className="h-4 w-4" />
            {t('bio.logs')}
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-1.5">
            <Users className="h-4 w-4" />
            {t('bio.mapping')}
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            {t('bio.setup')}
          </TabsTrigger>
          <TabsTrigger value="zkbio" className="gap-1.5">
            <CloudCog className="h-4 w-4" />
            {t('zk.tab_title')}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <ArrowUpDown className="h-4 w-4" />
            التقارير
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          <DevicesTab
            devices={devices}
            loading={loadingDevices}
            onRefresh={loadDevices}
            branches={branches}
            t={t}
            onEditDevice={setEditingDevice}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <LogsTab
            devices={devices}
            selectedBranch={selectedBranch}
            t={t}
          />
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <MappingTab
            selectedBranch={selectedBranch}
            t={t}
          />
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <SetupGuideTab t={t} onDeviceRegistered={loadDevices} />
        </TabsContent>

        <TabsContent value="zkbio" className="mt-4">
          <ZKBioTimeTab t={t} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ReportsTab branches={branches} t={t} />
        </TabsContent>
      </Tabs>

      {/* Device Edit Dialog */}
      {editingDevice && (
        <DeviceEditDialog
          device={editingDevice}
          open={!!editingDevice}
          onClose={() => setEditingDevice(null)}
          onSaved={() => { loadDevices(); loadSummary() }}
          branches={branches}
          t={t}
        />
      )}
    </div>
  )
}
