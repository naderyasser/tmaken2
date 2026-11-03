'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Calendar, Search, RefreshCw, Printer, Download, MapPin, Camera,
  Clock, Loader2, Filter, Fingerprint, User, LogIn, LogOut, Building2,
  Users, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle,
  FileText, BarChart3, Eye, TrendingUp, TrendingDown, Award, Timer, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dualDate } from '@/lib/format'
import { printOnePage, onePagePrintCss } from '@/lib/print-fit'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { translateEnum, translateDepartment } from '@/lib/enums'
import { useCompany } from '@/hooks/use-company'
import { frappeClient } from '@/lib/api-client'
import {
  type CheckinDetail,
  parseTime,
  sortCheckinsChronologically,
  formatTimeArabic,
  calculateWorkHoursFromPair,
  calculateWorkHoursFromCheckins,
  hasMissingOutPunch,
  isToday,
  calculateLiveHours,
  formatGenderArabic,
  formatWorkingHours,
  getArabicDayName,
  formatDateArabic,
  todayStr,
  exportToCSV,
} from '@/lib/attendance-utils'

// ────────────────────── Types ──────────────────────

interface AttendanceRecord {
  attendance_id: string
  employee: string
  employee_name: string
  employee_image: string | null
  designation: string | null
  job_title?: string | null
  custom_designation?: string | null
  gender: string | null
  sex?: string | null
  branch: string | null
  location?: string | null
  date: string
  status: 'Present' | 'Absent' | 'On Leave' | 'Half Day' | 'Work From Home' | 'Holiday'
  is_missing?: boolean
  working_hours: number
  in_time: string | null
  out_time: string | null
  late_entry: number
  early_exit: number
  shift: string | null
  department: string | null
  company: string | null
  leave_type: string | null
  checkin_photo: string | null
  checkout_photo: string | null
  checkin_lat: number | null
  checkin_lng: number | null
  checkout_lat: number | null
  checkout_lng: number | null
  checkin_method: string | null
  biometric_verified: number
  biometric_type: string | null
  checkins: CheckinDetail[]
}

interface ReportSummary {
  total: number
  present: number
  absent: number
  on_leave: number
  half_day: number
  work_from_home: number
  holiday: number
  late_entries: number
  early_exits: number
  with_photo: number
  with_location: number
  avg_working_hours: number
}

interface EmployeeStat {
  employee: string
  employee_name: string
  employee_image: string | null
  department: string | null
  total_days: number
  present: number
  absent: number
  on_leave: number
  half_day: number
  work_from_home: number
  holiday: number
  working_days: number
  late_count: number
  early_exit_count: number
  total_hours: number
  avg_hours: number
  min_hours: number
  max_hours: number
  shortest_day: string | null
  longest_day: string | null
  attendance_rate: number
}

interface Department {
  name: string
  department_name: string
  company: string
}

interface EmployeeOption {
  name: string
  employee_name: string
  department: string
  company: string
}

// ────────────────────── Helper functions ──────────────────────

const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || ''

function formatDate(dateStr: string): string {
  try {
    // Hijri-first (Umm al-Qura) + Gregorian, via canonical util (was en-GB English)
    return dualDate(new Date(dateStr + 'T00:00:00')) || dateStr
  } catch {
    return dateStr
  }
}

function formatTime(dateTimeStr: string | null): string {
  if (!dateTimeStr) return '-'
  try {
    const d = new Date(dateTimeStr)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return dateTimeStr
  }
}

// formatWorkingHours imported from @/lib/attendance-utils

function getStatusColor(status: string) {
  switch (status) {
    case 'Present': return 'bg-green-100 text-green-800 border-green-200'
    case 'Absent': return 'bg-red-100 text-red-800 border-red-200'
    case 'On Leave': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Half Day': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Work From Home': return 'bg-accent text-accent-foreground border-primary/20'
    case 'Holiday': return 'bg-slate-100 text-slate-600 border-slate-200'
    default: return 'bg-muted text-foreground border-border'
  }
}

function getStatusArabic(status: string) {
  switch (status) {
    case 'Present': return 'حاضر'
    case 'Absent': return 'غائب'
    case 'On Leave': return 'إجازة'
    case 'Half Day': return 'نصف يوم'
    case 'Work From Home': return 'عمل من المنزل'
    case 'Holiday': return 'عطلة'
    default: return status
  }
}

function getGoogleMapsStaticUrl(lat: number, lng: number, size = '120x90') {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${size}&markers=color:red%7C${lat},${lng}&key=`
}

function getGoogleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function getImageUrl(path: string | null) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${FRAPPE_URL}${path}`
}

// Core utilities imported from @/lib/attendance-utils

// Determine effective status considering missing punches (depends on AttendanceRecord type)
function getEffectiveStatus(record: AttendanceRecord, checkins: CheckinDetail[]): string {
  if (record.status === 'Present' && hasMissingOutPunch(checkins)) {
    const dateStr = record.date
    if (isToday(dateStr)) return record.status
    return 'Missing Punch'
  }
  return record.status
}

