'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { frappeClient } from '@/lib/api-client'
import { printRows, type ExportColumn } from '@/lib/export-utils'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Activity,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  TrendingUp,
  Calendar,
  Download,
  Printer,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  EmployeeClassificationFilters,
  type ClassificationFilters,
} from '@/components/biometric/employee-classification-filters'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BiometricLog {
  name: string
  employee: string
  employee_name: string
  method: string
  success: number
  liveness_passed: number
  ip_address: string
  timestamp: string
  branch: string
  gender: string
  designation: string
  nationality: string
  work_shift_system: string
  region: string
}

interface LogSummary {
  today_total: number
  today_success: number
  today_fail: number
  success_rate: number
  blocked_employees: number
  trend: { date: string; total: number; success: number; fail: number }[]
}

interface BranchOption {
  name: string
  company: string
}

interface BiometricLogsTabProps {
  branches: BranchOption[]
  t: (k: string) => string
}

const AUTO_REFRESH_MS = 30_000

const chartConfig = {
  success: { label: 'Success', color: '#22c55e' },
  fail: { label: 'Failed', color: '#ef4444' },
} satisfies ChartConfig

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------

function downloadCsv(logs: BiometricLog[], t: (k: string) => string) {
  const header = [
    t('blog.col_employee'), 'ID', t('blog.col_method'),
    t('blog.col_result'), t('blog.col_liveness'),
    t('blog.col_timestamp'), t('blog.col_ip'),
  ]
  const rows = logs.map((l) => [
    l.employee_name || l.employee,
    l.employee,
    l.method,
    l.success ? t('blog.success') : t('blog.failed'),
    l.liveness_passed ? t('blog.liveness_passed') : '—',
    l.timestamp || '',
    l.ip_address || '',
  ])

  const bom = '\uFEFF'
  const csv = bom + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `biometric-logs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BiometricLogsTab({ branches, t }: BiometricLogsTabProps) {
  const { isRTL } = useI18n()
  // Filters
  const [filterBranch, setFilterBranch] = useState('__all__')
  const [filterMethod, setFilterMethod] = useState('__all__')
  const [filterSuccess, setFilterSuccess] = useState('__all__')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [classFilters, setClassFilters] = useState<ClassificationFilters>({})
  const [filterDesignation, setFilterDesignation] = useState('__all__')
  const [filterRegion, setFilterRegion] = useState('__all__')
  const [filterShiftType, setFilterShiftType] = useState('__all__')

  // Data
  const [logs, setLogs] = useState<BiometricLog[]>([])
  const [summary, setSummary] = useState<LogSummary | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filter options
  const [designations, setDesignations] = useState<string[]>([])
  const [loadingDesignations, setLoadingDesignations] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch logs
  // ---------------------------------------------------------------------------
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (filterBranch !== '__all__') params.branch = filterBranch
      if (filterMethod !== '__all__') params.method = filterMethod
      if (filterSuccess !== '__all__') params.success = filterSuccess
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate) params.to_date = filterToDate
      if (classFilters.gender) params.gender = classFilters.gender
      if (classFilters.nationality) params.nationality = classFilters.nationality
      if (filterDesignation !== '__all__') params.designation = filterDesignation
      if (filterRegion !== '__all__') params.region = filterRegion
      if (filterShiftType !== '__all__') params.work_shift_system = filterShiftType

      const resp = await frappeClient.call<any>(
        'hrms.api.biometric_branch_api.get_biometric_logs',
        params,
      )
      const data = (resp.message || resp.data) as {
        logs: BiometricLog[]; total: number; page: number; total_pages: number
      }
      setLogs(Array.isArray(data?.logs) ? data.logs : [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch {
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }, [page, filterBranch, filterMethod, filterSuccess, filterFromDate, filterToDate, classFilters, filterDesignation, filterRegion, filterShiftType])

  // ---------------------------------------------------------------------------
  // Fetch designations for filter dropdown
  // ---------------------------------------------------------------------------
  const loadDesignations = useCallback(async () => {
    setLoadingDesignations(true)
    try {
      const resp = await frappeClient.get<{ name: string }[]>('Designation', undefined, {
        fields: ['name'],
        order_by: 'name asc',
        limit_page_length: 100,
      })
      setDesignations((resp.data || []).map((d) => d.name))
    } catch { /* ignore */ }
    finally { setLoadingDesignations(false) }
  }, [])

  useEffect(() => { loadDesignations() }, [loadDesignations])

  // ---------------------------------------------------------------------------
  // Fetch summary
  // ---------------------------------------------------------------------------
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const params: Record<string, any> = {}
      if (filterBranch !== '__all__') params.branch = filterBranch
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate) params.to_date = filterToDate
      if (classFilters.gender) params.gender = classFilters.gender
      if (classFilters.nationality) params.nationality = classFilters.nationality

      const resp = await frappeClient.call<LogSummary>(
        'hrms.api.biometric_branch_api.get_biometric_log_summary',
        params,
      )
      setSummary((resp.message || resp.data) as LogSummary)
    } catch {
      setSummary(null)
    } finally {
      setLoadingSummary(false)
    }
  }, [filterBranch, filterFromDate, filterToDate, classFilters])

  useEffect(() => { loadLogs() }, [loadLogs])
  useEffect(() => { loadSummary() }, [loadSummary])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filterBranch, filterMethod, filterSuccess, filterFromDate, filterToDate, classFilters, filterDesignation, filterRegion, filterShiftType])

  const refreshAll = useCallback(() => { loadLogs(); loadSummary() }, [loadLogs, loadSummary])

  // ---------------------------------------------------------------------------
  // Auto-refresh every 30s
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { refreshAll() }, AUTO_REFRESH_MS)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, refreshAll])

  // ---------------------------------------------------------------------------
  // CSV export — fetch ALL matching rows (no pagination cap)
  // ---------------------------------------------------------------------------
  const handleExportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const params: Record<string, any> = { page: 1, page_size: 5000 }
      if (filterBranch !== '__all__') params.branch = filterBranch
      if (filterMethod !== '__all__') params.method = filterMethod
      if (filterSuccess !== '__all__') params.success = filterSuccess
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate) params.to_date = filterToDate
      if (classFilters.gender) params.gender = classFilters.gender
      if (classFilters.nationality) params.nationality = classFilters.nationality

      const resp = await frappeClient.call<any>(
        'hrms.api.biometric_branch_api.get_biometric_logs',
        params,
      )
      const data = (resp.message || resp.data) as { logs: BiometricLog[] }
      downloadCsv(Array.isArray(data?.logs) ? data.logs : [], t)
    } catch {
      // silent fail — user will see nothing downloaded
    } finally {
      setExporting(false)
    }
  }, [filterBranch, filterMethod, filterSuccess, filterFromDate, filterToDate, classFilters, t])

  // ---------------------------------------------------------------------------
  // Print functionality
  // ---------------------------------------------------------------------------
  // Routed through the shared printRows so it inherits the one-page fit; the
  // hand-rolled print window this replaced had no @page rule and no scaling,
  // so a long log ran to as many sheets as it needed.
  const handlePrint = useCallback(() => {
    if (!logs.length) return
    const columns: ExportColumn<BiometricLog>[] = [
      { header: t('blog.col_employee_name'), value: (l) => l.employee_name || l.employee },
      { header: t('blog.col_gender'), value: (l) => l.gender || '—' },
      { header: t('blog.col_area'), value: (l) => l.branch || '—' },
      { header: t('blog.col_job_title'), value: (l) => l.designation || '—' },
      { header: t('blog.col_method'), value: (l) => l.method },
      { header: t('blog.col_result'), value: (l) => (l.success ? '✓' : '✗') },
      { header: t('blog.col_liveness'), value: (l) => (l.liveness_passed ? '✓' : '—') },
      {
        header: t('blog.col_timestamp'),
        value: (l) =>
          l.timestamp
            ? new Date(l.timestamp).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : '—',
      },
    ]
    const subtitle =
      filterFromDate || filterToDate
        ? `${filterFromDate || '—'} → ${filterToDate || '—'}`
        : new Date().toLocaleString()
    printRows({ title: t('blog.title'), subtitle, isRTL }, columns, logs)
  }, [logs, filterFromDate, filterToDate, t, isRTL])
  const trendData = useMemo(() => {
    if (!summary?.trend || !Array.isArray(summary.trend)) return []
    return summary.trend.map((d) => ({
      ...d,
      label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    }))
  }, [summary?.trend])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
                  <p className="text-2xl font-bold text-foreground">{summary?.today_total ?? 0}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('blog.attempts_today')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
                  <p className="text-2xl font-bold text-foreground">{summary?.success_rate ?? 0}%</p>
                )}
                <p className="text-xs text-muted-foreground">{t('blog.success_rate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
                  <p className="text-2xl font-bold text-foreground">{summary?.today_fail ?? 0}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('blog.failures_today')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
                  <p className="text-2xl font-bold text-foreground">{summary?.blocked_employees ?? 0}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('blog.blocked_employees')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Trend Chart */}
      {trendData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-foreground">{t('blog.trend_title')}</h4>
              <Badge variant="outline" className="text-[10px]">{t('blog.trend_badge')}</Badge>
            </div>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={trendData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="success" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fail" fill="var(--color-fail)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Logs Table Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          {/* Header row: title + actions */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h4 className="text-sm font-semibold text-foreground">{t('blog.table_title')}</h4>
            <div className="flex items-center gap-3">
              {/* Auto-refresh toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  className="scale-75"
                />
                <label htmlFor="auto-refresh" className="text-[11px] text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                  {t('blog.auto_refresh')}
                </label>
              </div>
              {/* CSV export */}
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting || logs.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {exporting ? t('blog.exporting') : t('blog.export_csv')}
              </Button>
              {/* Print */}
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={logs.length === 0}>
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                {t('blog.print')}
              </Button>
              {/* Manual refresh */}
              <Button variant="outline" size="sm" onClick={refreshAll}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> {t('blog.refresh')}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3 mb-4">
            {/* Classification filters */}
            <EmployeeClassificationFilters
              branches={branches.map((b) => b.name)}
              filters={classFilters}
              onChange={setClassFilters}
              hideBranch
            />
            {/* Log-specific filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger aria-label={t('blog.all_branches')} className="h-9 text-xs">
                  <SelectValue placeholder={t('blog.all_branches')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('blog.all_branches')}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Region Filter */}
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger aria-label={t('blog.all_regions')} className="h-9 text-xs">
                  <SelectValue placeholder={t('blog.all_regions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('blog.all_regions')}</SelectItem>
                  <SelectItem value="Riyadh">Riyadh</SelectItem>
                  <SelectItem value="Makkah">Makkah</SelectItem>
                  <SelectItem value="Madinah">Madinah</SelectItem>
                  <SelectItem value="Eastern Province">Eastern Province</SelectItem>
                  <SelectItem value="Qassim">Qassim</SelectItem>
                  <SelectItem value="Najd">Najd</SelectItem>
                  <SelectItem value="Asir">Asir</SelectItem>
                  <SelectItem value="Tabuk">Tabuk</SelectItem>
                  <SelectItem value="Hail">Hail</SelectItem>
                  <SelectItem value="Jouf">Jouf</SelectItem>
                  <SelectItem value="Northern Border">Northern Border</SelectItem>
                  <SelectItem value="Jawf">Jawf</SelectItem>
                  <SelectItem value="Baha">Baha</SelectItem>
                  <SelectItem value="Najran">Najran</SelectItem>
                  <SelectItem value="Jazan">Jazan</SelectItem>
                </SelectContent>
              </Select>

              {/* Job Title (Designation) Filter */}
              <Select value={filterDesignation} onValueChange={setFilterDesignation} disabled={loadingDesignations}>
                <SelectTrigger aria-label={loadingDesignations ? '...' : t('blog.all_job_titles')} className="h-9 text-xs">
                  <SelectValue placeholder={loadingDesignations ? '...' : t('blog.all_job_titles')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('blog.all_job_titles')}</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Shift Type Filter */}
              <Select value={filterShiftType} onValueChange={setFilterShiftType}>
                <SelectTrigger aria-label={t('blog.all_shift_types')} className="h-9 text-xs">
                  <SelectValue placeholder={t('blog.all_shift_types')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('blog.all_shift_types')}</SelectItem>
                  <SelectItem value="فترة واحدة">فترة واحدة (Single)</SelectItem>
                  <SelectItem value="فترتين">فترتين (Dual)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger aria-label={t('blog.all_methods')} className="h-9 text-xs">
                  <SelectValue placeholder={t('blog.all_methods')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('blog.all_methods')}</SelectItem>
                  <SelectItem value="Face Recognition">Face Recognition</SelectItem>
                  <SelectItem value="WebAuthn">WebAuthn</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSuccess} onValueChange={setFilterSuccess}>
                <SelectTrigger aria-label={t('blog.all_results')} className="h-9 text-xs">
                  <SelectValue placeholder={t('blog.all_results')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('blog.all_results')}</SelectItem>
                  <SelectItem value="1">{t('blog.success')}</SelectItem>
                  <SelectItem value="0">{t('blog.failed')}</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
                <Input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="h-9 text-xs pl-8"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
                <Input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="h-9 text-xs pl-8"
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={() => {
                  setFilterBranch('__all__')
                  setFilterMethod('__all__')
                  setFilterSuccess('__all__')
                  setFilterFromDate('')
                  setFilterToDate('')
                  setFilterDesignation('__all__')
                  setFilterRegion('__all__')
                  setFilterShiftType('__all__')
                  setClassFilters({})
                }}
              >
                {t('blog.clear')}
              </Button>
            </div>
          </div>

          {/* Table */}
          {loadingLogs ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/70">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('blog.no_logs')}</p>
              <p className="text-xs mt-1">{t('blog.no_logs_hint')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t('blog.col_employee_name')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_gender')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_area')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_job_title')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_method')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_result')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_liveness')}</TableHead>
                      <TableHead className="text-xs">{t('blog.col_timestamp')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.name}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-foreground">{log.employee_name || log.employee}</p>
                            <p className="text-[11px] text-muted-foreground/70">{log.employee}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.gender || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.branch || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.designation || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {log.method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> {t('blog.success')}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] gap-1">
                              <XCircle className="h-3 w-3" /> {t('blog.failed')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.liveness_passed ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <Eye className="h-3 w-3" /> {t('blog.liveness_passed')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/70">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  {t('blog.showing')
                    .replace('{0}', String((page - 1) * pageSize + 1))
                    .replace('{1}', String(Math.min(page * pageSize, total)))
                    .replace('{2}', String(total))}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
