"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2, User, Phone, Mail, Building, Briefcase, Calendar,
  MapPin, Clock, TrendingUp, Users, FileText, Award, ShieldAlert, Gift
} from "lucide-react"
import { callMethod } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { LoginPage } from "@/components/login-page"
import { I18nProvider, useI18n } from "@/lib/i18n"
import { dualDate } from "@/lib/format"
import { translateDepartment } from "@/lib/enums"
import { EmployeeContractCard } from "@/components/employee/employee-contract-card"
import { EmployeeIdCard } from "@/components/employee/employee-id-card"
import { GosiStatusCard } from "@/components/employee/gosi-status-card"

interface EmployeeDetails {
  name: string
  employee_id: string
  employee_name: string
  company_email: string
  department: string
  designation: string
  date_of_joining: string
  date_of_birth: string
  cell_number: string
  current_shift?: {
    shift_type: string
    start_time: string
    end_time: string
    color: string
  }
  location_settings?: {
    enable_tracking: number
    employee_consent: number
    checkin_method: string
    enable_radius_alert: number
    alert_radius: number
  }
  recent_attendance?: Array<{
    attendance_date: string
    status: string
    shift: string
    in_time: string
    out_time: string
    working_hours: number
  }>
}

interface EmployeeStatistics {
  attendance_summary: Record<string, number>
  leave_balance: Array<{
    leave_type: string
    total_leaves_allocated: number
    unused_leaves: number
  }>
  late_entries: number
  early_exits: number
}

interface EmployeeHierarchy {
  manager?: {
    name: string
    employee_id: string
    employee_name: string
    designation: string
  }
  subordinates?: Array<{
    name: string
    employee_id: string
    employee_name: string
    designation: string
  }>
}

// Bilingual labels (glossary: مناوبة=shift, انصراف مبكر=early departure).
const L = {
  en: {
    errorTitle: 'Error', loadFail: 'Failed to load employee data', notFound: 'Employee not found',
    tabOverview: 'Overview', tabStatistics: 'Statistics', tabHierarchy: 'Organization', tabAttendance: 'Attendance',
    basicInfo: 'Basic Information', empId: 'Employee ID', joinDate: 'Joining Date', birthDate: 'Date of Birth',
    currentShift: 'Current Shift', shiftType: 'Shift Type', startTime: 'Start Time', endTime: 'End Time',
    trackingSettings: 'Tracking Settings', trackingEnabled: 'Tracking Enabled', yes: 'Yes', no: 'No',
    checkinMethod: 'Check-in Method', alertRadius: 'Alert Radius', metres: 'm',
    recentAttendance: 'Recent Attendance', hoursUnit: 'hrs',
    attendanceSummary: 'Attendance Summary', present: 'Present', absent: 'Absent', late: 'Late', earlyExit: 'Early Departure',
    leaveBalance: 'Leave Balance', earned: 'Earned', used: 'Used', remaining: 'Remaining',
    directManager: 'Direct Manager', subordinates: 'Subordinates',
    detailedAttendance: 'Detailed Attendance Records', detailedComingSoon: 'Detailed attendance records will be shown here',
  },
  ar: {
    errorTitle: 'خطأ', loadFail: 'فشل تحميل بيانات الموظف', notFound: 'لم يتم العثور على الموظف',
    tabOverview: 'نظرة عامة', tabStatistics: 'الإحصائيات', tabHierarchy: 'الهيكل التنظيمي', tabAttendance: 'الحضور',
    basicInfo: 'المعلومات الأساسية', empId: 'رقم الموظف', joinDate: 'تاريخ الانضمام', birthDate: 'تاريخ الميلاد',
    currentShift: 'المناوبة الحالية', shiftType: 'نوع المناوبة', startTime: 'وقت البداية', endTime: 'وقت النهاية',
    trackingSettings: 'إعدادات التتبع', trackingEnabled: 'التتبع مفعّل', yes: 'نعم', no: 'لا',
    checkinMethod: 'طريقة الحضور', alertRadius: 'نطاق التنبيه', metres: 'م',
    recentAttendance: 'سجلات الحضور الأخيرة', hoursUnit: 'ساعة',
    attendanceSummary: 'ملخص الحضور', present: 'حاضر', absent: 'غائب', late: 'تأخير', earlyExit: 'انصراف مبكر',
    leaveBalance: 'رصيد الإجازات', earned: 'مكتسبة', used: 'المستخدم', remaining: 'المتبقي',
    directManager: 'المدير المباشر', subordinates: 'المرؤوسون',
    detailedAttendance: 'سجلات الحضور التفصيلية', detailedComingSoon: 'سيتم عرض سجلات الحضور التفصيلية هنا',
  },
}