// Status Arabic label + CSS mapping for classic view
function getClassicStatusBadge(status: string, isRTL: boolean) {
  const map: Record<string, { label: string; className: string }> = {
    'Present': { label: 'حاضر', className: 'bg-green-100 text-green-800 border-green-300' },
    'Absent': { label: 'غائب', className: 'bg-red-100 text-red-800 border-red-300' },
    'On Leave': { label: 'إجازة', className: 'bg-accent text-accent-foreground border-primary/30' },
    'Half Day': { label: 'نصف يوم', className: 'bg-orange-100 text-orange-800 border-orange-300' },
    'Work From Home': { label: 'عن بعد', className: 'bg-purple-100 text-purple-800 border-purple-300' },
    'Holiday': { label: 'عطلة', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    'Missing Punch': { label: 'نقص بصمة', className: 'bg-yellow-100 text-yellow-800 border-yellow-400' },
  }
  const entry = map[status] || { label: status, className: 'bg-muted text-foreground border-input' }
  return { label: isRTL ? entry.label : status, className: entry.className }
}

// ────────────────────── Component ──────────────────────

export function AttendanceReport() {
  const { t, isRTL } = useI18n()
  const { company: activeCompany } = useCompany()
  const { toast } = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  // Filters
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(todayStr())
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Data
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [employeeStats, setEmployeeStats] = useState<EmployeeStat[]>([])
  const [totalRangeDays, setTotalRangeDays] = useState(0)
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingFilters, setLoadingFilters] = useState(true)

  // UI
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showEmployeeStats, setShowEmployeeStats] = useState(true)
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; record: AttendanceRecord | null }>({ open: false, record: null })
  const [currentPage, setCurrentPage] = useState(1)
  const [isPrinting, setIsPrinting] = useState(false)
  const itemsPerPage = 25
  const [viewMode, setViewMode] = useState<'classic' | 'modern'>('classic')
  const [classicPage, setClassicPage] = useState(1)
  const [classicSortField, setClassicSortField] = useState<'date' | 'employee_name'>('employee_name')
  const [classicSortDir, setClassicSortDir] = useState<'asc' | 'desc'>('asc')
  const classicPageSize = 50

  // Classic sub-view mode: grouped (summary) or flat (daily logbook)
  const [classicViewMode, setClassicViewMode] = useState<'grouped' | 'flat'>('flat')

  // Excel-like column filters
  const [classicNameFilter, setClassicNameFilter] = useState('')
  const [classicTitleFilter, setClassicTitleFilter] = useState('')
  const [classicBranchFilter, setClassicBranchFilter] = useState('')

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    setLoadingFilters(true)
    try {
      const companyFilter = activeCompany || undefined
      const [deptRes, empRes] = await Promise.all([
        frappeClient.call('base_meena.attendance_report_api.get_departments', { company: companyFilter }),
        frappeClient.call('base_meena.attendance_report_api.get_employees_for_filter', { company: companyFilter }),
      ])
      setDepartments(deptRes?.message || [])
      setEmployees(empRes?.message || [])
    } catch (err) {
      console.error('Failed to load filter options:', err)
    } finally {
      setLoadingFilters(false)
    }
  }, [activeCompany])

  useEffect(() => { loadFilterOptions() }, [loadFilterOptions])

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        from_date: fromDate,
        to_date: toDate,
      }
      if (selectedEmployee && selectedEmployee !== 'all') params.employee = selectedEmployee
      if (selectedDepartment && selectedDepartment !== 'all') params.department = selectedDepartment
      if (activeCompany) params.company = activeCompany

      const res = await frappeClient.call('base_meena.attendance_report_api.get_attendance_report', params)
      const data = res?.message || {}
      setRecords(data.records || [])
      setSummary(data.summary || null)
      setEmployeeStats(data.employee_stats || [])
      setTotalRangeDays(data.total_range_days || 0)
      setCurrentPage(1)
      setClassicPage(1)
      setGroupedPage(1)
      setClassicNameFilter('')
      setClassicTitleFilter('')
      setClassicBranchFilter('')
    } catch (err: any) {
      console.error('Failed to fetch report:', err)
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل التقرير' : 'Failed to load attendance report',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, selectedEmployee, selectedDepartment, activeCompany, toast, isRTL])

  // Auto-fetch on date change or filter change
  useEffect(() => {
    fetchReport()
  }, [fromDate, toDate, selectedEmployee, selectedDepartment, activeCompany])

  // Filtered records (client-side status + search filter)
  const filteredRecords = useMemo(() => {
    let list = records
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.employee_name?.toLowerCase().includes(q) ||
        r.employee?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
      )
    }
    return list
  }, [records, statusFilter, searchQuery])

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRecords.slice(start, start + itemsPerPage)
  }, [filteredRecords, currentPage])

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage)

  // Classic view: sorted records (employee_name primary, date secondary)
  const classicSortedRecords = useMemo(() => {
    const sorted = [...filteredRecords].sort((a, b) => {
      // Primary: employee name
      const nameCmp = a.employee_name.localeCompare(b.employee_name, 'ar')
      if (nameCmp !== 0) {
        return classicSortField === 'employee_name'
          ? (classicSortDir === 'desc' ? -nameCmp : nameCmp)
          : nameCmp  // always A-Z when sorting by date
      }
      // Secondary: date
      const dateCmp = a.date.localeCompare(b.date)
      return classicSortField === 'date'
        ? (classicSortDir === 'desc' ? -dateCmp : dateCmp)
        : (classicSortDir === 'desc' ? -dateCmp : dateCmp)  // default asc within employee
    })
    return sorted
  }, [filteredRecords, classicSortField, classicSortDir])

  // Handle classic sort toggle (two-level: employee name always primary)
  const handleClassicSort = (field: 'date' | 'employee_name') => {
    if (classicSortField === field) {
      setClassicSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setClassicSortField(field)
      setClassicSortDir('asc')
    }
    setClassicPage(1)
  }

  // Classic view: apply Excel-like column filters on top of sorted records
  const classicFilteredRecords = useMemo(() => {
    let list = classicSortedRecords
    if (classicNameFilter) {
      const q = classicNameFilter.toLowerCase()
      list = list.filter(r =>
        r.employee_name?.toLowerCase().includes(q) ||
        r.employee?.toLowerCase().includes(q)
      )
    }
    if (classicTitleFilter) {
      list = list.filter(r => {
        const title = r.designation || r.job_title || r.custom_designation || ''
        return title === classicTitleFilter
      })
    }
    if (classicBranchFilter) {
      list = list.filter(r => {
        const branch = r.branch || r.location || r.department || ''
        return branch === classicBranchFilter
      })
    }
    return list
  }, [classicSortedRecords, classicNameFilter, classicTitleFilter, classicBranchFilter])

  // Unique values for filter dropdowns
  const classicTitleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of filteredRecords) {
      const t = r.designation || r.job_title || r.custom_designation
      if (t) set.add(t)
    }
    return [...set].sort()
  }, [filteredRecords])

  const classicBranchOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of filteredRecords) {
      const b = r.branch || r.location || r.department
      if (b) set.add(b)
    }
    return [...set].sort()
  }, [filteredRecords])

  const paginatedClassicRecords = useMemo(() => {
    const start = (classicPage - 1) * classicPageSize
    return classicFilteredRecords.slice(start, start + classicPageSize)
  }, [classicFilteredRecords, classicPage])

  const classicTotalPages = Math.ceil(classicFilteredRecords.length / classicPageSize)

  // Grouped view: aggregate by employee with summary stats
  interface GroupedEmployeeRow {
    employee: string
    employee_name: string
    designation: string | null
    gender: string | null
    branch: string | null
    total_days: number
    present: number
    absent: number
    on_leave: number
    half_day: number
    late_count: number
    early_exit_count: number
    total_hours: number
    min_date: string
    max_date: string
    attendance_rate: number
  }

  const classicGroupedRecords = useMemo(() => {
    const map: Record<string, {
      employee_name: string
      designation: string | null
      gender: string | null
      branch: string | null
      records: AttendanceRecord[]
    }> = {}
    for (const r of classicFilteredRecords) {
      if (!map[r.employee]) {
        map[r.employee] = {
          employee_name: r.employee_name,
          designation: r.designation || r.job_title || r.custom_designation,
          gender: r.gender || r.sex || null,
          branch: r.branch || r.location || r.department,
          records: [],
        }
      }
      map[r.employee].records.push(r)
    }
    const result: GroupedEmployeeRow[] = []
    for (const [emp, group] of Object.entries(map)) {
      const { records } = group
      const present = records.filter(r => r.status === 'Present').length
      const absent = records.filter(r => r.status === 'Absent').length
      const onLeave = records.filter(r => r.status === 'On Leave').length
      const halfDay = records.filter(r => r.status === 'Half Day').length
      const late = records.filter(r => r.late_entry).length
      const early = records.filter(r => r.early_exit).length
      const working = present + (records.filter(r => r.status === 'Work From Home').length)
      const totalDays = records.length
      const totalHrs = records.reduce((sum, r) => {
        const hrs = r.working_hours || 0
        return sum + hrs
      }, 0)
      const rate = working > 0 ? Math.round((present / working) * 100) : 0
      const dates = records.map(r => r.date).sort()
      result.push({
        employee: emp,
        employee_name: group.employee_name,
        designation: group.designation,
        gender: group.gender,
        branch: group.branch,
        total_days: totalDays,
        present,
        absent,
        on_leave: onLeave,
        half_day: halfDay,
        late_count: late,
        early_exit_count: early,
        total_hours: Math.round(totalHrs * 100) / 100,
        min_date: dates[0] || '',
        max_date: dates[dates.length - 1] || '',
        attendance_rate: rate,
      })
    }
    result.sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'ar'))
    return result
  }, [classicFilteredRecords])

  // Grouped view pagination
  const [groupedPage, setGroupedPage] = useState(1)
  const groupedPageSize = 25
  const paginatedGroupedRecords = useMemo(() => {
    const start = (groupedPage - 1) * groupedPageSize
    return classicGroupedRecords.slice(start, start + groupedPageSize)
  }, [classicGroupedRecords, groupedPage])
  const groupedTotalPages = Math.ceil(classicGroupedRecords.length / groupedPageSize)

  // Group records by employee for print view
  const groupedByEmployee = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {}
    for (const r of filteredRecords) {
      if (!map[r.employee]) map[r.employee] = []
      map[r.employee].push(r)
    }
    return map
  }, [filteredRecords])

  // Print handler — show ALL records before printing
  // Any number of employees must come out as a single sheet, so measure and
  // scale to the page rather than letting the table spill onto extra pages.
  const handlePrint = () => {
    setIsPrinting(true)
    // isPrinting expands the table to all records first; fit after that lands.
    setTimeout(() => {
      printOnePage(printRef.current, { marginMm: 8, orientation: 'landscape' })
      setIsPrinting(false)
    }, 300)
  }

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredRecords.length) return
    const headers = [
      'Employee ID', 'Employee Name', 'Date', 'Punch Logs',
      'Working Hours', 'Late (min)', 'Early (min)', 'Status', 'Department', 'Shift',
      'Check-in Lat', 'Check-in Lng', 'Check-in Method', 'Biometric Verified'
    ]
    const rows = filteredRecords.map(r => {
      const sortedCheckins = r.checkins && r.checkins.length > 0
        ? sortCheckinsChronologically(r.checkins)
        : []
      const punches = sortedCheckins.length > 0
        ? sortedCheckins.map(c => `${c.time} (${c.log_type})`).join(' | ')
        : `${r.in_time || ''} → ${r.out_time || ''}`
      const effHrs = sortedCheckins.length > 0
        ? calculateWorkHoursFromCheckins(r.checkins!)
        : (r.in_time && r.out_time ? calculateWorkHoursFromPair(r.in_time, r.out_time) : (r.working_hours || 0))
      return [
        r.employee, r.employee_name, r.date, punches,
        effHrs.toFixed(2), r.late_entry || 0,
        r.early_exit || 0, r.status, r.department || '',
        r.shift || '', r.checkin_lat || '', r.checkin_lng || '',
        r.checkin_method || '', r.biometric_verified ? 'Yes' : 'No'
      ]
    })
    // Employee aggregation section
    const aggHeaders = [
      '', 'Employee ID', 'Employee Name', 'Department', 'Total Days', 'Working Days', 'Present', 'Absent',
      'On Leave', 'Half Day', 'WFH', 'Holiday', 'Late', 'Early Exit', 'Total Hours', 'Avg Hours',
      'Min Hours', 'Max Hours', 'Attendance %'
    ]
    const aggRows = employeeStats.map(s => [
      '', s.employee, s.employee_name, s.department || '', s.total_days, s.working_days ?? s.total_days,
      s.present, s.absent,
      s.on_leave, s.half_day, s.work_from_home, s.holiday ?? 0, s.late_count, s.early_exit_count,
      s.total_hours.toFixed(1), s.avg_hours.toFixed(1), s.min_hours.toFixed(1), s.max_hours.toFixed(1),
      s.attendance_rate + '%'
    ])

    const csvData = [
      '\ufeff--- EMPLOYEE SUMMARY ---\n' + aggHeaders.join(',') + '\n' + aggRows.map(r => r.map(v => `"${v}"`).join(',')).join('\n'),
      '\n--- DAILY RECORDS ---\n' + headers.join(',') + '\n' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n'),
    ].join('\n')
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_${fromDate}_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Shown when the on-screen report is empty — avoids downloading a headers-only file.
  const noDataToast = () => toast({
    title: isRTL ? 'لا توجد بيانات' : 'No data',
    description: isRTL ? 'لا توجد بيانات في الفترة المحددة' : 'No data for the selected period',
    variant: 'destructive',
  })

  // Export the report as a real .xlsx via the backend endpoint. A true xlsx (OOXML,
  // UTF-8 internally) renders Arabic correctly in Excel, unlike the BOM'd CSV above.
  const handleExportExcel = () => {
    if (!filteredRecords.length) { noDataToast(); return }
    const p = new URLSearchParams({ from_date: fromDate, to_date: toDate })
    if (selectedEmployee !== 'all') p.set('employee', selectedEmployee)
    if (selectedDepartment !== 'all') p.set('department', selectedDepartment)
    if (activeCompany) p.set('company', activeCompany)
    window.open(`/api/method/base_meena.attendance_report_api.export_attendance_xlsx?${p}`, '_blank')
  }

  // Download one employee's attendance as an RTL Arabic PDF, with a loading state
  // while wkhtmltopdf generates the file (fetch→blob avoids popup-blocker issues).
  const downloadEmployeePDF = async (employee: string) => {
    setPdfLoading(true)
    try {
      const p = new URLSearchParams({ from_date: fromDate, to_date: toDate, employee })
      if (activeCompany) p.set('company', activeCompany)
      const res = await fetch(`/api/method/base_meena.attendance_report_api.export_attendance_pdf?${p}`, { credentials: 'include' })
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${employee}_${fromDate}_${toDate}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      toast({
        title: isRTL ? 'تعذّر إنشاء PDF' : 'PDF export failed',
        description: isRTL ? 'حدث خطأ أثناء إنشاء الملف' : 'Something went wrong generating the file',
        variant: 'destructive',
      })
    } finally {
      setPdfLoading(false)
    }
  }

  // One-click PDF: download immediately if an employee is selected, otherwise reveal
  // an inline employee picker (picking one downloads straight away).
  const handleExportPDF = () => {
    if (!filteredRecords.length) { noDataToast(); return }
    if (selectedEmployee === 'all') { setPdfPickerOpen(true); return }
    downloadEmployeePDF(selectedEmployee)
  }

  // ────────────────────── Render ──────────────────────

  return (
    <>
      {/* Print styles + Classic enterprise report styles injected globally */}
      <style jsx global>{`
        /* ═══════════════════════════════════════════════
           CLASSIC ENTERPRISE ATTENDANCE REPORT OVERRIDES
           ═══════════════════════════════════════════════ */
        .attendance-classic {
          font-family: Tahoma, Arial, 'Inter', sans-serif;
          font-size: 12px;
          color: #1e293b;
        }
        .attendance-classic h1 { font-size: 18px !important; font-weight: 700 !important; }
        .attendance-classic h3 { font-size: 14px !important; }
        .attendance-classic p { font-size: 11px !important; margin-top: 2px !important; }

        /* Cards → flat, sharp, no shadows */
        .attendance-classic [class*="rounded-lg"] { border-radius: 2px !important; }
        .attendance-classic [class*="rounded-md"] { border-radius: 2px !important; }
        .attendance-classic [class*="rounded-xl"] { border-radius: 2px !important; }
        .attendance-classic [class*="rounded-full"] { border-radius: 2px !important; }
        .attendance-classic [class*="shadow-sm"] { box-shadow: none !important; }
        .attendance-classic [class*="shadow-md"] { box-shadow: none !important; }

        /* Card content padding reduction */
        .attendance-classic .pt-6 { padding-top: 4px !important; }
        .attendance-classic .p-6 { padding: 4px !important; }
        .attendance-classic .p-4 { padding: 4px 6px !important; }

        /* ── Summary Cards → compact inline stats bar ── */
        .attendance-classic .print-summary {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 3px !important;
          margin-bottom: 6px !important;
        }
        .attendance-classic .print-summary > * {
          flex: 1 1 80px !important;
          min-width: 70px !important;
          margin: 0 !important;
          padding: 3px 6px !important;
          text-align: center !important;
        }
        .attendance-classic .print-summary .text-2xl {
          font-size: 14px !important;
          font-weight: 800 !important;
          line-height: 1.1 !important;
        }
        .attendance-classic .print-summary .text-xs { font-size: 9px !important; }
        .attendance-classic .print-summary .mt-1 { margin-top: 0 !important; }

        /* ── Filters → single-row bar ── */
        .attendance-classic [class*="grid-cols-"] {
          gap: 4px !important;
          row-gap: 4px !important;
        }
        .attendance-classic label {
          font-size: 9px !important;
          margin-bottom: 0 !important;
        }
        .attendance-classic input[type="date"] {
          font-size: 10px !important;
          padding: 2px 4px !important;
          height: 26px !important;
        }
        .attendance-classic select { font-size: 10px !important; }

        /* ── Employee Stats Card → compact ── */
        .attendance-classic .pb-3 { padding-bottom: 2px !important; }
        .attendance-classic .mb-6 { margin-bottom: 4px !important; }
        .attendance-classic .my-4 { margin-top: 4px !important; margin-bottom: 4px !important; }

        /* ── Employee stats table (inside classic wrapper) → compact ── */
        .attendance-classic .overflow-x-auto table:not([class*="print-table"]) {
          border-collapse: collapse !important;
          font-size: 10px !important;
        }
        .attendance-classic .overflow-x-auto table:not([class*="print-table"]) thead th {
          font-size: 9px !important;
          padding: 2px 4px !important;
          border: 1px solid #cbd5e1 !important;
        }
        .attendance-classic .overflow-x-auto table:not([class*="print-table"]) tbody td {
          padding: 1px 4px !important;
          border: 1px solid #cbd5e1 !important;
          font-size: 10px !important;
          height: 24px !important;
          vertical-align: middle !important;
        }

        /* ── Sticky first column (Employee) ── */
        .attendance-classic .sticky-col-employee {
          position: sticky !important;
          left: 0 !important;
          z-index: 5 !important;
          background: inherit !important;
          border-right: 2px solid #94a3b8 !important;
        }
        .attendance-classic .sticky-col-employee-header {
          position: sticky !important;
          left: 0 !important;
          z-index: 25 !important;
          background: #cbd5e1 !important;
          border-right: 2px solid #94a3b8 !important;
        }
        .attendance-classic thead th.sticky-col-employee-header {
          background: #cbd5e1 !important;
        }
        .attendance-classic tbody tr:nth-child(even) td.sticky-col-employee {
          background-color: #f8fafc !important;
        }
        .attendance-classic tbody tr:hover td.sticky-col-employee {
          background-color: #e2e8f0 !important;
        }

        /* ── Status badges → compact ── */
        .attendance-classic [class*="rounded-full"] {
          border-radius: 2px !important;
          padding: 0 4px !important;
          font-size: 9px !important;
        }
        .attendance-classic [class*="px-2.5"] { padding-left: 4px !important; padding-right: 4px !important; }
        .attendance-classic [class*="py-0.5"] { padding-top: 0 !important; padding-bottom: 0 !important; }

        /* ── Images → smaller ── */
        .attendance-classic [class*="w-9"][class*="h-9"] {
          width: 20px !important;
          height: 20px !important;
        }
        .attendance-classic [class*="w-7"][class*="h-7"] {
          width: 16px !important;
          height: 16px !important;
        }
        .attendance-classic [class*="w-20"][class*="h-20"] {
          width: 40px !important;
          height: 40px !important;
        }

        /* ── Icons → smaller ── */
        .attendance-classic [class*="w-4"]:not(img):not([class*="w-40"]):not([class*="w-44"]):not([class*="w-48"]) {
          width: 10px !important;
          height: 10px !important;
        }
        .attendance-classic [class*="w-5"] {
          width: 12px !important;
          height: 12px !important;
        }

        /* ── Buttons → compact ── */
        .attendance-classic button {
          font-size: 10px !important;
          padding: 1px 6px !important;
          height: auto !important;
          min-height: 22px !important;
        }

        /* ── Pagination → compact ── */
        .attendance-classic .border-t { border-width: 1px !important; }

        /* ── Employee perf stats → dense ── */
        .attendance-classic .text-lg { font-size: 13px !important; }

        ${onePagePrintCss('.attendance-print-page', '.attendance-report-print', 'landscape', 8, isRTL)}

        /* ── Print styles ── */
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html, body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-family: Tahoma, Arial, sans-serif !important;
            font-size: 9px !important;
            color: #000 !important;
          }
          body * { visibility: hidden !important; }
          .attendance-print-page,
          .attendance-print-page * { visibility: visible !important; }
          .attendance-print-page {
            position: absolute !important;
            inset-inline-start: 0 !important;
            top: 0 !important;
            background: white !important;
          }
          .attendance-report-print { padding: 0 !important; background: white !important; }
          .no-print { display: none !important; }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8px !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #000 !important;
            padding: 2px 4px !important;
            text-align: left !important;
          }
          .print-table th {
            background: #d4d4d4 !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-badge {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-summary {
            display: flex !important;
            gap: 4px !important;
            margin-bottom: 4mm !important;
            flex-wrap: wrap !important;
          }
          .print-summary > div {
            border: 1px solid #000 !important;
            padding: 2px 6px !important;
            border-radius: 0 !important;
            min-width: 60px !important;
            font-size: 8px !important;
            text-align: center !important;
          }
          .print-summary [class*="text-2xl"] { font-size: 11px !important; }
          .page-break-before { page-break-before: always !important; }
          .print\:hidden { display: none !important; }
          .hidden.print\:block { display: block !important; }
          .print\:shadow-none { box-shadow: none !important; }
          .print\:border-0 { border: 0 !important; }
          .print\:border { border: 1px solid #000 !important; }
          .print\:inline { display: inline !important; }
          table { page-break-inside: auto !important; }
          tr { page-break-inside: avoid !important; page-break-after: auto !important; }
          thead { display: table-header-group !important; }
        }
      `}</style>

      <div className={viewMode === 'classic' ? 'attendance-classic space-y-1 w-full max-w-none' : 'space-y-6'} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header — no-print */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isRTL ? 'تقرير الحضور' : 'Attendance Report'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRTL ? 'تقرير مفصل بالحضور مع المواقع والصور' : 'Detailed attendance report with locations and photos'}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex items-center border rounded-sm bg-muted p-0.5 mr-2 no-print">
              <button
                onClick={() => { setViewMode('classic'); setClassicPage(1) }}
                className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-colors ${viewMode === 'classic' ? 'bg-card text-slate-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {isRTL ? 'كلاسيكي' : 'Classic'}
              </button>
              <button
                onClick={() => { setViewMode('modern'); setCurrentPage(1) }}
                className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-colors ${viewMode === 'modern' ? 'bg-card text-slate-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {isRTL ? 'حديث' : 'Modern'}
              </button>
            </div>
            {viewMode === 'classic' && (
              <div className="flex items-center border rounded-sm bg-muted p-0.5 mr-2 no-print">
                <button
                  onClick={() => { setClassicViewMode('flat'); setClassicPage(1) }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-colors ${classicViewMode === 'flat' ? 'bg-card text-slate-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {isRTL ? 'سجل تفصيلي' : 'Daily Log'}
                </button>
                <button
                  onClick={() => { setClassicViewMode('grouped'); setGroupedPage(1) }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-colors ${classicViewMode === 'grouped' ? 'bg-card text-slate-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {isRTL ? 'عرض مجمع' : 'Grouped'}
                </button>
              </div>
            )}
            <Button aria-label="تصدير" title="تصدير" variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              {isRTL ? 'تصدير Excel' : 'Export Excel'}
            </Button>
            {pdfPickerOpen && (
              <Select
                defaultOpen
                onValueChange={(v) => { setPdfPickerOpen(false); setSelectedEmployee(v); downloadEmployeePDF(v) }}
              >
                <SelectTrigger aria-label={isRTL ? 'اختر موظفاً' : 'Choose employee'} className="h-9 w-44 text-xs">
                  <SelectValue placeholder={isRTL ? 'اختر موظفاً' : 'Choose employee'} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.name} value={e.name}>
                      {e.employee_name} ({e.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button aria-label="عرض الملف" title="عرض الملف" size="sm" onClick={handleExportPDF} disabled={pdfLoading}>
              {pdfLoading
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <FileText className="w-4 h-4 mr-2" />}
              {isRTL ? 'تصدير PDF' : 'Export PDF'}
            </Button>
            <Button aria-label="طباعة" title="طباعة" size="sm" onClick={handlePrint} disabled={!filteredRecords.length}>
              <Printer className="w-4 h-4 mr-2" />
              {isRTL ? 'طباعة' : 'Print'}
            </Button>
          </div>
        </div>

        {/* Filters Card — no-print */}
        <Card className="no-print">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Date From */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'من تاريخ' : 'From Date'}
                </label>
                <Input
                  type="date" aria-label={isRTL ? "من تاريخ" : "From date"}
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              {/* Date To */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'إلى تاريخ' : 'To Date'}
                </label>
                <Input
                  type="date" aria-label={isRTL ? "إلى تاريخ" : "To date"}
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              {/* Department */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'القسم' : 'Department'}
                </label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger aria-label={isRTL ? 'الكل' : 'All'} className="text-sm">
                    <SelectValue placeholder={isRTL ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'جميع الأقسام' : 'All Departments'}</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.name} value={d.name}>{translateDepartment(d.name, isRTL ? 'ar' : 'en')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Employee */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'الموظف' : 'Employee'}
                </label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger aria-label={isRTL ? 'الكل' : 'All'} className="text-sm">
                    <SelectValue placeholder={isRTL ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'جميع الموظفين' : 'All Employees'}</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.name} value={e.name}>
                        {e.employee_name} ({e.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Status Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'الحالة' : 'Status'}
                </label>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); setClassicPage(1) }}>
                  <SelectTrigger aria-label={isRTL ? 'الكل' : 'All'} className="text-sm">
                    <SelectValue placeholder={isRTL ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'جميع الحالات' : 'All Statuses'}</SelectItem>
                    <SelectItem value="Present">{isRTL ? 'حاضر' : 'Present'}</SelectItem>
                    <SelectItem value="Absent">{isRTL ? 'غائب' : 'Absent'}</SelectItem>
                    <SelectItem value="On Leave">{isRTL ? 'إجازة' : 'On Leave'}</SelectItem>
                    <SelectItem value="Half Day">{isRTL ? 'نصف يوم' : 'Half Day'}</SelectItem>
                    <SelectItem value="Work From Home">{isRTL ? 'عمل من المنزل' : 'Work From Home'}</SelectItem>
                    <SelectItem value="Holiday">{isRTL ? 'عطلة' : 'Holiday'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Fetch Button */}
              <div className="flex items-end">
                <Button onClick={fetchReport} disabled={loading} className="w-full">
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {isRTL ? 'عرض التقرير' : 'Generate Report'}
                </Button>
              </div>
            </div>

            {/* Search bar */}
            <div className="mt-4 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder={isRTL ? 'بحث بالاسم أو الرقم...' : 'Search by name or ID...'}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setClassicPage(1) }}
                className="pl-10 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* ═══════════ PRINTABLE AREA ═══════════ */}
        <div className="attendance-print-page"><div ref={printRef} className="attendance-report-print">

          {/* Print Header (visible only in print) */}
          <div className="hidden print:block mb-6">
            <div className="text-center border-b pb-4 mb-4">
              <h1 className="text-xl font-bold">{isRTL ? 'تقرير الحضور' : 'Attendance Report'}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isRTL ? `من ${formatDate(fromDate)} إلى ${formatDate(toDate)}` : `From ${formatDate(fromDate)} to ${formatDate(toDate)}`}
              </p>
              {activeCompany && <p className="text-sm text-muted-foreground">{activeCompany}</p>}
              {selectedDepartment !== 'all' && <p className="text-xs text-muted-foreground">{isRTL ? 'القسم: ' : 'Dept: '}{selectedDepartment}</p>}
              <p className="text-xs text-muted-foreground/70 mt-1">
                {isRTL ? `تم الإنشاء: ${new Date().toLocaleString('ar-SA')}` : `Generated: ${new Date().toLocaleString()}`}
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 print-summary mb-6">
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'الإجمالي' : 'Total'}</div>
                </CardContent>
              </Card>
              <Card className="border border-green-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{summary.present}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'حاضر' : 'Present'}</div>
                </CardContent>
              </Card>
              <Card className="border border-red-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.absent}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'غائب' : 'Absent'}</div>
                </CardContent>
              </Card>
              <Card className="border border-yellow-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{summary.on_leave}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'إجازة' : 'On Leave'}</div>
                </CardContent>
              </Card>
              <Card className="border border-orange-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{summary.half_day}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'نصف يوم' : 'Half Day'}</div>
                </CardContent>
              </Card>
              <Card className="border border-slate-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-500">{summary.holiday}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'عطلة' : 'Holiday'}</div>
                </CardContent>
              </Card>
              <Card className="border border-amber-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{summary.late_entries}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'متأخرين' : 'Late'}</div>
                </CardContent>
              </Card>
              <Card className="border border-primary/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{summary.avg_working_hours.toFixed(1)}h</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? 'متوسط الساعات' : 'Avg Hours'}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">{isRTL ? 'جاري تحميل التقرير...' : 'Loading report...'}</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && records.length === 0 && (
            <Card className="no-print">
              <CardContent className="py-16 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {isRTL ? 'لا توجد سجلات حضور' : 'No attendance records found'}
                </h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {isRTL ? 'جرّب تغيير فلاتر البحث أو نطاق التاريخ' : 'Try changing the filters or date range'}
                </p>
              </CardContent>
            </Card>
          )}

           {/* ─── CLASSIC GROUPED VIEW (عرض مجمع) ─── */}
          {viewMode === 'classic' && classicViewMode === 'grouped' && !loading && classicGroupedRecords.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto" dir="rtl">
                  <table className="w-full text-xs border-collapse print-table">
                    <thead>
                      <tr className="bg-muted border-b-2 border-gray-400">
                        <th className="px-2 py-2 text-right font-bold text-foreground/90 text-[11px] w-8">#</th>
                        <th className="px-3 py-2 text-right font-bold text-foreground/90 text-[11px]">
                          {isRTL ? 'الموظف' : 'Employee'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-foreground/90 text-[11px]">
                          {isRTL ? 'المسمى' : 'Title'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-foreground/90 text-[11px]">
                          {isRTL ? 'الفرع' : 'Branch'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-foreground/90 text-[11px]">
                          {isRTL ? 'الفترة' : 'Period'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-foreground/90 text-[11px]">
                          {isRTL ? 'أيام' : 'Days'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-green-700 text-[11px]">
                          {isRTL ? 'حضور' : 'Present'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-red-700 text-[11px]">
                          {isRTL ? 'غياب' : 'Absent'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-yellow-700 text-[11px]">
                          {isRTL ? 'تأخر' : 'Late'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-primary text-[11px]">
                          {isRTL ? 'ساعات' : 'Hours'}
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-emerald-700 text-[11px]">
                          {isRTL ? 'نسبة' : 'Rate'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isPrinting ? classicGroupedRecords : paginatedGroupedRecords).map((row, idx) => {
                        const rowNum = isPrinting ? idx + 1 : (groupedPage - 1) * groupedPageSize + idx + 1
                        const rateColor = row.attendance_rate >= 90 ? 'text-green-700 bg-green-50' :
                          row.attendance_rate >= 75 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'
                        return (
                          <tr
                            key={row.employee}
                            className={`border-b border-border ${
                              idx % 2 === 0 ? 'bg-card' : 'bg-gray-50/70'
                            } hover:bg-blue-50/60 transition-colors`}
                          >
                            <td className="px-2 py-1.5 text-muted-foreground/70 text-[10px] align-top">{rowNum}</td>
                            <td className="px-3 py-1.5 font-semibold text-foreground text-[11px] text-right align-top">{row.employee_name}</td>
                            <td className="px-2 py-1.5 text-muted-foreground text-[10px] text-right align-top">{row.designation || '—'}</td>
                            <td className="px-2 py-1.5 text-muted-foreground text-[10px] text-right align-top">{row.branch || '—'}</td>
                            <td className="px-2 py-1.5 text-muted-foreground text-[10px] text-right align-top whitespace-nowrap">
                              {formatDateArabic(row.min_date)} – {formatDateArabic(row.max_date)}
                            </td>
                            <td className="px-2 py-1.5 text-foreground/90 font-semibold text-[11px] text-right align-top">{row.total_days}</td>
                            <td className="px-2 py-1.5 text-green-700 font-semibold text-[11px] text-right align-top">{row.present}</td>
                            <td className="px-2 py-1.5 text-red-700 font-semibold text-[11px] text-right align-top">{row.absent}</td>
                            <td className="px-2 py-1.5 text-yellow-700 font-semibold text-[11px] text-right align-top">{row.late_count}</td>
                            <td className="px-2 py-1.5 text-primary font-semibold text-[11px] text-right align-top">{formatWorkingHours(row.total_hours)}</td>
                            <td className="px-2 py-1.5 text-right align-top">
                              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold print-badge ${rateColor}`}
                                style={{ borderRadius: '3px' }}>
                                {row.attendance_rate}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Grouped Pagination */}
                {groupedTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t no-print" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className="text-xs text-muted-foreground">
                      {isRTL
                        ? `عرض ${classicGroupedRecords.length} موظف — صفحة ${groupedPage} من ${groupedTotalPages}`
                        : `Showing ${classicGroupedRecords.length} employees — Page ${groupedPage} of ${groupedTotalPages}`}
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setGroupedPage(p => Math.max(1, p - 1))} disabled={groupedPage === 1} className="text-[10px] h-7 px-2">
                        {isRTL ? 'السابق' : 'Previous'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setGroupedPage(p => Math.min(groupedTotalPages, p + 1))} disabled={groupedPage === groupedTotalPages} className="text-[10px] h-7 px-2">
                        {isRTL ? 'التالي' : 'Next'}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="hidden print:block px-4 py-1 border-t text-[9px] text-muted-foreground">
                  {isRTL ? `إجمالي الموظفين: ${classicGroupedRecords.length}` : `Total Employees: ${classicGroupedRecords.length}`}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── CLASSIC FLAT VIEW (سجل تفصيلي) ─── */}
          {viewMode === 'classic' && classicViewMode === 'flat' && !loading && filteredRecords.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto" dir="rtl">
                  <table className="w-full text-xs border-collapse print-table">
                    <thead>
                      {/* Header row */}
                      <tr className="bg-muted border-b-2 border-gray-400">
                        <th className="px-2 py-1.5 text-right font-bold text-foreground/90 text-[11px] w-8 no-print">#</th>
                        <th
                          className="px-3 py-1.5 text-right font-bold text-foreground/90 text-[11px] cursor-pointer hover:bg-muted select-none"
                          onClick={() => handleClassicSort('employee_name')}
                        >
                          {isRTL ? 'الموظف' : 'Employee'}
                          {classicSortField === 'employee_name' && (
                            <span className="ml-1 text-[9px]">{classicSortDir === 'desc' ? '▼' : '▲'}</span>
                          )}
                        </th>
                        <th className="px-3 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'رقم الموظف' : 'ID'}
                        </th>
                        <th className="px-2 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'المسمى' : 'Title'}
                        </th>
                        <th className="px-2 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'الجنس' : 'Gender'}
                        </th>
                        <th className="px-2 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'الفرع' : 'Branch'}
                        </th>
                        <th
                          className="px-3 py-1.5 text-right font-bold text-foreground/90 text-[11px] cursor-pointer hover:bg-muted select-none"
                          onClick={() => handleClassicSort('date')}
                        >
                          {isRTL ? 'التاريخ' : 'Date'}
                          {classicSortField === 'date' && (
                            <span className="ml-1 text-[9px]">{classicSortDir === 'desc' ? '▼' : '▲'}</span>
                          )}
                        </th>
                        <th className="px-3 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'اليوم' : 'Day'}
                        </th>
                        <th className="px-4 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'سجل الحركات' : 'Punch Logs'}
                        </th>
                        <th className="px-3 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'ساعات العمل' : 'Hours'}
                        </th>
                        <th className="px-3 py-1.5 text-right font-bold text-foreground/90 text-[11px] no-print">
                          {isRTL ? 'الحالة' : 'Status'}
                        </th>
                      </tr>
                      {/* Filter row (Excel-style) */}
                      <tr className="bg-muted/40 border-b border-input no-print">
                        <th className="px-2 py-1"></th>
                        <th className="px-3 py-1">
                          <input
                            type="text"
                            value={classicNameFilter}
                            onChange={e => { setClassicNameFilter(e.target.value); setClassicPage(1) }}
                            placeholder={isRTL ? 'بحث باسم...' : 'Search name...'}
                            className="w-full text-[10px] px-2 py-1 border border-input rounded text-right focus:outline-none focus:border-ring"
                          />
                        </th>
                        <th className="px-3 py-1"></th>
                        <th className="px-2 py-1">
                          <select aria-label={isRTL ? 'تصفية بالمسمى الوظيفي' : 'Filter by job title'}
                            value={classicTitleFilter}
                            onChange={e => { setClassicTitleFilter(e.target.value); setClassicPage(1) }}
                            className="w-full text-[10px] px-1 py-1 border border-input rounded text-right focus:outline-none focus:border-ring"
                          >
                            <option value="">{isRTL ? 'الكل' : 'All'}</option>
                            {classicTitleOptions.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </th>
                        <th className="px-2 py-1"></th>
                        <th className="px-2 py-1">
                          <select aria-label={isRTL ? 'تصفية بالفرع' : 'Filter by branch'}
                            value={classicBranchFilter}
                            onChange={e => { setClassicBranchFilter(e.target.value); setClassicPage(1) }}
                            className="w-full text-[10px] px-1 py-1 border border-input rounded text-right focus:outline-none focus:border-ring"
                          >
                            <option value="">{isRTL ? 'الكل' : 'All'}</option>
                            {classicBranchOptions.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </th>
                        <th className="px-3 py-1"></th>
                        <th className="px-3 py-1"></th>
                        <th className="px-4 py-1"></th>
                        <th className="px-3 py-1"></th>
                        <th className="px-3 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isPrinting ? classicFilteredRecords : paginatedClassicRecords).map((record, idx) => {
                        const rowNum = isPrinting ? idx + 1 : (classicPage - 1) * classicPageSize + idx + 1
                        const punches = (record.checkins && record.checkins.length > 0)
                          ? sortCheckinsChronologically(record.checkins)
                          : []
                        const missingOut = hasMissingOutPunch(record.checkins || [])
                        const effectiveStatus = getEffectiveStatus(record, record.checkins || [])
                        const statusBadge = getClassicStatusBadge(effectiveStatus, isRTL)
                        const lastInPunch = [...punches].reverse().find(p => p.log_type === 'IN')
                        const todayFlag = isToday(record.date)
                        let effectiveHours: number
                        if (punches.length > 0) {
                          effectiveHours = calculateWorkHoursFromCheckins(record.checkins!)
                          if (effectiveHours === 0 && missingOut && todayFlag && lastInPunch && lastInPunch.time) {
                            effectiveHours = calculateLiveHours(lastInPunch.time)
                          }
                        } else if (record.in_time && record.out_time) {
                          effectiveHours = calculateWorkHoursFromPair(record.in_time, record.out_time)
                        } else {
                          effectiveHours = record.working_hours || 0
                        }
                        return (
                          <tr
                            key={record.attendance_id}
                            className={`border-b border-border ${
                              record.is_missing ? 'bg-gray-100/70 text-muted-foreground' :
                              effectiveStatus === 'Missing Punch' ? 'bg-yellow-50/60' :
                              idx % 2 === 0 ? 'bg-card' : 'bg-gray-50/70'
                            } hover:bg-blue-50/60 transition-colors`}
                          >
                            <td className="px-2 py-1.5 text-muted-foreground/70 text-[10px] align-top">{rowNum}</td>
                            <td className="px-3 py-1.5 font-semibold text-foreground text-[11px] text-right align-top">{record.employee_name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground text-[10px] font-mono text-right align-top">{record.employee}</td>
                            <td className="px-2 py-1.5 text-muted-foreground text-[10px] text-right align-top leading-tight">
                              {record.designation || record.job_title || record.custom_designation || (isRTL ? 'غير محدد' : 'N/S')}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground text-[10px] text-right align-top">
                              {(() => {
                                const g = record.gender || record.sex
                                return g ? (isRTL ? formatGenderArabic(g) : g) : (isRTL ? 'غير محدد' : 'N/S')
                              })()}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground text-[10px] text-right align-top">
                              {record.branch || record.location || record.department || (isRTL ? 'غير محدد' : 'N/S')}
                            </td>
                            <td className="px-3 py-1.5 text-foreground/90 text-[11px] font-mono text-right align-top">{formatDateArabic(record.date)}</td>
                            <td className="px-3 py-1.5 text-muted-foreground text-[11px] text-right align-top">{getArabicDayName(record.date)}</td>
                            <td className="px-4 py-1.5 align-top">
                              {punches.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {punches.map((p, pi) => (
                                    <span
                                      key={pi}
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        p.log_type === 'IN'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {isRTL
                                        ? `${formatTimeArabic(p.time)} (${p.log_type === 'IN' ? 'دخول' : 'خروج'})`
                                        : `${formatTime(p.time!)} (${p.log_type})`}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/70">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 font-semibold text-[11px] align-top text-right">
                              {missingOut && !todayFlag ? (
                                <span className="text-red-600">0.0h</span>
                              ) : missingOut && todayFlag && lastInPunch && lastInPunch.time ? (
                                <span className="text-primary animate-pulse">Working...</span>
                              ) : effectiveHours > 0 ? (
                                <span className="text-primary">{formatWorkingHours(effectiveHours)}</span>
                              ) : (
                                <span className="text-muted-foreground/70">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 align-top">
                              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold border print-badge ${statusBadge.className}`}
                                style={{ borderRadius: '3px' }}>
                                {statusBadge.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Classic Pagination — no-print */}
                {classicTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t no-print" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className="text-xs text-muted-foreground">
                      {isRTL
                        ? `عرض ${classicFilteredRecords.length} سجل — صفحة ${classicPage} من ${classicTotalPages}`
                        : `Showing ${classicFilteredRecords.length} records — Page ${classicPage} of ${classicTotalPages}`}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClassicPage(p => Math.max(1, p - 1))}
                        disabled={classicPage === 1}
                        className="text-[10px] h-7 px-2"
                      >
                        {isRTL ? 'السابق' : 'Previous'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClassicPage(p => Math.min(classicTotalPages, p + 1))}
                        disabled={classicPage === classicTotalPages}
                        className="text-[10px] h-7 px-2"
                      >
                        {isRTL ? 'التالي' : 'Next'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Print: total count */}
                <div className="hidden print:block px-4 py-1 border-t text-[9px] text-muted-foreground">
                  {isRTL ? `إجمالي السجلات: ${classicFilteredRecords.length}` : `Total Records: ${classicFilteredRecords.length}`}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── MODERN VIEW TABLE ─── */}
          {viewMode === 'modern' && !loading && filteredRecords.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm print-table">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#</th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground sticky-col-employee-header">
                          {isRTL ? 'الموظف' : 'Employee'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'المسمى' : 'Title'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'الجنس' : 'Gender'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'الفرع' : 'Branch'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'التاريخ' : 'Date'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground min-w-[180px]">
                          {isRTL ? 'سجل الحركات' : 'Punch Logs'}
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                          {isRTL ? 'الساعات' : 'Hours'}
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                          {isRTL ? 'تأخر (د)' : 'Late (min)'}
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                          {isRTL ? 'مبكر (د)' : 'Early (min)'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'الحالة' : 'Status'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'الصورة' : 'Photo'}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                          {isRTL ? 'الموقع' : 'Location'}
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground no-print">
                          {isRTL ? 'التفاصيل' : 'Details'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isPrinting ? filteredRecords : paginatedRecords).map((record, idx) => {
                        const rowNum = isPrinting ? idx + 1 : (currentPage - 1) * itemsPerPage + idx + 1
                        const modPunches = (record.checkins && record.checkins.length > 0)
                          ? sortCheckinsChronologically(record.checkins)
                          : []
                        const modMissingOut = hasMissingOutPunch(record.checkins || [])
                        const modTodayFlag = isToday(record.date)
                        const modLastIn = [...modPunches].reverse().find(p => p.log_type === 'IN')
                        let modEffectiveHours: number
                        if (modPunches.length > 0) {
                          modEffectiveHours = calculateWorkHoursFromCheckins(record.checkins!)
                          if (modEffectiveHours === 0 && modMissingOut && modTodayFlag && modLastIn && modLastIn.time) {
                            modEffectiveHours = calculateLiveHours(modLastIn.time)
                          }
                        } else if (record.in_time && record.out_time) {
                          modEffectiveHours = calculateWorkHoursFromPair(record.in_time, record.out_time)
                        } else {
                          modEffectiveHours = record.working_hours || 0
                        }
                        const modEffStatus = getEffectiveStatus(record, record.checkins || [])
                        return (
                          <React.Fragment key={record.attendance_id}>
                            <tr className={`border-b transition-colors ${
                              record.is_missing ? 'bg-muted/40 text-muted-foreground/70' :
                              modEffStatus === 'Missing Punch' ? 'bg-yellow-50/60' :
                              'hover:bg-muted/30'
                            }`}>
                              <td className="px-4 py-3 text-muted-foreground/70 text-xs">{rowNum}</td>
                              {/* Employee — sticky */}
                              <td className="px-4 py-3 sticky-col-employee">
                                <div className="flex items-center gap-1.5">
                                  {record.employee_image ? (
                                    <img
                                      src={getImageUrl(record.employee_image)!}
                                      alt=""
                                      className="w-9 h-9 rounded-full object-cover border"
                                    />
                                  ) : record.checkin_photo ? (
                                    <img
                                      src={getImageUrl(record.checkin_photo)!}
                                      alt=""
                                      className="w-9 h-9 rounded-full object-cover border"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                                      <User className="w-4 h-4 text-muted-foreground/70" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-foreground text-sm">{record.employee_name}</div>
                                    <div className="text-xs text-muted-foreground/70">{record.employee}</div>
                                  </div>
                                </div>
                              </td>
                               {/* Title */}
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {record.designation || record.job_title || record.custom_designation || (isRTL ? 'غير محدد' : 'N/S')}
                              </td>
                              {/* Gender */}
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {(() => {
                                  const g = record.gender || record.sex
                                  return g ? (isRTL ? formatGenderArabic(g) : g) : (isRTL ? 'غير محدد' : 'N/S')
                                })()}
                              </td>
                              {/* Branch */}
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {record.branch || record.location || record.department || (isRTL ? 'غير محدد' : 'N/S')}
                              </td>
                              {/* Date */}
                              <td className="px-4 py-3 text-sm">{formatDate(record.date)}</td>
                              {/* Punch Logs */}
                              <td className="px-4 py-3">
                                {modPunches.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {modPunches.map((p, pi) => (
                                      <span
                                        key={pi}
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                          p.log_type === 'IN'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                      >
                                        {isRTL
                                          ? `${formatTimeArabic(p.time)} (${p.log_type === 'IN' ? 'دخول' : 'خروج'})`
                                          : `${formatTime(p.time!)} (${p.log_type})`}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground/70">—</span>
                                )}
                              </td>
                              {/* Working Hours */}
                              <td className="px-4 py-3 text-sm font-medium text-center">
                                {modMissingOut && !modTodayFlag ? (
                                  <span className="text-red-600 text-xs">0.0h</span>
                                ) : modMissingOut && modTodayFlag ? (
                                  <span className="text-primary text-xs animate-pulse">Working...</span>
                                ) : modEffectiveHours > 0 ? (
                                  formatWorkingHours(modEffectiveHours)
                                ) : (
                                  '-'
                                )}
                              </td>
                              {/* Late Minutes */}
                              <td className="px-4 py-3 text-center">
                                {record.late_entry ? (
                                  <span className="text-orange-600 font-semibold text-xs">{record.late_entry}</span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">0</span>
                                )}
                              </td>
                              {/* Early Leave Minutes */}
                              <td className="px-4 py-3 text-center">
                                {record.early_exit ? (
                                  <span className="text-amber-600 font-semibold text-xs">{record.early_exit}</span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">0</span>
                                )}
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium print-badge ${
                                  modEffStatus === 'Missing Punch' ? 'bg-yellow-100 text-yellow-800 border-yellow-400' : getStatusColor(record.status)
                                }`}>
                                  {modEffStatus === 'Missing Punch' ? (isRTL ? 'نقص بصمة' : 'Missing Punch') : (isRTL ? getStatusArabic(record.status) : record.status)}
                                </span>
                              </td>
                              {/* Photo */}
                              <td className="px-4 py-3">
                                {record.checkin_photo ? (
                                  <img
                                    src={getImageUrl(record.checkin_photo)!}
                                    alt="Check-in"
                                    className="w-10 h-10 rounded-md object-cover border cursor-pointer hover:opacity-80"
                                    onClick={() => setDetailDialog({ open: true, record })}
                                  />
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">-</span>
                                )}
                              </td>
                              {/* Location */}
                              <td className="px-4 py-3">
                                {record.checkin_lat && record.checkin_lng ? (
                                  <a
                                    href={getGoogleMapsUrl(record.checkin_lat, record.checkin_lng)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:text-primary/80 text-xs"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="hidden print:inline text-[9px]">
                                      {record.checkin_lat.toFixed(4)}, {record.checkin_lng.toFixed(4)}
                                    </span>
                                    <span className="print:hidden">
                                      {isRTL ? 'عرض' : 'View'}
                                    </span>
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">-</span>
                                )}
                              </td>
                              {/* Details button */}
                              <td className="px-4 py-3 text-center no-print">
                                <Button aria-label="عرض" title="عرض"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setDetailDialog({ open: true, record })}
                                >
                                  <Eye className="h-4 h-4 text-muted-foreground" />
                                </Button>
                              </td>
                            </tr>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination — no-print */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t no-print">
                    <div className="text-sm text-muted-foreground">
                      {isRTL
                        ? `عرض ${filteredRecords.length} سجل — صفحة ${currentPage} من ${totalPages}`
                        : `Showing ${filteredRecords.length} records — Page ${currentPage} of ${totalPages}`}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        {isRTL ? 'السابق' : 'Previous'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {isRTL ? 'التالي' : 'Next'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Print: total count */}
                <div className="hidden print:block px-4 py-2 border-t text-xs text-muted-foreground">
                  {isRTL ? `إجمالي السجلات: ${filteredRecords.length}` : `Total Records: ${filteredRecords.length}`}
                </div>
              </CardContent>
            </Card>
          )}
        </div></div>
        {/* ═══════════ END PRINTABLE AREA ═══════════ */}

        {/* Detail Dialog — no-print */}
        <Dialog open={detailDialog.open} onOpenChange={open => !open && setDetailDialog({ open: false, record: null })}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto no-print">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تفاصيل الحضور' : 'Attendance Details'}</DialogTitle>
              <DialogDescription>
                {detailDialog.record && (
                  <span>
                    {detailDialog.record.employee_name} — {formatDate(detailDialog.record.date)}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {detailDialog.record && <DetailView record={detailDialog.record} isRTL={isRTL} />}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

// ────────────────────── Detail View ──────────────────────

function DetailView({ record, isRTL }: { record: AttendanceRecord; isRTL: boolean }) {
  return (
    <div className="space-y-6">
      {/* Employee Info + Status */}
      <div className="flex items-start gap-4">
        {(record.employee_image || record.checkin_photo) && (
          <img
            src={getImageUrl(record.employee_image || record.checkin_photo)!}
            alt=""
            className="w-20 h-20 rounded-xl object-cover border-2 border-border shadow-sm"
          />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{record.employee_name}</h3>
          <p className="text-sm text-muted-foreground">{record.employee}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
              {isRTL ? getStatusArabic(record.status) : record.status}
            </span>
            {record.department && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" />
                {translateDepartment(record.department, isRTL ? 'ar' : 'en')}
              </Badge>
            )}
            {record.shift && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {record.shift}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Time Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'التاريخ' : 'Date'}</div>
          <div className="font-semibold">{formatDate(record.date)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'وقت الدخول' : 'Check In'}</div>
          <div className="font-semibold text-green-700">{formatTime(record.in_time)}</div>
        </div>
        <div className="bg-accent rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'وقت الخروج' : 'Check Out'}</div>
          <div className="font-semibold text-primary">{formatTime(record.out_time)}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'ساعات العمل' : 'Working Hours'}</div>
          <div className="font-semibold text-purple-700">
            {record.working_hours > 0 ? formatWorkingHours(record.working_hours) : '-'}
          </div>
        </div>
      </div>

      {/* Flags */}
      {(record.late_entry || record.early_exit) && (
        <div className="flex gap-2">
          {record.late_entry ? (
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {isRTL ? 'تسجيل دخول متأخر' : 'Late Entry'}
            </Badge>
          ) : null}
          {record.early_exit ? (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {isRTL ? 'خروج مبكر' : 'Early Exit'}
            </Badge>
          ) : null}
        </div>
      )}

      {/* Photos side by side */}
      {(record.checkin_photo || record.checkout_photo) && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">{isRTL ? 'الصور' : 'Photos'}</h4>
          <div className="grid grid-cols-2 gap-4">
            {record.checkin_photo && (
              <div className="text-center">
                <img
                  src={getImageUrl(record.checkin_photo)!}
                  alt="Check-in"
                  className="w-full max-w-[200px] mx-auto rounded-lg border-2 border-green-200 shadow-sm"
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <LogIn className="w-3 h-3 text-green-500" />
                  {isRTL ? 'صورة الدخول' : 'Check-in Photo'}
                </p>
              </div>
            )}
            {record.checkout_photo && (
              <div className="text-center">
                <img
                  src={getImageUrl(record.checkout_photo)!}
                  alt="Check-out"
                  className="w-full max-w-[200px] mx-auto rounded-lg border-2 border-primary/20 shadow-sm"
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <LogOut className="w-3 h-3 text-primary/80" />
                  {isRTL ? 'صورة الخروج' : 'Check-out Photo'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Maps */}
      {(record.checkin_lat || record.checkout_lat) && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">{isRTL ? 'المواقع' : 'Locations'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {record.checkin_lat && record.checkin_lng && (
              <div className="border rounded-lg overflow-hidden">
                <div className="relative bg-muted" style={{ height: 200 }}>
                  <iframe
                    src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1000!2d${record.checkin_lng}!3d${record.checkin_lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2s!4v1`}
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0"
                  />
                </div>
                <div className="p-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <LogIn className="w-3 h-3 text-green-500" />
                        {isRTL ? 'موقع الدخول' : 'Check-in Location'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 font-mono mt-0.5">
                        {record.checkin_lat.toFixed(6)}, {record.checkin_lng.toFixed(6)}
                      </p>
                    </div>
                    <a
                      href={getGoogleMapsUrl(record.checkin_lat, record.checkin_lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {isRTL ? 'فتح الخريطة' : 'Open Map'}
                    </a>
                  </div>
                </div>
              </div>
            )}
            {record.checkout_lat && record.checkout_lng && (
              <div className="border rounded-lg overflow-hidden">
                <div className="relative bg-muted" style={{ height: 200 }}>
                  <iframe
                    src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1000!2d${record.checkout_lng}!3d${record.checkout_lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2s!4v1`}
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0"
                  />
                </div>
                <div className="p-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <LogOut className="w-3 h-3 text-primary/80" />
                        {isRTL ? 'موقع الخروج' : 'Check-out Location'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 font-mono mt-0.5">
                        {record.checkout_lat.toFixed(6)}, {record.checkout_lng.toFixed(6)}
                      </p>
                    </div>
                    <a
                      href={getGoogleMapsUrl(record.checkout_lat, record.checkout_lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {isRTL ? 'فتح الخريطة' : 'Open Map'}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification Info */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">{isRTL ? 'التحقق' : 'Verification'}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'طريقة التسجيل' : 'Check-in Method'}</div>
            <div className="font-medium">{record.checkin_method || (isRTL ? 'يدوي' : 'Manual')}</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'بصمة حيوية' : 'Biometric'}</div>
            <div className="font-medium flex items-center gap-1">
              {record.biometric_verified ? (
                <>
                  <Fingerprint className="w-4 h-4 text-green-600" />
                  <span className="text-green-700">{isRTL ? 'تم التحقق' : 'Verified'}</span>
                  {record.biometric_type && <span className="text-xs text-muted-foreground/70">({record.biometric_type})</span>}
                </>
              ) : (
                <span className="text-muted-foreground/70">{isRTL ? 'غير متاح' : 'N/A'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* All Checkins Timeline */}
      {record.checkins.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            {isRTL ? 'سجل التسجيلات' : 'Checkin Timeline'} ({record.checkins.length})
          </h4>
          <div className="space-y-2">
            {record.checkins.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${c.log_type === 'IN' ? 'bg-green-100' : 'bg-accent'}`}>
                  {c.log_type === 'IN' ? (
                    <LogIn className="w-3 h-3 text-green-600" />
                  ) : (
                    <LogOut className="w-3 h-3 text-primary" />
                  )}
                </div>
                <span className="font-medium w-16">{c.log_type === 'IN' ? (isRTL ? 'دخول' : 'IN') : (isRTL ? 'خروج' : 'OUT')}</span>
                <span className="text-muted-foreground">{formatTime(c.time)}</span>
                {c.photo_image && <Camera className="w-3 h-3 text-purple-500" />}
                {c.latitude && c.longitude && (
                  <a
                    href={getGoogleMapsUrl(c.latitude, c.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <MapPin className="w-3 h-3" />
                  </a>
                )}
                {c.biometric_verified ? <Fingerprint className="w-3 h-3 text-green-500" /> : null}
                <span className="text-xs text-muted-foreground/70 ml-auto">{c.checkin_method || 'Manual'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave type */}
      {record.leave_type && (
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">{isRTL ? 'نوع الإجازة' : 'Leave Type'}</div>
          <div className="font-medium text-yellow-800">{translateEnum('leaveType', record.leave_type, isRTL ? 'ar' : 'en')}</div>
        </div>
      )}

      {/* Record ID */}
      <div className="text-xs text-muted-foreground/70 pt-2 border-t">
        <span className="font-medium">ID:</span> {record.attendance_id}
      </div>
    </div>
  )
}
