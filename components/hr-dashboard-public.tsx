'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarDays, Gift, AlertTriangle, CheckSquare, Umbrella, CircleHelp, Loader2, Printer } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { frappeClient, isAuthError } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'
import { subscribeRealtime } from '@/lib/frappe-realtime'
import { SessionRenew } from '@/components/login-page'
import { Skeleton } from '@/components/ui/skeleton'
import { APEX } from '@/lib/apex-colors'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * لوحة تحكم الحضور — Apex /hr/dashboard, 1:1.
 *
 * One call (base_meena.api.hr_dashboard.get_dashboard, branch-scoped) feeds
 * every widget. Live: each processed punch arrives over Frappe socket.io as
 * `hr_attendance_punch` (Apex: SignalR "AttandanceLog") and is prepended to
 * «حركات يوم …»; the cards/donut/branch chart then refresh (debounced 2s —
 * an enhancement over Apex, which only updates the table). 60s polling stays
 * as the fallback while the socket is down.
 */

type Bucket = 'present' | 'absent' | 'on_leave' | 'official_holiday' | 'weekly_off' | 'waiting'
type Totals = Record<Bucket, number> & { employees: number }
interface BranchRow extends Totals { branch: string; total: number }
interface Movement {
  id: string; code: string; name: string; image?: string | null; employee?: string | null
  transaction_time: string | null; location: { name: string }; branch?: string | null
  device?: string | null; status?: string; is_unknown?: boolean; clock_skew?: boolean
}
interface ListRow { code: string; name: string; branch?: string; shift?: string }
interface Dashboard {
  date: string; day_name: string; is_today: boolean; totals: Totals; by_branch: BranchRow[]
  max_value: number; movements: Movement[]; last_days: ({ date: string } & Totals)[]
  lists: Record<Bucket, ListRow[]>
}

const METHOD = 'base_meena.api.hr_dashboard.get_dashboard'
const POLL_MS = 60_000
const REFRESH_DEBOUNCE_MS = 2_000
const HIGHLIGHT_MS = 4_000
const WAITING = '#ffb62e' // --apex-amber
const WEEKLY = '#9d9fa0'

// Apex series colours (legend order = Apex legend order).
const SERIES: { key: Bucket; label: string; color: string }[] = [
  { key: 'present', label: 'حضور', color: APEX.chartPresent },
  { key: 'absent', label: 'الغياب', color: APEX.chartAbsent },
  { key: 'on_leave', label: 'الاجازات', color: APEX.chartLeave },
  { key: 'waiting', label: 'في الانتظار', color: WAITING },
  { key: 'weekly_off', label: 'عطله إسبوعية', color: WEEKLY },
]

// «ملخص حضور اليوم» cards, Apex RTL order (right → left).
const CARDS: { key: Bucket; label: string; icon: typeof CheckSquare; color: string; numberColor: string }[] = [
  { key: 'present', label: 'حضور', icon: CheckSquare, color: '#2960b6', numberColor: '#2960b6' },
  { key: 'absent', label: 'الغياب', icon: AlertTriangle, color: '#ff0000', numberColor: '#ff0000' },
  { key: 'weekly_off', label: 'عطله إسبوعية', icon: CalendarDays, color: '#808080', numberColor: '#808080' },
  { key: 'official_holiday', label: 'عطلات رسمية', icon: Gift, color: '#808080', numberColor: '#808080' },
  { key: 'on_leave', label: 'الاجازات', icon: Umbrella, color: '#2eaf7d', numberColor: '#2eaf7d' },
]

const EMPTY_TOTALS: Totals = { present: 0, absent: 0, on_leave: 0, official_holiday: 0, weekly_off: 0, waiting: 0, employees: 0 }

