'use client'

// Ported 1:1 from egarsys src/components/sections/dashboard.tsx.
// Changes vs the original, all mechanical:
//   • data source: /api/dashboard + /api/contracts  →  Frappe mirror adapter
//     (lib/rentals/dashboard-data.ts). Optional initial* props let a harness
//     inject data for visual verification.
//   • store: zustand aqari-store  →  useRentalsShell() context.
//   • removed @tanstack/react-query (unused queryClient) — not a platform dep.
//   • UI primitives point at the scoped egarsys copies / platform equivalents.
//   • one token-opacity spot (bg-primary/10) → emerald palette (v3 opacity-safe).

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Building2,
  FileText,
  AlertTriangle,
  TrendingUp,
  Clock,
  FilePlus2,
  Receipt,
} from 'lucide-react'
import { Button } from '@/components/rentals/egarsys/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/rentals/egarsys/ui/card'
import { RingsSkeleton } from '@/components/rentals/egarsys/ui/table-skeleton'
import { Badge } from '@/components/rentals/egarsys/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatSAR, installmentLabelAr } from '@/components/rentals/egarsys/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type {
  DashboardStats,
  RentalContract,
  PaymentScheduleRow,
} from '@/components/rentals/egarsys/types'
import { useRentalsShell } from '@/components/rentals/egarsys/store'
import {
  ContractStatusLabels,
  PaymentStatusLabels,
} from '@/components/rentals/egarsys/types'
import { CompanyHeaderLogo } from '@/components/rentals/egarsys/ui/company-header-logo'
import { getDashboardStats, getRecentContracts } from '@/lib/rentals/dashboard-data'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMERALD = '#10b981'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const INDIGO = '#6366f1'

const CONTRACT_EXPIRY_WINDOW_DAYS = 60 // ~2 months

const LIFECYCLE_COLORS: Record<string, string> = {
  active: EMERALD,
  approaching: AMBER,
  expired: RED,
  pendingRenewal: INDIGO,
}

const lifecycleChartConfig = {
  active: { label: 'نشط', color: EMERALD },
  approaching: { label: `قرب الانتهاء (~${CONTRACT_EXPIRY_WINDOW_DAYS} يوم)`, color: AMBER },
  expired: { label: 'منتهي', color: RED },
  pendingRenewal: { label: 'بانتظار التجديد', color: INDIGO },
} satisfies ChartConfig