// Dynamic-enum maps (fallback to the raw backend value when unmapped).
const ATT_STATUS: Record<string, { en: string; ar: string }> = {
  Present: { en: 'Present', ar: 'حاضر' }, Absent: { en: 'Absent', ar: 'غائب' },
  'On Leave': { en: 'On Leave', ar: 'في إجازة' }, 'Half Day': { en: 'Half Day', ar: 'نصف يوم' },
  'Work From Home': { en: 'Work From Home', ar: 'عمل عن بُعد' },
}
const LEAVE_TYPE: Record<string, { en: string; ar: string }> = {
  'Casual Leave': { en: 'Casual Leave', ar: 'إجازة عارضة' }, 'Sick Leave': { en: 'Sick Leave', ar: 'إجازة مرضية' },
  'Annual Leave': { en: 'Annual Leave', ar: 'إجازة سنوية' }, 'Privilege Leave': { en: 'Privilege Leave', ar: 'إجازة اعتيادية' },
  'Unpaid Leave': { en: 'Unpaid Leave', ar: 'إجازة بدون راتب' }, 'Attendance Incentive': { en: 'Attendance Incentive', ar: 'حافز الحضور' },
}

function EmployeeDetailsContent({ employeeId }: { employeeId: string }) {
  const [details, setDetails] = useState<EmployeeDetails | null>(null)
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null)
  const [hierarchy, setHierarchy] = useState<EmployeeHierarchy | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { isRTL } = useI18n()
  const tr = isRTL ? L.ar : L.en
  const lc: 'ar' | 'en' = isRTL ? 'ar' : 'en'
  const attStatus = (s: string) => ATT_STATUS[s]?.[lc] || s
  const leaveTypeLabel = (s: string) => LEAVE_TYPE[s]?.[lc] || s

  useEffect(() => {
    loadEmployeeData()
  }, [employeeId])

  const loadEmployeeData = async () => {
    try {
      setLoading(true)

      // Load employee details
      const detailsData = await callMethod('hrms.hr.api.employee_search_api.get_employee_details', { employee: employeeId })
      if (detailsData.message) {
        setDetails(detailsData.message)
      }

      // Load statistics
      const statsData = await callMethod('hrms.hr.api.employee_search_api.get_employee_statistics', { employee: employeeId })
      if (statsData.message) {
        setStatistics(statsData.message)
      }

      // Load hierarchy
      const hierarchyData = await callMethod('hrms.hr.api.employee_search_api.get_employee_hierarchy', { employee: employeeId })
      if (hierarchyData.message) {
        setHierarchy(hierarchyData.message)
      }

    } catch (error) {
      toast({
        title: tr.errorTitle,
        description: tr.loadFail,
        variant: "destructive",
      })
      console.error("Error loading employee data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!details) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{tr.notFound}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={undefined} />
              <AvatarFallback>
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{details.employee_name}</h1>
              <p className="text-muted-foreground">{details.designation}</p>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{translateDepartment(details.department, lc)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{details.company_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{details.cell_number}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{tr.tabOverview}</TabsTrigger>
          <TabsTrigger value="statistics">{tr.tabStatistics}</TabsTrigger>
          <TabsTrigger value="hierarchy">{tr.tabHierarchy}</TabsTrigger>
          <TabsTrigger value="attendance">{tr.tabAttendance}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>{tr.basicInfo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr.empId}:</span>
                  <span className="font-medium">{details.employee_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr.joinDate}:</span>
                  <span className="font-medium">{dualDate(details.date_of_joining)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr.birthDate}:</span>
                  <span className="font-medium">{dualDate(details.date_of_birth)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Current Shift */}
            {details.current_shift && (
              <Card>
                <CardHeader>
                  <CardTitle>{tr.currentShift}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr.shiftType}:</span>
                    <span className="font-medium">{details.current_shift.shift_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr.startTime}:</span>
                    <span className="font-medium">{details.current_shift.start_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr.endTime}:</span>
                    <span className="font-medium">{details.current_shift.end_time}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Location Settings */}
            {details.location_settings && (
              <Card>
                <CardHeader>
                  <CardTitle>{tr.trackingSettings}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr.trackingEnabled}:</span>
                    <Badge variant={details.location_settings.enable_tracking ? "default" : "secondary"}>
                      {details.location_settings.enable_tracking ? tr.yes : tr.no}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr.checkinMethod}:</span>
                    <span className="font-medium">{details.location_settings.checkin_method}</span>
                  </div>
                  {details.location_settings.enable_radius_alert === 1 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{tr.alertRadius}:</span>
                      <span className="font-medium">{details.location_settings.alert_radius}{tr.metres}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* National ID / Iqama + expiry (read-only; hides if no ID data) */}
          <EmployeeIdCard employeeId={employeeId} />

          {/* GOSI registration status + live "check now" (stub-only for now) */}
          <GosiStatusCard employeeId={employeeId} />

          {/* Employment Contract (read-only; hides if absent / no HR access) */}
          <EmployeeContractCard employeeId={employeeId} />

          {/* Recent Attendance */}
          {details.recent_attendance && details.recent_attendance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{tr.recentAttendance}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {details.recent_attendance.map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{dualDate(record.attendance_date)}</div>
                          <div className="text-sm text-muted-foreground">{record.shift}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <Clock className="h-3 w-3 inline me-1" />
                          {record.in_time} - {record.out_time}
                        </div>
                        <div className="text-sm font-medium">
                          {record.working_hours.toFixed(2)} {tr.hoursUnit}
                        </div>
                        <Badge variant={record.status === "Present" ? "default" : "secondary"}>
                          {attStatus(record.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          {statistics && (
            <>
              {/* Attendance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>{tr.attendanceSummary}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        {statistics.attendance_summary.Present || 0}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{tr.present}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-red-600">
                        {statistics.attendance_summary.Absent || 0}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{tr.absent}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-orange-600">
                        {statistics.late_entries}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{tr.late}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-primary">
                        {statistics.early_exits}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{tr.earlyExit}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Leave Balance */}
              {statistics.leave_balance && statistics.leave_balance.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{tr.leaveBalance}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {statistics.leave_balance.map((leave, index) => {
                        const total = leave.total_leaves_allocated || 0
                        const remaining = leave.unused_leaves || 0
                        const used = Math.max(total - remaining, 0)
                        const pct = total > 0 ? Math.round((remaining / total) * 100) : 0
                        const isIncentive = leave.leave_type === 'Attendance Incentive'
                        return (
                          <div key={index} className={`p-3 border rounded-lg space-y-2 ${isIncentive ? 'border-emerald-300 bg-emerald-50/40' : ''}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium flex items-center gap-1.5">
                                {isIncentive && <Gift className="h-4 w-4 text-emerald-600" />}
                                {leaveTypeLabel(leave.leave_type)}
                                {isIncentive && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{tr.earned}</span>}
                              </span>
                              <span className="text-sm font-semibold">{remaining} / {total}</span>
                            </div>
                            <Progress value={pct} className={`h-2 ${isIncentive ? '[&>div]:bg-emerald-500' : ''}`} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{tr.used}: {used}</span>
                              <span>{tr.remaining}: {remaining}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-4">
          {hierarchy && (
            <>
              {/* Manager */}
              {hierarchy.manager && (
                <Card>
                  <CardHeader>
                    <CardTitle>{tr.directManager}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                      <Avatar>
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{hierarchy.manager.employee_name}</div>
                        <div className="text-sm text-muted-foreground">{hierarchy.manager.designation}</div>
                        <div className="text-xs text-muted-foreground">{hierarchy.manager.employee_id}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Subordinates */}
              {hierarchy.subordinates && hierarchy.subordinates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{tr.subordinates} ({hierarchy.subordinates.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {hierarchy.subordinates.map((sub, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                          <Avatar>
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{sub.employee_name}</div>
                            <div className="text-sm text-muted-foreground">{sub.designation}</div>
                            <div className="text-xs text-muted-foreground">{sub.employee_id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>{tr.detailedAttendance}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{tr.detailedComingSoon}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function EmployeeDetailsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  // Auth + HR gate handled by HrShell/HrGuard (this route is in SHELL_PREFIXES).
  const params = use(paramsPromise)
  return <EmployeeDetailsContent employeeId={params.id} />
}
