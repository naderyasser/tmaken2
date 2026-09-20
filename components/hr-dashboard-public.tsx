'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays, Gift, AlertTriangle, CheckSquare, ArrowUpFromLine, RefreshCw, Loader2,
  MapPin, Printer,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { frappeClient, isAuthError } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'
import { fmtDate, fmtDateTime } from '@/lib/hr-format'
import { SessionRenew } from '@/components/login-page'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { APEX } from '@/lib/apex-colors'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * لوحة تحكم الحضور — live version of the Apex reference dashboard.
 * One backend call (base_meena.api.attendance_overview.get_attendance_overview)
 * feeds every widget: summary tiles, employees donut, per-branch stacked bars,
 * the day's latest movements and the 10-day movements series.
 */

interface Totals {
  employees: number; present: number; absent: number; on_leave: number
  official_holiday: number; weekly_off: number; waiting: number
}
interface BranchRow {
  branch: string; present: number; on_leave: number; absent: number; waiting: number
  weekly_off: number; official_holiday: number; total: number
}
interface Movement {
  employee: string; employee_number: string; employee_name: string; image?: string | null
  branch?: string | null; log_type?: string | null; time: string; is_fallback?: boolean
  location_label?: string | null; location_map_url?: string | null
}
interface ListRow { code: string | number; name: string; shift?: string; branch?: string }
interface Overview {
  date: string; day_name: string; is_today: boolean
  totals: Totals; by_branch: BranchRow[]; movements: Movement[]
  last_days: { date: string; count: number }[]
  lists?: Record<string, ListRow[]>
}

// Maps a summary-card `key` (see `stats` below) → the matching `lists` bucket
// returned by the backend (same names `_totals`/`_classify` use server-side).
const CATEGORY_LIST_KEYS: Record<string, string> = {
  leave: 'on_leave', official: 'official_holiday', weekly: 'weekly_off', absent: 'absent', present: 'present',
}

function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/** «الطباعة» for a category drill-down dialog — opens a plain, self-contained
 *  print document instead of window.print()-ing the live app (the dialog is a
 *  Radix portal appended to <body>, outside the dashboard's own print rules,
 *  and a modal backdrop has no sensible printed form anyway). */
function printCategoryList(title: string, rows: ListRow[]) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  const rowsHtml = rows.map((r) => (
    `<tr><td>${escapeHtml(r.code)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.shift || '—')}</td><td>${escapeHtml(r.branch || '—')}</td></tr>`
  )).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px">لا توجد بيانات</td></tr>`
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>
    body{font-family:'Noto Kufi Arabic',Tahoma,sans-serif;padding:24px;direction:rtl;color:#212529}
    h1{font-size:18px;margin:0 0 16px;text-align:center}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #ced4da;padding:6px 10px;text-align:right}
    thead tr{background:#bcc2d1}
  </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <table><thead><tr><th>كود الموظف</th><th>الاسم</th><th>الدوام</th><th>الفرع</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

// Token cleanup only (zero visual change): every value here now comes from
// lib/apex-colors.ts (a JS mirror of the --apex-chart-* vars in globals.css)
// or an existing --apex-* var — no literal hex left in this file. See
// --apex-chart-absent's comment for why it's distinct from --apex-red.
const COLORS = {
  present: APEX.chartPresent, absent: APEX.chartAbsent, leave: APEX.chartLeave, waiting: 'var(--apex-amber)', weekly: 'var(--apex-neutral-fill)',
}

const EMPTY_TOTALS: Totals = { employees: 0, present: 0, absent: 0, on_leave: 0, official_holiday: 0, weekly_off: 0, waiting: 0 }

/** Truncates a long branch name for the x-axis tick; the bar's Tooltip still
 *  shows the untruncated name (it reads the underlying data value, not this). */
function truncateLabel(value: string, max = 10): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function BranchAxisTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill={APEX.chartTick}>
      {truncateLabel(String(payload?.value ?? ''))}
    </text>
  )
}