const barChartConfig = {
  collected: { label: 'المحصّل', color: EMERALD },
  due: { label: 'المستحق', color: AMBER },
} satisfies ChartConfig

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(String(dateStr).replace(' ', 'T'))
  if (isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RingSvg({
  percent, color, centerValue, size = 60, stroke = 7,
}: {
  percent: number
  color: string
  centerValue: string | number
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = circ - (clamped / 100) * circ
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-none">{centerValue}</span>
      </div>
    </div>
  )
}

function WidgetRing({
  percent, color, centerValue, label, onClick, clickHint, labelClassName = 'text-slate-600 dark:text-slate-300',
}: {
  percent: number
  color: string
  centerValue: string | number
  label: string
  onClick: () => void
  clickHint: string
  labelClassName?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={clickHint}
      aria-label={clickHint}
      className="flex flex-col items-center justify-start gap-1 rounded-xl p-1 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
    >
      <RingSvg percent={percent} color={color} centerValue={centerValue} />
      <p className={`text-[10px] font-bold leading-tight ${labelClassName}`}>{label}</p>
    </button>
  )
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getContractAlertColor(status: string, endDate: string | Date): { badge: string; row: string } {
  const now = new Date()
  const end = new Date(typeof endDate === 'string' ? endDate.replace(' ', 'T') : endDate)
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (status === 'expired' || status === 'terminated' || daysLeft < 0) {
    return {
      badge: 'bg-red-100 text-red-800 border-red-200',
      row: 'border-r-4 border-red-500',
    }
  }

  if (status === 'active' && daysLeft <= 90) {
    return {
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      row: 'border-r-4 border-yellow-500',
    }
  }

  return {
    badge: 'bg-green-100 text-green-800 border-green-200',
    row: 'border-r-4 border-green-500',
  }
}

function ContractAlertBadge({ status, endDate }: { status: string; endDate: string | Date }) {
  const label = ContractStatusLabels[status as keyof typeof ContractStatusLabels]
  const alert = getContractAlertColor(status, endDate)
  return (
    <Badge className={alert.badge}>
      {label?.ar || status}
    </Badge>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PaymentStatusBadge({ status }: { status: string }) {
  const label = PaymentStatusLabels[status as keyof typeof PaymentStatusLabels]
  const variants: Record<string, string> = {
    paid: 'success',
    pending: 'warning',
    overdue: 'danger',
    partial: 'orange',
    cancelled: 'neutral',
  }
  return (
    <Badge variant={(variants[status] || 'neutral') as never}>
      {label?.ar || status}
    </Badge>
  )
}

function PaymentScheduleItem({ row, overdue }: { row: PaymentScheduleRow; overdue?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${overdue ? 'bg-red-50/50 dark:bg-red-950/15' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}>
      <div className="flex min-w-0 items-center gap-2">
        {overdue
          ? <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          : <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
        <div className="min-w-0">
          <p className={`truncate text-sm font-bold ${overdue ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>{row.tenantName || '—'}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            العقد {row.contractNumber} · <span className={overdue ? 'font-bold text-red-600 dark:text-red-400' : 'font-semibold'}>{installmentLabelAr(row.installmentNo)}</span>
          </p>
        </div>
      </div>
      <div className="shrink-0 text-left">
        <p className={`text-sm font-bold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{formatSAR(row.amount)}</p>
        <p className={`text-[11px] font-semibold ${overdue ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
          {overdue ? 'متأخرة · ' : 'تستحق · '}{formatDate(row.dueDate)}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DashboardSection({
  initialStats,
  initialContracts,
}: {
  initialStats?: DashboardStats
  initialContracts?: RentalContract[]
} = {}) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats ?? null)
  const [recentContracts, setRecentContracts] = useState<RentalContract[]>(initialContracts ?? [])
  const [loading, setLoading] = useState(!initialStats)

  const { setCurrentSection, setPendingFocus } = useRentalsShell()

  const drillTo = useCallback(
    (section: 'contracts' | 'invoices', contentType: string, key: string) => {
      setPendingFocus({ section, contentType, key })
      setCurrentSection(section)
    },
    [setPendingFocus, setCurrentSection],
  )

  const paymentScheduleRef = useRef<HTMLDivElement>(null)
  const scrollToOverdue = useCallback(() => {
    paymentScheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const [statsData, contracts] = await Promise.all([
        getDashboardStats(),
        getRecentContracts(),
      ])
      setStats(statsData)
      setRecentContracts(contracts.slice(0, 5))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialStats) return
    fetchDashboardData()
  }, [fetchDashboardData, initialStats])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6" dir="rtl">
        <RingsSkeleton rings={3} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TableSkeleton />
          <TableSkeleton />
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <p className="text-muted-foreground">لم يتم تحميل البيانات</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Prepare ring & chart data
  // ---------------------------------------------------------------------------

  const contractTotal = (stats?.contracts?.active ?? 0) + (stats?.contracts?.expired ?? 0) + (stats?.contracts?.draft ?? 0)
  const contractPercent = contractTotal > 0 ? ((stats?.contracts?.active ?? 0) / contractTotal) * 100 : 0

  const issued = stats?.issuedInvoices
  const issuedCount = issued?.count ?? 0

  const overdueRows = stats?.paymentSchedule?.overdue ?? []
  const upcomingRows = stats?.paymentSchedule?.upcoming ?? []

  const overdueInstallmentCount = stats?.paymentSchedule?.overdueCount ?? 0
  const upcomingInstallmentCount = stats?.paymentSchedule?.upcomingCount ?? 0
  const overdueAttention = overdueInstallmentCount + upcomingInstallmentCount
  const overduePercent = overdueAttention > 0 ? (overdueInstallmentCount / overdueAttention) * 100 : 0

  const paymentsDue = stats?.paymentsDue
  const dueCount = paymentsDue?.count ?? 0
  const dueConsidered = paymentsDue?.considered ?? 0
  const duePercent = dueConsidered > 0 ? (dueCount / dueConsidered) * 100 : 0

  const lifecycle = stats?.contractLifecycle
  const lifecycleTotal =
    (lifecycle?.active ?? 0) +
    (lifecycle?.approaching ?? 0) +
    (lifecycle?.expired ?? 0) +
    (lifecycle?.pendingRenewal ?? 0)
  const lifecycleData = [
    { name: 'active', value: lifecycle?.active ?? 0, label: 'نشط' },
    { name: 'approaching', value: lifecycle?.approaching ?? 0, label: 'قرب الانتهاء' },
    { name: 'expired', value: lifecycle?.expired ?? 0, label: 'منتهي' },
    { name: 'pendingRenewal', value: lifecycle?.pendingRenewal ?? 0, label: 'بانتظار التجديد' },
  ].filter((d) => d.value > 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLifecycleCenter = (props: any) => {
    const viewBox = props?.viewBox
    if (!viewBox || typeof viewBox.cx !== 'number' || typeof viewBox.cy !== 'number') return null
    const { cx, cy } = viewBox
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-slate-900 dark:fill-slate-100" style={{ fontSize: 15, fontWeight: 800 }}>
        {lifecycleTotal}
      </text>
    )
  }

  const barData = (stats?.monthlyRevenue ?? []).map((m) => ({
    month: m.label,
    collected: m.collected,
    due: m.due,
    year: m.year,
    monthIndex: m.month,
  }))

  // ---------------------------------------------------------------------------
  // Render: Loaded
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* ---- Page Title & Quick Actions ---- */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 p-6 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/40">
        <div>
          <div className="flex items-center gap-3"><CompanyHeaderLogo className="h-11" /><h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">لوحة التحكم</h1></div>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            نظرة عامة على محفظتك العقارية وإدارة التشغيل
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCurrentSection('contracts')} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2 font-semibold">
            <FilePlus2 className="w-4 h-4" />
            عقد جديد
          </Button>
          <Button onClick={() => setCurrentSection('properties')} variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 font-medium">
            <Building2 className="w-4 h-4" />
            إضافة عقار
          </Button>
          <Button onClick={() => setCurrentSection('invoices')} variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 font-medium">
            <Receipt className="w-4 h-4" />
            إصدار فاتورة
          </Button>
        </div>
      </div>

      {/* ---- Ultra-compact iOS-style metrics widget (dice-5/quincunx) ---- */}
      <div
        className="mx-auto flex w-full flex-col items-center gap-4 bg-white p-5 shadow-sm dark:bg-slate-800"
        style={{ maxWidth: '17rem', borderRadius: '1.75rem' }}
      >
        {/* top pips: العقود النشطة · دفعات مستحقة */}
        <div className="flex items-start justify-center gap-6">
          <WidgetRing
            percent={contractPercent}
            color={EMERALD}
            centerValue={stats?.contracts?.active ?? 0}
            label="العقود النشطة"
            onClick={() => drillTo('contracts', 'filter-status', 'active')}
            clickHint="عرض العقود النشطة"
          />
          <WidgetRing
            percent={duePercent}
            color={AMBER}
            centerValue={dueCount}
            label="دفعات مستحقة"
            onClick={() => drillTo('contracts', 'upcoming-report', 'all')}
            clickHint="عرض تقرير الدفعات القادمة"
          />
        </div>
        {/* centre pip: المتأخرات */}
        <div className="flex justify-center">
          <WidgetRing
            percent={overduePercent}
            color={RED}
            centerValue={overdueInstallmentCount}
            label="المتأخرات"
            labelClassName="text-red-600 dark:text-red-400"
            onClick={scrollToOverdue}
            clickHint={overdueInstallmentCount > 0 ? 'أقساط فات موعدها ولم تُسدد — عرض التفاصيل' : 'لا توجد أقساط متأخرة'}
          />
        </div>
        {/* bottom pips: دورة حياة العقود (donut) · الفواتير الصادرة */}
        <div className="flex items-start justify-center gap-6">
          <div
            role="button"
            tabIndex={0}
            title="عرض جميع العقود"
            aria-label="عرض جميع العقود"
            onClick={() => drillTo('contracts', 'filter-status', 'all')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drillTo('contracts', 'filter-status', 'all') } }}
            className="flex cursor-pointer flex-col items-center justify-start gap-1 rounded-xl p-1 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {lifecycleData.length > 0 ? (
              <ChartContainer config={lifecycleChartConfig} className="pointer-events-none h-16 w-16">
                <PieChart>
                  <Pie
                    data={lifecycleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={28}
                    paddingAngle={2}
                    cornerRadius={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {lifecycleData.map((entry) => (
                      <Cell key={`w-lc-${entry.name}`} fill={LIFECYCLE_COLORS[entry.name] ?? EMERALD} />
                    ))}
                    <Label content={renderLifecycleCenter} />
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center text-[10px] text-muted-foreground">—</div>
            )}
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-tight">دورة حياة العقود</p>
          </div>
          <WidgetRing
            percent={100}
            color={INDIGO}
            centerValue={issuedCount}
            label="الفواتير الصادرة"
            onClick={() => drillTo('invoices', 'filter-status', 'all')}
            clickHint="عرض قائمة الفواتير"
          />
        </div>
      </div>

      {/* ---- Visual Milestone & Expiry Timeline Widget ---- */}
      <Card className="shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">الجدول الزمني لاستحقاق العقود والدفعات</CardTitle>
            <CardDescription className="text-xs text-slate-400">تنبيهات العقود المنتهية والأقساط المستحقة خلال الفترة القادمة</CardDescription>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-none font-bold text-xs">
            نشط
          </Badge>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative border-r border-slate-100 dark:border-slate-800 pr-6 space-y-6">
            {recentContracts.length === 0 ? (
              <div className="text-center text-slate-400 py-4 text-xs">لا توجد عقود نشطة لعرض جدولها الزمني</div>
            ) : (
              recentContracts.slice(0, 3).map((contract) => {
                const now = new Date()
                const end = new Date(String(contract.endDate).replace(' ', 'T'))
                const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

                let dotColor = 'bg-emerald-500'
                let textColor = 'text-emerald-600'
                let label = 'نشط ومستقر'

                if (daysLeft < 0) {
                  dotColor = 'bg-red-500'
                  textColor = 'text-red-500'
                  label = 'منتهي الصلاحية'
                } else if (daysLeft <= 90) {
                  dotColor = 'bg-amber-500'
                  textColor = 'text-amber-600'
                  label = 'يوشك على الانتهاء'
                }

                return (
                  <div key={contract.id} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Timeline Node dot */}
                    <span className={`absolute -right-[29px] top-1.5 size-4 rounded-full border-4 border-white dark:border-slate-900 ${dotColor} shadow-sm z-10`} />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-[13px] text-slate-800 dark:text-slate-100">العقد: {contract.contractNumber}</h5>
                        <Badge className={`${dotColor}/10 ${textColor} border-none font-bold text-[10px] px-2 py-0.5`}>
                          {label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        المستأجر: <span className="font-semibold">{contract.tenantName || contract.tenant?.name || '—'}</span> ·
                        العقار: <span className="font-semibold">{contract.rentalProperty?.titleAr || '—'}</span>
                      </p>
                    </div>

                    <div className="text-right sm:text-left text-xs text-slate-400">
                      <span>تاريخ الانتهاء: {formatDate(contract.endDate)}</span>
                      {daysLeft >= 0 && (
                        <p className={`font-bold mt-0.5 ${textColor}`}>
                          متبقي {daysLeft} يوماً
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- Monthly Revenue Chart ---- */}
      <div>
        <Card className="shadow-[0_2px_20px_rgba(0,0,0,0.04)] border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الإيرادات الشهرية</CardTitle>
            <CardDescription className="text-muted-foreground/60">المحصّل مقابل المستحق لآخر 6 أشهر · اضغط على أي شهر لعرض فواتيره</CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ChartContainer config={barChartConfig} className="h-64 w-full cursor-pointer">
                <BarChart
                  data={barData}
                  barGap={4}
                  onClick={(state: { activePayload?: Array<{ payload?: { year?: number; monthIndex?: number } }> }) => {
                    const p = state?.activePayload?.[0]?.payload
                    if (p && typeof p.year === 'number' && typeof p.monthIndex === 'number') {
                      drillTo('invoices', 'filter-month', `${p.year}-${String(p.monthIndex + 1).padStart(2, '0')}`)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: (item as { color?: string })?.color }} />
                              {barChartConfig[name as keyof typeof barChartConfig]?.label ?? name}
                            </span>
                            <span className="font-bold tabular-nums text-foreground">{formatSAR(Number(value) || 0)}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="collected" fill={EMERALD} radius={[4, 4, 0, 0]} maxBarSize={40} cursor="pointer" />
                  <Bar dataKey="due" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={40} cursor="pointer" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                لا توجد بيانات إيرادات لآخر ٦ أشهر
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Recent Activity Section ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Contracts */}
        <Card className="shadow-[0_2px_20px_rgba(0,0,0,0.04)] border-0">
          <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-800">أحدث العقود المبرمة</CardTitle>
              <div className="p-2 bg-white rounded-md shadow-sm">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentContracts.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>المستأجر</TableHead>
                      <TableHead>العقار</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentContracts.map((contract) => {
                      const alert = getContractAlertColor(contract.status, contract.endDate)
                      return (
                      <TableRow key={contract.id} className={`hover:bg-slate-50/80 transition-colors ${alert.row}`}>
                        <TableCell className="font-semibold text-slate-900 text-xs">
                          {contract.contractNumber}
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">
                          {contract.tenant?.name || contract.tenantName || '—'}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-slate-500">
                          {contract.rentalProperty?.title || contract.propertyTitle || '—'}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-700">{formatSAR(contract.rentAmount)}</TableCell>
                        <TableCell>
                          <ContractAlertBadge status={contract.status} endDate={contract.endDate} />
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                لا توجد عقود حتى الآن
              </div>
            )}
          </CardContent>
        </Card>

        {/* المدفوعات القادمة والمتأخرة */}
        <Card ref={paymentScheduleRef} style={{ scrollMarginTop: '1rem' }} className="shadow-[0_2px_20px_rgba(0,0,0,0.04)] border-0">
          <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl dark:border-slate-800 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">المدفوعات القادمة و المتأخرة</CardTitle>
                <CardDescription className="text-xs">
                  {overdueRows.length > 0 && (
                    <span className="font-bold text-red-600 dark:text-red-400">{stats?.paymentSchedule?.overdueCount ?? overdueRows.length} متأخرة</span>
                  )}
                  {overdueRows.length > 0 && upcomingRows.length > 0 && <span className="text-slate-400"> · </span>}
                  {upcomingRows.length > 0 && (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{stats?.paymentSchedule?.upcomingCount ?? upcomingRows.length} قادمة</span>
                  )}
                  {overdueRows.length === 0 && upcomingRows.length === 0 && <span className="text-slate-400">لا توجد مستحقات غير مُفوترة</span>}
                </CardDescription>
              </div>
              <div className="p-2 bg-white rounded-md shadow-sm dark:bg-slate-900">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overdueRows.length > 0 || upcomingRows.length > 0 ? (
              <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {overdueRows.map((r, i) => (
                  <PaymentScheduleItem key={`ov-${r.contractNumber}-${r.installmentNo}-${i}`} row={r} overdue />
                ))}
                {upcomingRows.map((r, i) => (
                  <PaymentScheduleItem key={`up-${r.contractNumber}-${r.installmentNo}-${i}`} row={r} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                لا توجد مدفوعات قادمة أو متأخرة غير مُفوترة
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Quick Info Cards ---- */}
      {stats.contracts.expiringSoon > 0 && (
        <Card className="border-amber-200 bg-amber-50/70 shadow-[0_2px_16px_rgba(245,158,11,0.08)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                {stats.contracts.expiringSoon} عقود تنتهي خلال 30 يوماً
              </p>
              <p className="text-sm text-amber-700">
                يرجى التواصل مع المستأجرين لتجديد العقود
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