const pad = (n: number) => String(n).padStart(2, '0')
/** Apex «الحركة»: MM/DD/YYYY HH:mm:ss */
function apexDateTime(v: string | null): string {
  if (!v) return ''
  const d = new Date(v.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return v
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function printList(title: string, rows: ListRow[]) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  const body = rows.map((r) => `<tr><td>${escapeHtml(r.code)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.branch || '')}</td><td>${escapeHtml(r.shift || '')}</td></tr>`).join('')
    || '<tr><td colspan="4" style="text-align:center;padding:20px">لا توجد بيانات</td></tr>'
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
    body{font-family:'Noto Kufi Arabic',Tahoma,sans-serif;padding:24px;direction:rtl}h1{font-size:18px;text-align:center}
    table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ced4da;padding:6px 10px;text-align:right}thead tr{background:#bcc2d1}
  </style></head><body><h1>${escapeHtml(title)}</h1><table><thead><tr><th>الكود</th><th>الاسم</th><th>الفرع</th><th>الدوام</th></tr></thead><tbody>${body}</tbody></table></body></html>`)
  w.document.close(); w.focus(); w.print()
}

/** Apex chart tooltip: series title, then "<category>: <n>". */
function SeriesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div dir="rtl" className="rounded border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-md">
      <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-700">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color || p.fill }} />{p.name}
      </div>
      <div className="text-slate-600">{label}: <b>{p.value}</b></div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-slate-600">
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /><span>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function BranchTick({ x, y, payload }: any) {
  const v = String(payload?.value ?? '')
  return (
    <text x={x} y={y + 8} textAnchor="start" fontSize={10} fill={APEX.chartTick} transform={`rotate(-45 ${x} ${y + 8})`}>
      {v}
    </text>
  )
}

function DefaultAvatar() {
  return (
    <svg viewBox="0 0 40 40" className="inline-block h-[50px] w-[50px]" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#e2ebfb" />
      <circle cx="20" cy="15" r="7" fill="#2960b6" />
      <path d="M7 34c2-7 7-10 13-10s11 3 13 10a19 19 0 0 1-26 0z" fill="#2960b6" />
    </svg>
  )
}

export function PublicHrDashboard() {
  const params = useSearchParams()
  const date = params?.get('date') || undefined
  // the topbar «فرع:» filter scopes the whole dashboard (/hr?branch=…)
  const branch = params?.get('branch') || undefined
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'auth' | 'load' | null>(null)
  const [openCard, setOpenCard] = useState<Bucket | null>(null)
  const [live, setLive] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dateRef = useRef<string | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await frappeClient.call<Dashboard>(METHOD, { ...(date ? { date } : {}), ...(branch ? { branch } : {}) })
      const payload = (res as any)?.message
      if (!payload?.totals) throw new Error('empty dashboard payload')
      dateRef.current = payload.date
      setData(payload)
      setError(null)
    } catch (e) {
      setError(isAuthError(e) ? 'auth' : 'load')
      if (!isAuthError(e)) console.error('Failed to load attendance dashboard:', e)
    } finally {
      setLoading(false)
    }
  }, [date, branch])

  useEffect(() => { load() }, [load])

  // Live punches: prepend + highlight, then a debounced full refresh.
  useEffect(() => {
    return subscribeRealtime<Movement & { removed?: boolean }>('hr_attendance_punch', (row) => {
      if (row?.removed) { // a held punch was replayed — its replacement arrives as its own event
        setData((d) => d && { ...d, movements: d.movements.filter((m) => m.id !== row.id) })
        return
      }
      if (!row?.transaction_time || row.transaction_time.slice(0, 10) !== dateRef.current) return
      setData((d) => {
        if (!d) return d
        const same = (m: Movement) => m.id === row.id
          || (m.code === row.code && m.transaction_time === row.transaction_time && m.device === row.device)
        return { ...d, movements: [row, ...d.movements.filter((m) => !same(m))] }
      })
      setFresh((s) => new Set(s).add(row.id))
      setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(row.id); return n }), HIGHLIGHT_MS)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => load(true), REFRESH_DEBOUNCE_MS)
    }, setLive)
  }, [load])

  // Fallback polling (paused while the tab is hidden).
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(true) }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const totals = data?.totals ?? EMPTY_TOTALS
  const donut = useMemo(() => [
    { name: 'حضور', value: totals.present, fill: APEX.chartPresent },
    { name: 'الغياب', value: totals.absent, fill: APEX.chartAbsent },
    { name: 'الاجازات', value: totals.on_leave, fill: APEX.chartLeave },
    { name: 'في الانتظار', value: totals.waiting, fill: WAITING },
    { name: 'عطله إسبوعية', value: totals.weekly_off + totals.official_holiday, fill: WEEKLY },
  ].filter((p) => p.value > 0), [totals])
  const branches = (data?.by_branch ?? []).map((b) => ({ ...b, weekly_off: b.weekly_off + b.official_holiday }))
  const lastDays = (data?.last_days ?? []).map((d) => ({ ...d, weekly_off: d.weekly_off + d.official_holiday }))
  const movements = data?.movements ?? []
  const card = CARDS.find((c) => c.key === openCard)
  const cardRows = openCard ? (data?.lists?.[openCard] ?? []) : []

  if (error === 'auth') return <div className="p-4"><SessionRenew /></div>

  return (
    <div className="min-h-full space-y-4 bg-[var(--apex-bg)] p-4 font-[family-name:var(--font-arabic)]" dir="rtl" data-testid="hr-dashboard">
      {/* ── Row 1: donut (right) · «ملخص حضور اليوم» (left) ── */}
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="flex w-full shrink-0 items-center justify-center rounded bg-white p-5 shadow-sm xl:w-[310px]">
          <div className="relative h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart role="img" aria-label="إجمالي الموظفين">
                <Pie data={donut.length ? donut : [{ name: '—', value: 1, fill: APEX.chartGrid }]} dataKey="value"
                  cx="50%" cy="50%" innerRadius={58} outerRadius={70} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                  {(donut.length ? donut : [{ fill: APEX.chartGrid }]).map((p, i) => <Cell key={i} fill={p.fill} />)}
                </Pie>
                {donut.length > 0 && <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 4, fontSize: 12 }} />}
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[13px] text-slate-700">إجمالي الموظفين</span>
              <span className="text-xl text-[var(--apex-blue)]" data-testid="total-employees">{loading ? '…' : totals.employees}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 rounded bg-[var(--apex-chart-panel-bg)] p-5 shadow-sm">
          <h2 className="mb-5 text-center text-[24px] font-normal text-slate-800">ملخص حضور اليوم</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CARDS.map((c) => (
              <button key={c.key} type="button" onClick={() => setOpenCard(c.key)} aria-haspopup="dialog" data-testid={`card-${c.key}`}
                className="flex h-[92px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[5px] bg-white shadow-sm hover:shadow">
                <span className="relative inline-flex h-7 w-7 items-center justify-center rounded">
                  <span className="absolute inset-0 rounded opacity-15" style={{ background: c.color }} />
                  <c.icon className="relative h-[18px] w-[18px]" style={{ color: c.color }} aria-hidden />
                </span>
                <span className="text-[13px] text-slate-700">{c.label}</span>
                {loading ? <Skeleton className="h-4 w-6" /> : <span className="text-[13px] font-bold" style={{ color: c.numberColor }}>{totals[c.key]}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: «حركات يوم …» (right) · «ملخص الحضور في الفروع» (left) ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex flex-col rounded bg-white px-4 pb-3 pt-5 shadow-sm">
          <div className="mb-3 flex items-center justify-center gap-2">
            <h2 className="text-[1.5rem] text-slate-800" data-testid="movements-title">
              {data ? `حركات يوم ${data.day_name} ${data.date}` : 'حركات اليوم'}
            </h2>
            <span className="relative" title={live ? 'تحديث مباشر: متصل — تظهر كل بصمة فور تسجيلها' : 'تحديث مباشر غير متصل — يتم التحديث كل دقيقة'}>
              <CircleHelp className="h-4 w-4 animate-pulse text-slate-400" aria-hidden />
              <span className={`absolute -left-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} data-testid="live-dot" data-live={live ? '1' : '0'} />
            </span>
          </div>
          {error === 'load' && <p className="mb-2 text-center text-[12px] text-rose-600">تعذّر تحميل البيانات من الخادم</p>}
          <div className="h-[330px] overflow-y-auto">
            <table className="w-full table-fixed text-right text-[12.5px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b-2 border-slate-300 text-slate-800">
                  <th className="w-[70px] px-2 pb-2 font-bold">الصورة</th>
                  <th className="w-24 px-2 pb-2 font-bold">كود الموظف</th>
                  <th className="px-2 pb-2 font-bold">الاسم</th>
                  <th className="w-40 px-2 pb-2 font-bold">الحركة</th>
                  <th className="px-2 pb-2 font-bold">الموقع</th>
                </tr>
              </thead>
              <tbody data-testid="movements">
                {loading && !data && (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-400"><Loader2 className="inline h-4 w-4 animate-spin" aria-hidden /></td></tr>
                )}
                {!loading && movements.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-400">لا توجد حركات</td></tr>
                )}
                {movements.map((m) => (
                  <tr key={m.id} data-testid="movement-row" data-code={m.code}
                    className={`h-[62px] border-b border-slate-200 transition-colors duration-700 ${fresh.has(m.id) ? 'bg-amber-100' : ''}`}>
                    <td className="px-2">
                      {m.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={frappeImageUrl(m.image)} alt="" className="h-[50px] w-[50px] rounded-full object-cover" />
                        : <DefaultAvatar />}
                    </td>
                    <td className="px-2 text-slate-700">{m.code}</td>
                    <td className="truncate px-2 text-slate-700" title={m.name}>{m.name}</td>
                    <td className="whitespace-nowrap px-2 text-slate-700">
                      {apexDateTime(m.transaction_time)}
                      {m.clock_skew && (
                        <span className="ms-1 align-middle text-amber-600" title="ساعة جهاز البصمة غير مضبوطة — الحركة محفوظة وستُصحَّح تلقائياً">⚠</span>
                      )}
                    </td>
                    <td className="truncate px-2 text-slate-700" title={m.location?.name}>{m.location?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col rounded bg-white px-4 pb-3 pt-5 shadow-sm">
          <h2 className="mb-4 text-center text-[1.5rem] font-medium text-slate-800">ملخص الحضور في الفروع</h2>
          <div className="mb-2 h-[360px]" data-testid="branch-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branches} barSize={46} margin={{ right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={APEX.chartGrid} />
                <XAxis dataKey="branch" tick={<BranchTick />} interval={0} height={110} axisLine={{ stroke: APEX.chartAxisLine }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: APEX.chartTick }} axisLine={false} tickLine={false} allowDecimals={false}
                  domain={[0, Math.max(4, data?.max_value ?? 0)]} />
                <Tooltip shared={false} cursor={false} content={<SeriesTooltip />} />
                {SERIES.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} stackId="b" fill={s.color} isAnimationActive={false} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend />
        </div>
      </div>

      {/* ── Row 3: «حركات اخر 10 ايام» — grouped (clustered) columns ── */}
      <div className="flex flex-col rounded bg-white px-4 pb-3 pt-5 shadow-sm">
        <h2 className="mb-4 text-center text-[1.5rem] font-medium text-slate-800">حركات اخر 10 ايام</h2>
        <div className="mb-2 h-[320px]" data-testid="trend-chart">
          {loading && !data ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lastDays} barGap={2} barCategoryGap="18%" margin={{ right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={APEX.chartGrid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: APEX.chartTick }} interval={0} axisLine={{ stroke: APEX.chartAxisLine }} tickLine={false} height={30} />
                <YAxis tick={{ fontSize: 10, fill: APEX.chartTick }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip shared={false} cursor={false} content={<SeriesTooltip />} />
                {SERIES.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} isAnimationActive={false} />)}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <Legend />
      </div>

      {/* ── «عرض <label>» drill-down (Apex AttendingLeaveDetalies) ── */}
      <Dialog open={openCard !== null} onOpenChange={(o) => { if (!o) setOpenCard(null) }}>
        <DialogContent className="theme-hr hr-dialog-lg" data-testid="card-dialog">
          <DialogHeader><DialogTitle className="text-center">عرض {card?.label}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-right text-[13px]">
              <thead className="sticky top-0">
                <tr className="h-11 border-y border-slate-300 bg-[var(--apex-thead)] text-[var(--apex-text)]">
                  <th className="px-3 font-bold">الكود</th><th className="px-3 font-bold">الاسم</th>
                  <th className="px-3 font-bold">الفرع</th><th className="px-3 font-bold">الدوام</th>
                </tr>
              </thead>
              <tbody>
                {cardRows.length === 0
                  ? <tr><td colSpan={4} className="py-8 text-center text-slate-400">لا توجد بيانات</td></tr>
                  : cardRows.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="h-11 border-b border-slate-100">
                      <td className="px-3">{r.code}</td><td className="px-3">{r.name}</td>
                      <td className="px-3 text-slate-600">{r.branch || '—'}</td><td className="px-3 text-slate-600">{r.shift || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => printList(`عرض ${card?.label ?? ''}`, cardRows)}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-slate-300 px-3 text-[13px] text-slate-600 hover:bg-slate-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />الطباعة
            </button>
            <button type="button" onClick={() => setOpenCard(null)} className="h-9 rounded bg-[var(--apex-red)] px-6 text-[13px] text-white hover:opacity-90">إلغاء</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