export function PublicHrDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<'auth' | 'load' | null>(null)
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const res = await frappeClient.call<Overview>('base_meena.api.attendance_overview.get_attendance_overview')
      const payload = (res as any)?.message ?? (res as any)?.data
      if (!payload?.totals) throw new Error('empty overview payload')
      setData(payload as Overview)
      setError(null)
    } catch (e) {
      setError(isAuthError(e) ? 'auth' : 'load')
      if (!isAuthError(e)) console.error('Failed to load attendance overview:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // «حركات اليوم» / whole overview auto-refresh every 30s, paused while the
  // tab is hidden (background tabs shouldn't keep hammering the endpoint).
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') load(true)
      }, 30000)
    }
    const stop = () => { if (interval) { clearInterval(interval); interval = null } }
    const onVisibility = () => { if (document.visibilityState === 'hidden') stop(); else start() }
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [load])

  if (error === 'auth') return <div className="p-4"><SessionRenew /></div>

  const totals = data?.totals ?? EMPTY_TOTALS
  const stats = [
    { key: 'leave', label: 'الاجازات', value: totals.on_leave, icon: ArrowUpFromLine, color: 'var(--apex-green)' },
    { key: 'official', label: 'عطلات رسمية', value: totals.official_holiday, icon: Gift, color: 'var(--apex-chart-neutral-icon)' },
    { key: 'weekly', label: 'عطله إسبوعية', value: totals.weekly_off, icon: CalendarDays, color: 'var(--apex-chart-neutral-icon)' },
    { key: 'absent', label: 'الغياب', value: totals.absent, icon: AlertTriangle, color: 'var(--apex-chart-absent-icon)' },
    { key: 'present', label: 'حضور', value: totals.present, icon: CheckSquare, color: 'var(--apex-blue)' },
  ]
  const donut = [
    { name: 'حضور', value: totals.present, fill: COLORS.present },
    { name: 'غياب', value: totals.absent, fill: COLORS.absent },
    { name: 'اجازات', value: totals.on_leave, fill: COLORS.leave },
    { name: 'في الانتظار', value: totals.waiting, fill: COLORS.waiting },
    { name: 'عطلة', value: totals.weekly_off + totals.official_holiday, fill: COLORS.weekly },
  ].filter((d) => d.value > 0)
  const branches = (data?.by_branch ?? []).map((b) => ({
    name: b.branch, present: b.present, absent: b.absent, leave: b.on_leave, waiting: b.waiting,
    weekly: b.weekly_off + b.official_holiday,
  }))
  const branchMax = Math.max(4, ...branches.map((b) => b.present + b.absent + b.leave + b.waiting + b.weekly))
  const movements = data?.movements ?? []
  // 5.1: Apex's exact title format is weekday + a HYPHENATED date (dd-mm-yyyy),
  // unlike every other date in the app (dd/mm/yyyy, lib/hr-format.ts) — kept
  // local to this one title rather than touching the shared formatter.
  const dayTitle = data ? `حركات يوم ${data.day_name} ${fmtDate(data.date).replace(/\//g, '-')}` : 'حركات اليوم'
  const openStat = stats.find((s) => s.key === openCategory)
  const openRows = openCategory ? (data?.lists?.[CATEGORY_LIST_KEYS[openCategory]] ?? []) : []

  return (
    <div className="p-4 space-y-4 bg-[var(--apex-bg)] min-h-full font-[family-name:var(--font-arabic)]" dir="rtl">

      {/* Apex has no separate status strip / «تحديث» button above the summary
          panel — the load-error note (if any) surfaces on the movements card
          below instead, next to its own small refresh icon (5.1). */}

      {/* Top Row: Cards and Circle Chart */}
      <div className="flex flex-col xl:flex-row-reverse gap-4">
        {/* 5.1: grey panel (Apex measured 1603×218 — height fixed, width fluid
            to the column), title 24px/400 (not bold), 5 white cards 170×117
            radius 5 no shadow, no icons. */}
        <div className="flex-1 bg-[var(--apex-chart-panel-bg)] p-5 rounded min-h-[218px]">
          <h2 className="mb-5 text-[24px] font-normal text-slate-800 text-center">ملخص حضور اليوم</h2>
          <div className="flex flex-wrap gap-3 flex-row-reverse justify-center">
            {stats.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setOpenCategory(s.key)}
                aria-haspopup="dialog"
                className="h-[117px] w-[170px] flex flex-col items-center justify-center bg-white rounded-[5px]"
              >
                <p className="text-[13px] font-bold text-slate-700 mb-2">{s.label}</p>
                {loading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full xl:w-[320px] shrink-0 bg-white p-5 rounded border border-slate-100 flex flex-col items-center justify-center shadow-sm">
          <div className="relative h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              {/* role/title (not aria-label — not a typed recharts prop) give the
                  generated <svg> an accessible name (D7, round-1: svg-img-alt) */}
              <PieChart role="img" aria-label="توزيع الموظفين حسب حالة الحضور" title="توزيع الموظفين حسب حالة الحضور">
                <Pie
                  data={donut.length ? donut : [{ name: '—', value: 1, fill: APEX.chartGrid }]}
                  dataKey="value" cx="50%" cy="50%" innerRadius={61} outerRadius={70}
                  stroke="none" isAnimationActive={false}
                >
                  {(donut.length ? donut : [{ fill: APEX.chartGrid }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {donut.length > 0 && <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 4, fontSize: 12 }} />}
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center mt-2">
              <span className="text-[11px] font-bold text-slate-600 mb-0.5">إجمالي الموظفين</span>
              <span className="text-xl font-bold text-blue-500">{loading ? '…' : totals.employees}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Stacked Bar Chart and Table */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="order-2 bg-white pt-5 pb-3 px-4 rounded border border-slate-100 shadow-sm flex flex-col">
          <h2 className="mb-6 text-[24px] font-bold text-slate-800 text-center">ملخص الحضور في الفروع</h2>
          <div className="h-[300px] mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart role="img" aria-label="ملخص الحضور في الفروع" title="ملخص الحضور في الفروع" data={branches} barSize={26} margin={{ right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={APEX.chartGrid} />
                <XAxis
                  dataKey="name" tick={<BranchAxisTick />} axisLine={{ stroke: APEX.chartAxisLine }}
                  tickLine={false} angle={0} interval={0} height={36}
                />
                <YAxis tick={{ fontSize: 11, fill: APEX.chartTick }} axisLine={{ stroke: APEX.chartAxisLine }} tickLine={false} allowDecimals={false} domain={[0, branchMax]} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} contentStyle={{ direction: 'rtl', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="present" name="حضور" stackId="a" fill={COLORS.present} isAnimationActive={false} />
                <Bar dataKey="leave" name="الاجازات" stackId="a" fill={COLORS.leave} isAnimationActive={false} />
                <Bar dataKey="absent" name="الغياب" stackId="a" fill={COLORS.absent} isAnimationActive={false} />
                <Bar dataKey="weekly" name="عطلة" stackId="a" fill={COLORS.weekly} isAnimationActive={false} />
                <Bar dataKey="waiting" name="في الانتظار" stackId="a" fill={COLORS.waiting} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-slate-600 mt-auto">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.present }} /><span>حضور</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.absent }} /><span>الغياب</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.leave }} /><span>الاجازات</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.waiting }} /><span>في الانتظار</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.weekly }} /><span>عطله إسبوعية</span></div>
          </div>
        </div>

        <div className="order-1 bg-white pt-5 pb-3 px-4 rounded border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-1 px-2">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-[24px] font-bold text-slate-800">{dayTitle}</h2>
              {/* 5.1: a small refresh icon replaces the removed top «تحديث» button/status line */}
              <button
                type="button"
                onClick={() => load(true)}
                disabled={loading || refreshing}
                aria-label="تحديث بيانات الحركات"
                title="تحديث"
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>
          {/* Apex shows no status line here — kept as a screen-reader-only note
              (not visible, so the title row stays title+icon exactly like Apex)
              so the "stale data" / load-error states aren't silently dropped. */}
          {(error === 'load' || (data && !data.is_today)) && (
            <p className="sr-only" role="status" aria-live="polite">
              {error === 'load'
                ? 'تعذّر تحميل البيانات من الخادم'
                : `لا توجد حركات اليوم بعد — يُعرض آخر يوم به حركات (${fmtDate(data!.date)})`}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 pt-1 px-2 font-bold w-12 text-center whitespace-nowrap">الصورة</th>
                  <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">كود الموظف</th>
                  <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">الاسم</th>
                  <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">الحركة</th>
                  <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">الموقع</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400"><Loader2 className="inline h-4 w-4 animate-spin" aria-hidden /></td></tr>
                )}
                {!loading && movements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-2">
                      <EmptyState
                        icon={CalendarDays}
                        title="لا توجد حركات مسجّلة اليوم"
                        description="ستظهر هنا حركات الحضور والانصراف بمجرد تسجيلها"
                      />
                    </td>
                  </tr>
                )}
                {movements.map((m, i) => (
                  <tr key={`${m.employee}-${m.time}-${i}`} className="border-b border-slate-100">
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={frappeImageUrl(m.image)} alt="" className="inline-block h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--apex-chart-badge-bg)] text-[11px] font-bold text-[var(--apex-chart-badge-text)]">
                          {(m.employee_name || '?').trim().charAt(0)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-700 whitespace-nowrap">{m.employee_number}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-700 whitespace-nowrap">{m.employee_name}</td>
                    <td className="py-2.5 px-2 text-center text-slate-500 font-medium whitespace-nowrap">
                      {fmtDateTime(m.time)}
                      {m.log_type && (
                        <span className={`ms-1.5 rounded px-1 text-[10px] font-bold ${m.log_type === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {m.log_type === 'IN' ? 'دخول' : 'خروج'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500 font-medium whitespace-nowrap">
                      {m.location_label ?? m.branch ?? '—'}
                      {m.location_map_url && (
                        <a
                          href={m.location_map_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="عرض الموقع على الخريطة"
                          className="ms-1 inline-flex align-middle text-[var(--apex-blue)] hover:text-[var(--apex-blue-light)]"
                        >
                          <MapPin className="inline h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5.1 (X — removed): Apex has no 10-day movements chart, the page ends
          after the two bottom blocks above. */}

      {/* Category drill-down — Apex `AttendingLeaveDetalies`: clicking a summary
          card opens the underlying list (code · name · shift · branch). The
          `theme-hr hr-dialog-lg` classes are applied directly on the portalled
          content itself (not relied on via ancestry) so the Apex dialog-geometry
          tokens in globals.css (`[role="dialog"].theme-hr…`) always match it. */}
      <Dialog open={openCategory !== null} onOpenChange={(open) => { if (!open) setOpenCategory(null) }}>
        <DialogContent className="theme-hr hr-dialog-lg">
          <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <DialogTitle>{openStat?.label ?? ''}</DialogTitle>
            <button
              type="button"
              onClick={() => printCategoryList(openStat?.label ?? '', openRows)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              الطباعة
            </button>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-[13px] text-right">
              <thead>
                <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
                  <th className="px-3 font-bold whitespace-nowrap">كود الموظف</th>
                  <th className="px-3 font-bold whitespace-nowrap">الاسم</th>
                  <th className="px-3 font-bold whitespace-nowrap">الدوام</th>
                  <th className="px-3 font-bold whitespace-nowrap">الفرع</th>
                </tr>
              </thead>
              <tbody>
                {openRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">لا توجد بيانات</td></tr>
                ) : openRows.map((r, i) => (
                  <tr key={`${r.code}-${i}`} className="border-b border-slate-100 h-11">
                    <td className="px-3 font-bold text-slate-700 whitespace-nowrap">{r.code}</td>
                    <td className="px-3 whitespace-nowrap">{r.name}</td>
                    <td className="px-3 text-slate-500 whitespace-nowrap">{r.shift || '—'}</td>
                    <td className="px-3 text-slate-500 whitespace-nowrap">{r.branch || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
